import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { Platform } from "@prisma/client";
import { PLATFORM_LABELS, SUPPORTED_PLATFORMS } from "@/lib/adapters/registry";
import {
  assessPromotionRisk,
  detectsSolutionRequest,
  mentionsAnyCompetitor,
} from "@/lib/scoring/promotion-risk";
import { determineRecommendedAction } from "@/lib/scoring/recommended-action";
import {
  computeComponents,
  computeOverallScore,
  priorityBand,
} from "@/lib/scoring/opportunity-score";
import { diagnoseBottleneck } from "./mock-provider";
import type {
  AIProvider,
  CommentAnalysis,
  ConversationAnalysisInput,
  ExperimentAnalysis,
  ExperimentAnalysisInput,
  GrowthAnalysis,
  GrowthAnalysisInput,
  LandingPageAnalysis,
  LandingPageAnalysisInput,
  OpportunityAssessment,
  OpportunityScoringInput,
  ResponseDraft,
  ResponseGenerationInput,
  SaaSAnalysisWithChannels,
  SaaSIntake,
} from "./types";

/**
 * Current, generally-available Gemini Flash model. Fast and inexpensive,
 * which matches this pipeline's needs (frequent, small structured-JSON
 * calls) better than a Pro-tier model.
 *
 * `gemini-2.5-flash` was the original default but returns 404 ("no longer
 * available to new users") on newer API keys; verified against the live
 * model-listing and generateContent APIs that `gemini-3.6-flash` is the
 * model Google's own error response now points existing callers to, and
 * that it supports the JSON-mode structured output this provider relies on.
 */
const DEFAULT_MODEL = "gemini-3.6-flash";

/**
 * Marks a transient Gemini failure (a 5xx — the model briefly overloaded)
 * worth a short retry, as distinct from every other failure — bad key,
 * malformed request, rate limit, blocked prompt, malformed output — which
 * would just fail again identically and must not be retried.
 */
class GeminiTransientError extends Error {}

/**
 * Live analysis via the official Google Gemini API (`@google/genai`).
 *
 * Deliberately does NOT let the model produce opportunity scores or the
 * bottleneck verdict: those stay in `lib/scoring` and `diagnoseBottleneck`,
 * exactly as in `ClaudeAIProvider` and `OpenRouterAIProvider`, so the numbers
 * are reproducible and identical across every provider. The model supplies
 * judgement and language around them.
 *
 * Uses `responseMimeType: "application/json"` rather than a declared response
 * schema or tool calling — the same "ask for JSON, validate against the same
 * Zod schema every provider uses" approach as `OpenRouterAIProvider`, so all
 * three live providers are held to one contract.
 */
