import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
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
  ChannelRecommendation,
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
  SaaSAnalysis,
  SaaSIntake,
} from "./types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/**
 * Live analysis via the Claude API.
 *
 * Deliberately does NOT let the model produce opportunity scores or the
 * bottleneck verdict: those stay in `lib/scoring` and `diagnoseBottleneck` so
 * the numbers are reproducible and identical to demo mode. The model supplies
 * judgement and language around them — which is what it is actually good at.
 */
export class ClaudeAIProvider implements AIProvider {
  readonly id = "claude";
  readonly isDemoProvider = false;

  private readonly client: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Set AI_PROVIDER=mock to use the demo engine instead.",
      );
    }
    this.client = new Anthropic({ apiKey: key });
  }

  private async parse<T extends z.ZodType>(args: {
    schema: T;
    system: string;
    prompt: string;
    effort?: "low" | "medium" | "high";
    maxTokens?: number;
  }): Promise<z.infer<T>> {
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: args.maxTokens ?? 8000,
      system: args.system,
      thinking: { type: "adaptive" },
      output_config: {
        format: zodOutputFormat(args.schema),
        effort: args.effort ?? "medium",
      },
      messages: [{ role: "user", content: args.prompt }],
    });

    if (!response.parsed_output) {
      throw new Error("Claude returned a response that did not match the expected schema");
    }
    return response.parsed_output;
  }

  // --- SaaS Analyzer (PRD s6) ---------------------------------------------

  async analyzeSaaS(input: SaaSIntake): Promise<SaaSAnalysis> {
    const schema = z.object({
      productSummary: z.string(),
      coreProblem: z.string(),
      valueProposition: z.string(),
      productCategory: z.string(),
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
    });

    return this.parse({
      schema,
      effort: "high",
      system:
        "You advise early-stage SaaS founders on customer acquisition. Be concrete and specific — vague personas produce vague search results. " +
        "searchTopics must be short phrases (2-4 words) that people would actually type or write when describing this problem in their own words, not marketing language. " +
        "intentSignals must be short phrases that signal someone is looking for a solution, e.g. \"how do i\", \"looking for\", \"anyone using\", \"alternative to\". " +
        "painPoints and problemMap entries should be written the way a customer would describe them, not the way a vendor would.",
      prompt: [
        `Product name: ${input.name}`,
        `Website: ${input.website}`,
        `What it does: ${input.description}`,
        `Problem solved: ${input.problemSolved}`,
        `Target customer: ${input.targetCustomer}`,
        `Category: ${input.category}`,
        `Pricing: ${input.pricing}`,
        `Business model: ${input.businessModel}`,
        `Geography: ${input.targetGeography}`,
        `Competitors: ${input.competitors}`,
        `Current channels: ${input.currentChannels}`,
        `Current users: ${input.currentUsers} (${input.payingUsers} paying)`,
        `Biggest acquisition problem: ${input.biggestProblem}`,
        "",
        "Produce the product understanding, ICP, problem map, search topics and intent signals for this product.",
      ].join("\n"),
    });
  }

  // --- Channel Strategist (PRD s7) -----------------------------------------

  async recommendChannels(
    input: SaaSIntake,
    analysis: SaaSAnalysis,
  ): Promise<ChannelRecommendation[]> {
    const schema = z.object({
      channels: z.array(
        z.object({
          platform: z.enum(["REDDIT", "X", "LINKEDIN"]),
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

    const result = await this.parse({
      schema,
      effort: "medium",
      system:
        "You advise early-stage SaaS founders on which channels to spend their limited time on. " +
        "Score honestly — if a channel is a poor fit for this business model or audience, say so with a low score. " +
        "Return exactly one entry for each of REDDIT, X and LINKEDIN.",
      prompt: [
        `Product: ${input.name} — ${analysis.productSummary}`,
        `Business model: ${input.businessModel}`,
        `Primary customer: ${analysis.primaryCustomer}`,
        `Roles: ${analysis.roles.join(", ")}`,
        `Search topics: ${analysis.searchTopics.join(", ")}`,
        `Budget: ${input.marketingBudget ?? "none stated"}`,
        `Hours available per week: ${input.hoursPerWeek ?? "not stated"}`,
        "",
        "Recommend how to use Reddit, X and LinkedIn for this product.",
      ].join("\n"),
    });

    return result.channels.sort((a, b) => b.fitScore - a.fitScore);
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

    const result = await this.parse({
      schema,
      effort: "medium",
      maxTokens: 12000,
      system:
        "You identify which people in a thread are potential customers for a specific product. " +
        "Be sceptical: most comments in most threads are not opportunities. Mark worthResponding true only when replying would genuinely help that person and could plausibly lead somewhere. " +
        "Never mark the original poster's own follow-up comments as worth responding to — the founder should reply to the post itself. " +
        "Return one entry for every comment you are given, using the exact commentExternalId supplied.",
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
    // Scores stay deterministic and identical to demo mode — see class docblock.
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

    // The model explains the verdict; it does not change it.
    let actionRationale = action.rationale;
    try {
      const schema = z.object({ rationale: z.string() });
      const explained = await this.parse({
        schema,
        effort: "low",
        maxTokens: 1000,
        system:
          "You explain to a founder why a specific recommended action fits a specific conversation. " +
          "Two sentences maximum. Reference something concrete from the post. Do not contradict the recommended action or suggest a different one.",
        prompt: [
          `Community: ${input.communityName} (self-promotion rules: ${input.selfPromoRules})`,
          `Post: ${input.title}`,
          input.content.slice(0, 1500),
          "",
          `Recommended action: ${action.action}`,
          `Promotion risk: ${risk.risk}`,
          `Opportunity score: ${opportunityScore}/100`,
          "",
          "Explain why this action fits this conversation.",
        ].join("\n"),
      });
      actionRationale = explained.rationale;
    } catch {
      // A failed explanation must not lose the assessment; keep the rule text.
    }

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

    const result = await this.parse({
      schema,
      effort: "medium",
      system: [
        "You draft a reply a SaaS founder will post themselves in an online community.",
        "The reply must be genuinely useful on its own merits — someone reading it should get value even if they never look at the product.",
        "Never open with flattery. Never use marketing language. Never invent statistics, customer names, or results.",
        mayMention
          ? `You MAY mention the founder's product (${input.productName}) once, near the end, and you MUST disclose that they built it.`
          : "You MUST NOT mention or link the founder's product at all. No hints, no 'I built something for this'.",
        "guidanceNote: one or two sentences telling the founder what to watch for before posting this.",
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

    const result = await this.parse({
      schema,
      effort: "medium",
      system:
        "You are a growth analyst for an early-stage SaaS founder. Be direct and specific. " +
        "Do not blame marketing by default — if the numbers point at conversion, activation or demand, say that. " +
        `The diagnosed bottleneck is ${bottleneck} and you must not contradict it; explain it in your own words using their numbers. ` +
        "nextActions: two or three concrete things to do this week. If the numbers are too small to conclude anything, say so plainly.",
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

    const result = await this.parse({
      schema,
      effort: "medium",
      system:
        "You interpret the result of a small acquisition experiment for an early-stage SaaS founder. " +
        `The diagnosed bottleneck is ${bottleneck}; do not contradict it. ` +
        "Be honest about sample size — small numbers are directional, not conclusive. " +
        "nextExperiment: one specific, runnable next test.",
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
   * Unlike the demo engine, this actually fetches and reads the page via the
   * server-side web_fetch tool, so `isDemoData` is false.
   */
  async analyzeLandingPage(
    input: LandingPageAnalysisInput,
  ): Promise<LandingPageAnalysis> {
    const reportTool: Anthropic.Messages.ToolUnion = {
      name: "report_audit",
      description: "Report the landing page audit once you have read the page.",
      input_schema: {
        type: "object",
        properties: {
          icpClarity: { type: "integer" },
          problemClarity: { type: "integer" },
          valueProposition: { type: "integer" },
          cta: { type: "integer" },
          messaging: { type: "integer" },
          socialProof: { type: "integer" },
          pricingClarity: { type: "integer" },
          differentiation: { type: "integer" },
          biggestIssue: { type: "string" },
          recommendation: { type: "string" },
        },
        required: [
          "icpClarity", "problemClarity", "valueProposition", "cta",
          "messaging", "socialProof", "pricingClarity", "differentiation",
          "biggestIssue", "recommendation",
        ],
        additionalProperties: false,
      },
      strict: true,
    };

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          `Fetch and read ${input.url}, then audit it as a landing page.`,
          "",
          `The product is ${input.productName}.`,
          `Its intended value proposition: ${input.valueProposition}`,
          `Its intended primary customer: ${input.primaryCustomer}`,
          "",
          "Score each dimension 0-100 based on what the page actually says, not what it intends to say.",
          "Then call report_audit with your scores, the single biggest issue, and one specific recommendation.",
        ].join("\n"),
      },
    ];

    // Manual loop: web_fetch is server-side, so we only need to watch for the
    // report tool call and resume paused turns.
    for (let turn = 0; turn < 6; turn += 1) {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        system:
          "You audit SaaS landing pages for early-stage founders. Judge only what is actually on the page. " +
          "Be specific and unsparing — a vague audit is useless. Always finish by calling report_audit.",
        tools: [
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
          reportTool,
        ],
        messages,
      });

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      const call = response.content.find(
        (block): block is Anthropic.ToolUseBlock =>
          block.type === "tool_use" && block.name === "report_audit",
      );

      if (call) {
        const raw = call.input as Record<string, unknown>;
        const score = (key: string) => {
          const value = Number(raw[key]);
          return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
        };

        return {
          scores: {
            icpClarity: score("icpClarity"),
            problemClarity: score("problemClarity"),
            valueProposition: score("valueProposition"),
            cta: score("cta"),
            messaging: score("messaging"),
            socialProof: score("socialProof"),
            pricingClarity: score("pricingClarity"),
            differentiation: score("differentiation"),
          },
          biggestIssue: String(raw.biggestIssue ?? "Could not determine."),
          recommendation: String(raw.recommendation ?? ""),
          isDemoData: false,
        };
      }

      if (response.stop_reason === "end_turn") break;

      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: "Call report_audit now with your assessment.",
      });
    }

    throw new Error(
      `Could not audit ${input.url}. The page may be unreachable or blocked.`,
    );
  }
}