export class GeminiAIProvider implements AIProvider {
  readonly id = "gemini";
  readonly isDemoProvider = false;

  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey ?? process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        "GEMINI_API_KEY is not set. Set AI_PROVIDER=mock to use the demo engine instead.",
      );
    }
    // Never logged: the key is only ever passed to the SDK client, never
    // included in an error message or console output.
    this.client = new GoogleGenAI({ apiKey: key });
    this.model = model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  }

  private async generateJSON<T extends z.ZodType>(args: {
    schema: T;
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<z.infer<T>> {
    // Gemini occasionally returns a transient 5xx while the model is
    // overloaded; confirmed live that this can outlast a couple of quick
    // retries (observed 503s persisting for 15+ seconds across several
    // consecutive real calls), so this backs off further before giving up.
    // Every other failure (bad key, bad request, rate limit, blocked
    // prompt, malformed output) is not retried — retrying it would just
    // fail again identically, so it still fails immediately as before.
    const attempts = 5; // 1 initial attempt + up to 4 retries
    let lastError: Error = new Error("Gemini request failed");

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.generateJSONOnce(args);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (!(error instanceof GeminiTransientError) || attempt === attempts) {
          throw lastError;
        }
        // 500ms, 1000ms, 2000ms, 4000ms, each with up to 30% jitter so
        // concurrent requests don't all retry in lockstep.
        const baseDelayMs = 500 * 2 ** (attempt - 1);
        const delayMs = baseDelayMs + Math.random() * baseDelayMs * 0.3;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  private async generateJSONOnce<T extends z.ZodType>(args: {
    schema: T;
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<z.infer<T>> {
    let response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;
    try {
      response = await this.client.models.generateContent({
        model: this.model,
        contents: args.prompt,
        config: {
          systemInstruction: args.system,
          responseMimeType: "application/json",
          // Constrains Gemini's own decoding to the exact shape, rather than
          // relying solely on the prose description in `system` — without
          // this, the larger schemas (many keys, nested enums) are prone to
          // producing syntactically valid JSON that still fails `safeParse`.
          responseJsonSchema: z.toJSONSchema(args.schema),
          maxOutputTokens: args.maxTokens ?? 4000,
          temperature: 0.4,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 429) {
          throw new Error(
            "Gemini rate limit reached. The free tier has a limited requests-per-minute/day quota — try again shortly.",
          );
        }
        if (error.status === 401 || error.status === 403) {
          throw new Error("Gemini rejected the API key. Check GEMINI_API_KEY.");
        }
        if (error.status >= 500) {
          throw new GeminiTransientError(
            `Gemini API is temporarily unavailable (${error.status}). Try again shortly.`,
          );
        }
        throw new Error(`Gemini API returned ${error.status}: ${error.message}`);
      }
      throw new Error(
        `Could not reach Gemini: ${error instanceof Error ? error.message : "network error"}`,
      );
    }

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini blocked this request (${blockReason}).`);
    }

    const content = response.text;
    const finishReason = response.candidates?.[0]?.finishReason;

    if (!content) {
      if (finishReason === "MAX_TOKENS") {
        throw new Error(
          `Gemini (${this.model}) used its entire token budget and produced no answer.`,
        );
      }
      if (finishReason) {
        throw new Error(
          `Gemini (${this.model}) produced no content (finish reason: ${finishReason}).`,
        );
      }
      throw new Error(`Gemini (${this.model}) returned an empty response.`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(
        finishReason === "MAX_TOKENS"
          ? `Gemini (${this.model}) was cut off mid-response before finishing valid JSON.`
          : `Gemini (${this.model}) returned a response that was not valid JSON.`,
      );
    }

    const result = args.schema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      throw new Error(
        `Gemini (${this.model}) returned JSON that did not match the expected schema — ${issues}`,
      );
    }
    return result.data;
  }

  // --- SaaS Analyzer + Channel Strategist combined (PRD s6-s7) -------------

  /**
   * One call producing both the SaaS analysis and channel recommendations
   * from the founder's minimal intake (description, problem solved, and
   * optionally target customer / website) — everything else (name,
   * category, business model, likely competitors, ICP) is inferred.
   */
  async analyzeSaaSWithChannels(
    input: SaaSIntake,
  ): Promise<SaaSAnalysisWithChannels> {
    const platformNames = SUPPORTED_PLATFORMS.map((p) => PLATFORM_LABELS[p]).join(", ");

    const schema = z.object({
      productName: z.string(),
      productSummary: z.string(),
      coreProblem: z.string(),
      valueProposition: z.string(),
      productCategory: z.string(),
      businessModel: z.enum(["B2B", "B2C", "B2B2C"]),
      likelyCompetitors: z.array(z.string()),
      primaryCustomer: z.string(),
      secondaryCustomer: z.string(),
      roles: z.array(z.string()),
      industries: z.array(z.string()),
      companySize: z.string(),
      painPoints: z.array(z.string()),
      buyingTriggers: z.array(z.string()),
      objections: z.array(z.string()),
      problemMap: z.array(
        z.object({
          problem: z.string(),
          relatedProblems: z.array(z.string()),
        }),
      ),
      searchTopics: z.array(z.string()),
      intentSignals: z.array(z.string()),
      positiveKeywords: z.array(z.string()),
      keywordSynonyms: z.array(
        z.object({
          keyword: z.string(),
          synonyms: z.array(z.string()),
        }),
      ),
      negativeKeywords: z.array(z.string()),
      channels: z.array(
        z.object({
          platform: z.enum(SUPPORTED_PLATFORMS as [Platform, ...Platform[]]),
          fitScore: z.number().int().min(0).max(10),
          priority: z.enum(["High", "Medium", "Low"]),
          whyItFits: z.string(),
          whoToFind: z.string(),
          topicsToTarget: z.string(),
          conversationsToJoin: z.string(),
          actionToTake: z.string(),
        }),
      ),
    });

    const result = await this.generateJSON({
      schema,
      maxTokens: 10000,
      system: [
        "You advise early-stage SaaS founders on customer acquisition. The founder gave you only a short description and problem statement — infer everything else a competent analyst would: a plausible product name (from the website domain if given, otherwise a short descriptive name), its category, business model (B2B/B2C/B2B2C), and likely competitors or alternatives.",
        "Be concrete and specific — vague personas produce vague search results.",
        "searchTopics must be short phrases (2-4 words) that people would actually type or write when describing this problem in their own words, not marketing language.",
        "intentSignals must be short phrases that signal someone is looking for a solution, e.g. \"how do i\", \"looking for\", \"anyone using\", \"alternative to\".",
        "painPoints and problemMap entries should be written the way a customer would describe them, not the way a vendor would.",
        "If a target customer is given, use it as the primary customer; otherwise infer the most likely primary and secondary customer from the product description.",
        "positiveKeywords: 5-12 SPECIFIC problem-shaped phrases a real person would actually type or write, sharper than searchTopics — e.g. for an invoicing tool, prefer \"unpaid invoice\" or \"client hasn't paid\" over just \"invoice\". Every product is different: derive these from what this specific product actually solves, never a fixed template.",
        "keywordSynonyms: for the positiveKeywords that have genuinely common alternate wordings, list a few real variations people use — e.g. \"freelancer\" -> [\"independent consultant\", \"self-employed\", \"solo business\"]. Skip a keyword entirely if it has no natural variation; do not force synonyms that nobody would actually use.",
        "negativeKeywords: a SHORT, conservative list of phrases that would make a conversation clearly irrelevant even if it happens to contain a positive keyword — e.g. unrelated industries, job/hiring posts, or a completely different meaning of an ambiguous term. Only include terms you are confident are false-positive traps for this specific product; leave the array empty rather than guessing.",
        "You also advise which channels to spend limited time on. Score honestly — if a channel is a poor fit for this business model or audience, say so with a low score.",
        `Return exactly one channel entry for each of ${platformNames}, using their exact platform codes: ${SUPPORTED_PLATFORMS.join(", ")}.`,
        'Respond with a single JSON object with exactly these keys: productName (string), productSummary (string), coreProblem (string), valueProposition (string), productCategory (string), businessModel ("B2B"|"B2C"|"B2B2C"), likelyCompetitors (string array, may be empty), primaryCustomer (string), secondaryCustomer (string), roles (string array), industries (string array), companySize (string), painPoints (string array), buyingTriggers (string array), objections (string array), problemMap (array of {problem: string, relatedProblems: string array}), searchTopics (string array), intentSignals (string array), positiveKeywords (string array), keywordSynonyms (array of {keyword: string, synonyms: string array}), negativeKeywords (string array, may be empty), channels (array of {platform, fitScore (0-10 integer), priority ("High"|"Medium"|"Low"), whyItFits, whoToFind, topicsToTarget, conversationsToJoin, actionToTake}). No other text.',
      ].join(" "),
      prompt: [
        `What it does: ${input.description}`,
        `Problem solved: ${input.problemSolved}`,
        `Target customer: ${input.targetCustomer ?? "not specified — infer it"}`,
        `Website: ${input.website ?? "not provided"}`,
        "",
        `Produce the product understanding, ICP, problem map, search topics, intent signals and search keyword strategy (positive keywords, synonyms, negative keywords) for this product, and recommend how to use ${platformNames} for it.`,
      ].join("\n"),
    });

    const { channels, ...analysis } = result;
    return {
      analysis,
      channels: [...channels].sort((a, b) => b.fitScore - a.fitScore),
    };
  }

  // --- Conversation Analyzer (PRD s10) -------------------------------------

  async analyzeConversation(
    input: ConversationAnalysisInput,
  ): Promise<CommentAnalysis[]> {
    if (input.comments.length === 0) return [];

    const schema = z.object({
      comments: z.array(
        z.object({
          commentExternalId: z.string(),
          icpMatch: z.enum(["High", "Medium", "Low"]),
          problemExpressed: z.boolean(),
          intent: z.enum(["High", "Medium", "Low", "None"]),
          worthResponding: z.boolean(),
          reason: z.string(),
        }),
      ),
    });

    const result = await this.generateJSON({
      schema,
      maxTokens: 10000,
      system: [
        "You identify which people in a thread are potential customers for a specific product.",
        "Be sceptical: most comments in most threads are not opportunities. Mark worthResponding true only when replying would genuinely help that person and could plausibly lead somewhere.",
        "Never mark the original poster's own follow-up comments as worth responding to — the founder should reply to the post itself.",
        "Return one entry for every comment you are given, using the exact commentExternalId supplied.",
        'Respond with a single JSON object: { "comments": [ { commentExternalId, icpMatch ("High"|"Medium"|"Low"), problemExpressed (boolean), intent ("High"|"Medium"|"Low"|"None"), worthResponding (boolean), reason } ] }. No other text.',
      ].join(" "),
      prompt: [
        `The founder's customer is described by these topics: ${input.icpKeywords.join(", ")}`,
        `Signals that someone wants a solution: ${input.intentSignals.join(", ")}`,
        "",
        `POST: ${input.postTitle}`,
        input.postBody,
        "",
        "COMMENTS:",
        ...input.comments.map(
          (c) =>
            `[${c.externalId}] ${c.author}${c.isOp ? " (original poster)" : ""} (${c.upvotes} upvotes): ${c.body}`,
        ),
      ].join("\n"),
    });

    // Guarantee one analysis per comment even if the model omits any.
    const byId = new Map(result.comments.map((c) => [c.commentExternalId, c]));
    return input.comments.map(
      (comment) =>
        byId.get(comment.externalId) ?? {
          commentExternalId: comment.externalId,
          icpMatch: "Low" as const,
          problemExpressed: false,
          intent: "None" as const,
          worthResponding: false,
          reason: "Not analysed.",
        },
    );
  }

  // --- Opportunity Scorer (PRD s15-17) -------------------------------------

  async scoreOpportunity(
    input: OpportunityScoringInput,
  ): Promise<OpportunityAssessment> {
    // Scores stay deterministic and identical across every provider.
    const text = `${input.title} ${input.content}`;

    const components = computeComponents({
      text,
      icpKeywords: input.icpKeywords,
      problemKeywords: input.problemKeywords,
      intentSignals: input.intentSignals,
      productCategory: input.productCategory,
      communityTopics: input.communityTopics,
      upvotes: input.upvotes,
      commentCount: input.commentCount,
      postedAt: input.postedAt,
    });

    const opportunityScore = computeOverallScore(components);
    const band = priorityBand(opportunityScore);
    const asksForSolution = detectsSolutionRequest(text);
    const mentionsCompetitor = mentionsAnyCompetitor(text, input.competitors);

    const risk = assessPromotionRisk({
      intentScore: components.intentScore,
      relevanceScore: components.relevanceScore,
      problemScore: components.problemScore,
      selfPromoRules: input.selfPromoRules,
      mentionsCompetitor,
      asksForSolution,
    });

    const action = determineRecommendedAction({
      band,
      promotionRisk: risk.risk,
      intentScore: components.intentScore,
      problemScore: components.problemScore,
      asksForSolution,
    });

    // The rationale is the deterministic rule text from
    // determineRecommendedAction — the same text every provider (including
    // MockAIProvider) would fall back to anyway if an AI explanation call
    // failed. Since the verdict itself is never influenced by the model
    // (only its wording was), spending a full API call just to reword one
    // sentence isn't worth it; the rule-based rationale is used directly.
    const actionRationale = action.rationale;

    return {
      ...components,
      opportunityScore,
      priorityBand: band,
      promotionRisk: risk.risk,
      promotionRiskReason: risk.reason,
      recommendedAction: action.action,
      actionRationale,
    };
  }

  // --- Response Copilot (PRD s18) ------------------------------------------

  async generateResponse(
    input: ResponseGenerationInput,
  ): Promise<ResponseDraft> {
    const mayMention =
      input.allowProductMention &&
      input.promotionRisk !== "HIGH" &&
      input.recommendedAction === "Mention your product";

    const styleGuide: Record<string, string> = {
      helpful: "Clear and useful. Lead with the most actionable point.",
      conversational: "Relaxed and human, like talking to a peer.",
      short: "Three sentences at most.",
      detailed: "Thorough, structured, covering the non-obvious parts.",
      technical: "Precise and specific about mechanisms and tradeoffs.",
      "experience-based": "First-person, describing what actually happened to you.",
    };

    const schema = z.object({
      draft: z.string(),
      guidanceNote: z.string(),
    });

    const result = await this.generateJSON({
      schema,
      maxTokens: 3000,
      system: [
        "You draft a reply a SaaS founder will post themselves in an online community.",
        "The reply must be genuinely useful on its own merits — someone reading it should get value even if they never look at the product.",
        "Never open with flattery. Never use marketing language. Never invent statistics, customer names, or results.",
        mayMention
          ? `You MAY mention the founder's product (${input.productName}) once, near the end, and you MUST disclose that they built it.`
          : "You MUST NOT mention or link the founder's product at all. No hints, no 'I built something for this'.",
        "guidanceNote: one or two sentences telling the founder what to watch for before posting this.",
        'Respond with a single JSON object: { "draft": string, "guidanceNote": string }. No other text.',
      ].join(" "),
      prompt: [
        `Platform: ${input.platform}. Community: ${input.communityName}.`,
        `Recommended action: ${input.recommendedAction}`,
        `Promotion risk: ${input.promotionRisk}`,
        `Style: ${input.style} — ${styleGuide[input.style] ?? styleGuide.helpful}`,
        "",
        `The founder's product: ${input.productName} — ${input.productSummary}`,
        `Its value proposition: ${input.valueProposition}`,
        "",
        `POST: ${input.postTitle}`,
        input.postBody,
        input.targetComment
          ? `\nThey are replying to this specific comment:\n${input.targetComment}`
          : "\nThey are replying to the post itself.",
        "",
        "Write the reply.",
      ].join("\n"),
    });

    return {
      draft: result.draft,
      mentionsProduct: mayMention,
      guidanceNote: result.guidanceNote,
    };
  }

  // --- Growth Analyst (PRD s24-25) -----------------------------------------

  async analyzeGrowth(input: GrowthAnalysisInput): Promise<GrowthAnalysis> {
    // The bottleneck verdict is rule-based so it cannot drift between runs.
    const { bottleneck, explanation } = diagnoseBottleneck(input.funnel);

    const bestPlatform = [...input.perPlatform].sort(
      (a, b) => b.signups - a.signups || b.engagements - a.engagements,
    )[0];

    const schema = z.object({
      activitySummary: z.string(),
      bestTopic: z.string().nullable(),
      bestConversationType: z.string().nullable(),
      bottleneckExplanation: z.string(),
      recommendation: z.string(),
      nextActions: z.array(z.string()),
    });

    const result = await this.generateJSON({
      schema,
      maxTokens: 3000,
      system: [
        "You are a growth analyst for an early-stage SaaS founder. Be direct and specific.",
        "Do not blame marketing by default — if the numbers point at conversion, activation or demand, say that.",
        `The diagnosed bottleneck is ${bottleneck} and you must not contradict it; explain it in your own words using their numbers.`,
        "nextActions: two or three concrete things to do this week. If the numbers are too small to conclude anything, say so plainly.",
        'Respond with a single JSON object: { "activitySummary": string, "bestTopic": string|null, "bestConversationType": string|null, "bottleneckExplanation": string, "recommendation": string, "nextActions": string array }. No other text.',
      ].join(" "),
      prompt: [
        `Period: ${input.periodStart.toDateString()} to ${input.periodEnd.toDateString()}`,
        `Opportunities discovered: ${input.funnel.opportunities}`,
        `Conversations engaged: ${input.funnel.engagements}`,
        `Profile visits: ${input.funnel.profileVisits}`,
        `Website visits: ${input.funnel.websiteVisits}`,
        `Signups: ${input.funnel.signups}`,
        `Activated: ${input.funnel.activations}`,
        `Paying: ${input.funnel.paid}`,
        `Responses posted: ${input.responsesPosted}`,
        "",
        "Per platform:",
        ...input.perPlatform.map(
          (p) => `  ${p.platform}: ${p.engagements} engagements, ${p.signups} signups`,
        ),
        "",
        `Their target topics: ${input.topTopics.join(", ")}`,
        "",
        `Rule-based diagnosis: ${bottleneck}. Reference: ${explanation}`,
      ].join("\n"),
    });

    return {
      activitySummary: result.activitySummary,
      bestChannel:
        bestPlatform && bestPlatform.engagements > 0 ? bestPlatform.platform : null,
      bestTopic: result.bestTopic,
      bestConversationType: result.bestConversationType,
      bottleneck,
      bottleneckExplanation: result.bottleneckExplanation,
      recommendation: result.recommendation,
      nextActions: result.nextActions,
    };
  }

  async analyzeExperiment(
    input: ExperimentAnalysisInput,
  ): Promise<ExperimentAnalysis> {
    const { bottleneck, explanation } = diagnoseBottleneck({
      opportunities: input.conversations,
      engagements: input.conversations,
      profileVisits: 0,
      websiteVisits: input.websiteVisits,
      signups: input.signups,
      activations: input.activatedUsers,
      paid: input.paidUsers,
    });

    const hitTarget =
      input.targetConversations > 0 &&
      input.conversations >= input.targetConversations;

    const schema = z.object({
      whatHappened: z.string(),
      interpretation: z.string(),
      nextExperiment: z.string(),
    });

    const result = await this.generateJSON({
      schema,
      maxTokens: 3000,
      system: [
        "You interpret the result of a small acquisition experiment for an early-stage SaaS founder.",
        `The diagnosed bottleneck is ${bottleneck}; do not contradict it.`,
        "Be honest about sample size — small numbers are directional, not conclusive.",
        "nextExperiment: one specific, runnable next test.",
        'Respond with a single JSON object: { "whatHappened": string, "interpretation": string, "nextExperiment": string }. No other text.',
      ].join(" "),
      prompt: [
        `Hypothesis: ${input.hypothesis}`,
        `Action taken: ${input.action}`,
        `Target conversations: ${input.targetConversations} (${hitTarget ? "met" : "not met"})`,
        `Conversations: ${input.conversations}`,
        `Website visits: ${input.websiteVisits}`,
        `Signups: ${input.signups}`,
        `Activated: ${input.activatedUsers}`,
        `Paying: ${input.paidUsers}`,
        "",
        `Rule-based diagnosis: ${bottleneck}. Reference: ${explanation}`,
      ].join("\n"),
    });

    return { ...result, bottleneck };
  }

  // --- Landing Page Analyzer (PRD s26) -------------------------------------

  /**
   * Unlike the demo engine, this fetches the real page itself — plain
   * `fetch()`, not a model-side tool — so `isDemoData` is false. Mirrors
   * `OpenRouterAIProvider`: the Gemini API's own URL-context tool is a
   * separate, more involved feature, and a plain fetch of extracted page
   * text into the prompt is enough to satisfy this contract reliably.
   */
  async analyzeLandingPage(
    input: LandingPageAnalysisInput,
  ): Promise<LandingPageAnalysis> {
    let pageText: string;
    try {
      const response = await fetch(input.url, {
        headers: { "User-Agent": "launchpad-catalyst" },
      });
      if (!response.ok) {
        throw new Error(`page returned ${response.status}`);
      }
      const html = await response.text();
      pageText = stripHtml(html).slice(0, 6000);
    } catch (error) {
      throw new Error(
        `Could not fetch ${input.url}: ${error instanceof Error ? error.message : "unknown error"}. The page may be unreachable or blocking automated requests.`,
      );
    }

    if (!pageText.trim()) {
      throw new Error(`Fetched ${input.url} but found no readable text content.`);
    }

    const schema = z.object({
      icpClarity: z.number().int().min(0).max(100),
      problemClarity: z.number().int().min(0).max(100),
      valueProposition: z.number().int().min(0).max(100),
      cta: z.number().int().min(0).max(100),
      messaging: z.number().int().min(0).max(100),
      socialProof: z.number().int().min(0).max(100),
      pricingClarity: z.number().int().min(0).max(100),
      differentiation: z.number().int().min(0).max(100),
      biggestIssue: z.string(),
      recommendation: z.string(),
    });

    const result = await this.generateJSON({
      schema,
      maxTokens: 3000,
      system: [
        "You audit SaaS landing pages for early-stage founders. Judge only what is actually on the page text given to you. Be specific and unsparing — a vague audit is useless.",
        'Respond with a single JSON object: { "icpClarity", "problemClarity", "valueProposition", "cta", "messaging", "socialProof", "pricingClarity", "differentiation" (each an integer 0-100), "biggestIssue" (string), "recommendation" (string) }. No other text.',
      ].join(" "),
      prompt: [
        `The product is ${input.productName}.`,
        `Its intended value proposition: ${input.valueProposition}`,
        `Its intended primary customer: ${input.primaryCustomer}`,
        "",
        "Extracted page text:",
        pageText,
        "",
        "Score each dimension 0-100 based on what the page actually says, not what it intends to say. Then give the single biggest issue and one specific recommendation.",
      ].join("\n"),
    });

    return {
      scores: {
        icpClarity: result.icpClarity,
        problemClarity: result.problemClarity,
        valueProposition: result.valueProposition,
        cta: result.cta,
        messaging: result.messaging,
        socialProof: result.socialProof,
        pricingClarity: result.pricingClarity,
        differentiation: result.differentiation,
      },
      biggestIssue: result.biggestIssue,
      recommendation: result.recommendation,
      isDemoData: false,
    };
  }
}

/** Minimal HTML-to-text extraction, scoped to this file only. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
