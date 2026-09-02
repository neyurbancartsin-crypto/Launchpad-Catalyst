import type { Bottleneck, Platform } from "@prisma/client";
import {
  assessPromotionRisk,
  detectsSolutionRequest,
  mentionsAnyCompetitor,
} from "@/lib/scoring/promotion-risk";
import { determineRecommendedAction } from "@/lib/scoring/recommended-action";
import {
  computeComponents,
  computeOverallScore,
  keywordMatchScore,
  priorityBand,
} from "@/lib/scoring/opportunity-score";
import {
  BASE_INTENT_SIGNALS,
  selectArchetype,
} from "./archetypes";
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

function splitList(value: string): string[] {
  return value
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstSentence(text: string): string {
  const match = text.trim().match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? text).trim();
}

/**
 * Demo analysis engine. Deterministic and offline: it derives its output from
 * the founder's own intake and the conversation text, so the workflow can be
 * exercised end-to-end before an AI key exists. All numeric scoring is
 * delegated to `lib/scoring` so swapping in a real provider cannot move the
 * numbers.
 */
export class MockAIProvider implements AIProvider {
  readonly id = "mock";
  readonly isDemoProvider = true;

  async analyzeSaaS(input: SaaSIntake): Promise<SaaSAnalysis> {
    const corpus = [
      input.description,
      input.problemSolved,
      input.targetCustomer,
      input.category,
      input.biggestProblem,
    ]
      .join(" ")
      .toLowerCase();

    const archetype = selectArchetype(corpus);
    const competitorList = splitList(input.competitors);

    return {
      productSummary: `${input.name} is a ${input.category.toLowerCase()} for ${input.targetCustomer.toLowerCase()}. ${firstSentence(input.description)}`,
      coreProblem: firstSentence(input.problemSolved),
      valueProposition: `${input.name} helps ${input.targetCustomer.toLowerCase()} solve ${firstSentence(input.problemSolved).toLowerCase().replace(/\.$/, "")} — priced at ${input.pricing}.`,
      productCategory: input.category,

      primaryCustomer: archetype.primaryCustomer,
      secondaryCustomer: archetype.secondaryCustomer,
      roles: archetype.roles,
      industries: archetype.industries,
      companySize: archetype.companySize,
      painPoints: archetype.painPoints,
      buyingTriggers: archetype.buyingTriggers,
      objections: [
        ...archetype.objections,
        ...(competitorList.length > 0
          ? [`We already use ${competitorList[0]}`]
          : []),
      ],

      problemMap: archetype.problemMap,
      searchTopics: archetype.searchTopics,
      intentSignals: BASE_INTENT_SIGNALS,
    };
  }

  async recommendChannels(
    input: SaaSIntake,
    analysis: SaaSAnalysis,
  ): Promise<ChannelRecommendation[]> {
    const isB2B = input.businessModel.toUpperCase().startsWith("B2B");
    const topics = analysis.searchTopics.slice(0, 4).join(", ");

    // Reddit leads for early-stage B2B: problem-first threads, searchable
    // history, and communities organised around exactly these pain points.
    const reddit: ChannelRecommendation = {
      platform: "REDDIT",
      fitScore: 9,
      priority: "High",
      whyItFits:
        "Founders and operators describe problems in their own words on Reddit, in public, before they start shopping for tools. That makes it the highest-signal place to find people who have your problem but do not yet know your product exists.",
      whoToFind: analysis.roles.slice(0, 3).join(", "),
      topicsToTarget: topics,
      conversationsToJoin:
        "Threads where someone states the problem directly, asks how others solved it, or asks for a tool recommendation.",
      actionToTake:
        "Answer the question properly first. Earn the right to mention your product; do not lead with it.",
    };

    const x: ChannelRecommendation = {
      platform: "X",
      fitScore: 8,
      priority: "High",
      whyItFits:
        "Founders think out loud on X and reply to strangers. Conversations are shorter and faster than Reddit, and a genuinely useful reply is visible to everyone following the thread.",
      whoToFind: `${analysis.roles[0] ?? "Founders"} and operators posting about ${analysis.searchTopics[0] ?? "your problem space"}`,
      topicsToTarget: topics,
      conversationsToJoin:
        "Posts where someone describes the problem with real numbers, and threads asking for recommendations.",
      actionToTake:
        "Add one concrete, specific insight. Brevity is the format; a long pitch reads as spam.",
    };

    const linkedin: ChannelRecommendation = {
      platform: "LINKEDIN",
      fitScore: isB2B ? 7 : 4,
      priority: isB2B ? "Medium" : "Low",
      whyItFits: isB2B
        ? "Your buyers list their job title publicly, and professional posts about operational problems attract exactly the people who own the budget for solving them."
        : "LinkedIn skews heavily B2B. With a B2C product the audience is a poor match, so treat it as a low-priority channel.",
      whoToFind: analysis.roles.join(", "),
      topicsToTarget: topics,
      conversationsToJoin:
        "Posts where a professional describes an operational problem candidly, rather than announcement or celebration posts.",
      actionToTake:
        "Leave a substantive comment that adds a perspective the post did not cover. Self-promotion is poorly received here.",
    };

    return [reddit, x, linkedin].sort((a, b) => b.fitScore - a.fitScore);
  }

  async analyzeConversation(
    input: ConversationAnalysisInput,
  ): Promise<CommentAnalysis[]> {
    return input.comments.map((comment) => {
      const problemScore = keywordMatchScore(comment.body, input.icpKeywords, 2);
      const intentScore = keywordMatchScore(
        comment.body,
        input.intentSignals,
        1,
      );
      const asksForSolution = detectsSolutionRequest(comment.body);

      const problemExpressed = problemScore >= 40;
      const icpMatch: CommentAnalysis["icpMatch"] =
        problemScore >= 70 ? "High" : problemScore >= 35 ? "Medium" : "Low";
      const intent: CommentAnalysis["intent"] = asksForSolution
        ? intentScore >= 50
          ? "High"
          : "Medium"
        : intentScore >= 50
          ? "Medium"
          : intentScore > 0
            ? "Low"
            : "None";

      // The original poster is answering their own thread; replying to them is
      // usually redundant unless they asked a follow-up question.
      const worthResponding =
        !comment.isOp && (problemExpressed || asksForSolution);

      let reason: string;
      if (comment.isOp) {
        reason =
          "This is the original poster following up in their own thread — respond to the post itself rather than this comment.";
      } else if (asksForSolution && problemExpressed) {
        reason =
          "This person states your problem and is explicitly asking how others solved it. This is the strongest kind of opening.";
      } else if (asksForSolution) {
        reason =
          "They are asking for a recommendation, though the problem they describe is only a partial match for what you solve.";
      } else if (problemExpressed) {
        reason =
          "They describe your problem in their own words but are not asking for a solution. Useful for experience-sharing, not for pitching.";
      } else {
        reason =
          "This comment is off your problem area — engaging here would not reach a potential customer.";
      }

      return {
        commentExternalId: comment.externalId,
        icpMatch,
        problemExpressed,
        intent,
        worthResponding,
        reason,
      };
    });
  }

  async scoreOpportunity(
    input: OpportunityScoringInput,
  ): Promise<OpportunityAssessment> {
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

    return {
      ...components,
      opportunityScore,
      priorityBand: band,
      promotionRisk: risk.risk,
      promotionRiskReason: risk.reason,
      recommendedAction: action.action,
      actionRationale: action.rationale,
    };
  }

  async generateResponse(
    input: ResponseGenerationInput,
  ): Promise<ResponseDraft> {
    const focus = input.targetComment ?? input.postBody;
    const topic = firstSentence(focus).replace(/\.$/, "");

    // A product mention requires both an explicit founder opt-in and a
    // recommendation that supports it. Never inferred.
    const mayMention =
      input.allowProductMention &&
      input.promotionRisk !== "HIGH" &&
      input.recommendedAction === "Mention your product";

    const openers: Record<string, string> = {
      helpful: `Worth separating two things here.`,
      conversational: `Been exactly where you are on this one.`,
      short: `Short version:`,
      detailed: `A few things worth unpacking, because the usual advice skips the part that matters.`,
      technical: `The mechanics here matter more than the tooling choice.`,
      "experience-based": `We hit this at almost the same stage, so here's what actually happened rather than what I wish had happened.`,
    };

    const bodies: Record<string, string> = {
      helpful: `The thing most people get wrong is treating this as one problem when it's usually two: the volume itself, and the fact that nobody has categorised where it comes from. Fixing the second usually shrinks the first more than any tool does.`,
      conversational: `What helped us was picking one week and actually tagging every instance instead of guessing. It was tedious and it changed what we did next, because the pattern wasn't what we assumed.`,
      short: `Categorise a week of it before you change anything. The fix is usually obvious once you can see the split, and it's rarely the thing you'd have guessed.`,
      detailed: `First, get a week of real data — categorise every instance rather than estimating. Second, split what you find into "shouldn't exist" and "will always exist". The first bucket is a product or documentation problem and it's usually bigger than people expect. Only the second bucket is a tooling problem. Most teams buy tooling for the whole thing and are disappointed.`,
      technical: `The failure mode is optimising throughput on work that shouldn't be reaching you at all. Instrument the source first: tag by root cause, not by symptom. Anything traceable to a single unclear step in your product is cheaper to fix at the source than to handle repeatedly downstream.`,
      "experience-based": `We spent two months trying to handle it faster before realising four root causes accounted for most of it. Fixing those took a fortnight and removed more work than any process change we'd tried. The uncomfortable part was that they were all things we'd shipped.`,
    };

    const closers: Record<string, string> = {
      helpful: `Happy to go into what we tagged if that's useful.`,
      conversational: `What does the split look like for you?`,
      short: `Happy to share the categories we used.`,
      detailed: `If it helps, I can share the categorisation we ended up with — it transfers reasonably well.`,
      technical: `Glad to go deeper on the instrumentation side if useful.`,
      "experience-based": `Genuinely curious whether yours breaks down the same way.`,
    };

    // Reflect the specific thing being replied to, so the draft reads as a
    // reply to this conversation rather than a template (PRD s18).
    const reflection =
      topic.length > 0 && topic.length <= 180
        ? `On "${topic}" — ${input.targetComment ? "that's the part worth separating out." : "this is more common than it looks."}`
        : "";

    const parts = [
      openers[input.style] ?? openers.helpful,
      reflection,
      bodies[input.style] ?? bodies.helpful,
      mayMention
        ? `For transparency, I build ${input.productName} which does the deflection side of this — but the categorisation above matters more, and you can do it without any tool.`
        : "",
      closers[input.style] ?? closers.helpful,
    ].filter(Boolean);

    const guidanceNote = mayMention
      ? `You are mentioning ${input.productName}. Disclose that you built it — the draft already does. Keep the useful part longer than the pitch.`
      : input.promotionRisk === "HIGH"
        ? `Promotion risk is high in ${input.communityName}. This draft deliberately contains no product mention. Do not add one.`
        : `Recommended action is "${input.recommendedAction}". This draft leads with value and does not mention your product. Add a mention only if the conversation genuinely invites it.`;

    return {
      draft: parts.join("\n\n"),
      mentionsProduct: mayMention,
      guidanceNote,
    };
  }

  async analyzeGrowth(input: GrowthAnalysisInput): Promise<GrowthAnalysis> {
    const { funnel } = input;

    const bestPlatform = [...input.perPlatform].sort(
      (a, b) => b.signups - a.signups || b.engagements - a.engagements,
    )[0];

    const { bottleneck, explanation } = diagnoseBottleneck(funnel);

    const activitySummary = `Across this period you engaged in ${funnel.engagements} ${
      funnel.engagements === 1 ? "conversation" : "conversations"
    } from ${funnel.opportunities} discovered ${
      funnel.opportunities === 1 ? "opportunity" : "opportunities"
    }, which produced ${funnel.websiteVisits} website ${
      funnel.websiteVisits === 1 ? "visit" : "visits"
    }, ${funnel.signups} ${funnel.signups === 1 ? "signup" : "signups"}, ${
      funnel.activations
    } activated and ${funnel.paid} paying.`;

    return {
      activitySummary,
      bestChannel:
        bestPlatform && bestPlatform.engagements > 0
          ? bestPlatform.platform
          : null,
      bestTopic: input.topTopics[0] ?? null,
      bestConversationType:
        funnel.signups > 0
          ? "Problem and intent discussions"
          : funnel.engagements > 0
            ? "Too early to tell — not enough converted conversations yet"
            : null,
      bottleneck,
      bottleneckExplanation: explanation,
      recommendation: recommendationFor(bottleneck),
      nextActions: nextActionsFor(bottleneck),
    };
  }

  async analyzeExperiment(
    input: ExperimentAnalysisInput,
  ): Promise<ExperimentAnalysis> {
    const hitTarget =
      input.targetConversations > 0 &&
      input.conversations >= input.targetConversations;

    const { bottleneck, explanation } = diagnoseBottleneck({
      opportunities: input.conversations,
      engagements: input.conversations,
      profileVisits: 0,
      websiteVisits: input.websiteVisits,
      signups: input.signups,
      activations: input.activatedUsers,
      paid: input.paidUsers,
    });

    const whatHappened = `You held ${input.conversations} ${
      input.conversations === 1 ? "conversation" : "conversations"
    }${
      input.targetConversations > 0
        ? ` against a target of ${input.targetConversations}${hitTarget ? " (met)" : " (not met)"}`
        : ""
    }. Those produced ${input.websiteVisits} website ${
      input.websiteVisits === 1 ? "visit" : "visits"
    }, ${input.signups} ${input.signups === 1 ? "signup" : "signups"}, ${
      input.activatedUsers
    } activated and ${input.paidUsers} paying.`;

    return {
      whatHappened,
      interpretation: explanation,
      nextExperiment: nextExperimentFor(bottleneck, hitTarget),
      bottleneck,
    };
  }

  async analyzeLandingPage(
    input: LandingPageAnalysisInput,
  ): Promise<LandingPageAnalysis> {
    // Demo audit: illustrative only. A real provider fetches and reads the page.
    const vpLength = input.valueProposition.length;
    const icpClarity = input.primaryCustomer.length > 60 ? 55 : 40;

    const scores = {
      icpClarity,
      problemClarity: 62,
      valueProposition: vpLength > 80 ? 68 : 48,
      cta: 58,
      messaging: 60,
      socialProof: 35,
      pricingClarity: 65,
      differentiation: 45,
    };

    const weakest = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
    const labels: Record<string, string> = {
      icpClarity: "ICP clarity",
      problemClarity: "Problem clarity",
      valueProposition: "Value proposition",
      cta: "Call to action",
      messaging: "Messaging",
      socialProof: "Social proof",
      pricingClarity: "Pricing clarity",
      differentiation: "Differentiation",
    };

    return {
      scores,
      biggestIssue: `${labels[weakest[0]] ?? weakest[0]} is the weakest area.`,
      recommendation:
        weakest[0] === "socialProof"
          ? "At your stage, one specific customer sentence beats a wall of logos. Ask an existing user for a line naming the problem you removed."
          : "Narrow the headline to one specific customer segment and one problem. A visitor should know in five seconds whether the page is for them.",
      isDemoData: true,
    };
  }
}

// --- Shared diagnosis logic -------------------------------------------------

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * PRD s25: identify where the funnel actually breaks rather than defaulting to
 * blaming marketing. Checked from the bottom of the funnel upward, so a later
 * stage is only diagnosed once the stages feeding it are healthy.
 */
export function diagnoseBottleneck(funnel: {
  opportunities: number;
  engagements: number;
  profileVisits: number;
  websiteVisits: number;
  signups: number;
  activations: number;
  paid: number;
}): { bottleneck: Bottleneck; explanation: string } {
  if (funnel.engagements === 0) {
    return {
      bottleneck: "ACQUISITION",
      explanation:
        "No conversations have been logged yet, so there is nothing downstream to diagnose. Volume is the constraint right now.",
    };
  }

  if (funnel.websiteVisits === 0) {
    return {
      bottleneck: "ACQUISITION",
      explanation:
        "Conversations are happening but nobody is reaching your site. Either the conversations are with the wrong people, or nothing in them gives a reason to look you up.",
    };
  }

  if (ratio(funnel.websiteVisits, funnel.engagements) < 0.15) {
    return {
      bottleneck: "POSITIONING",
      explanation:
        "People are seeing you but very few follow through to your site. That gap usually means the value is not landing in the conversation itself.",
    };
  }

  if (funnel.signups === 0 || ratio(funnel.signups, funnel.websiteVisits) < 0.1) {
    return {
      bottleneck: "CONVERSION",
      explanation:
        "Qualified people are visiting but not signing up. The problem is on the page, not in the channel — the conversations are doing their job.",
    };
  }

  if (ratio(funnel.activations, funnel.signups) < 0.4) {
    return {
      bottleneck: "ACTIVATION",
      explanation:
        "People sign up and then stall before reaching the core value. Acquisition is working; the first-run experience is where they are lost.",
    };
  }

  if (funnel.paid === 0 && funnel.activations >= 5) {
    return {
      bottleneck: "PRODUCT",
      explanation:
        "Users are activating but none are paying. Repeated activity is producing interest without willingness to pay, which points at demand or pricing rather than marketing.",
    };
  }

  return {
    bottleneck: "ACQUISITION",
    explanation:
      "The funnel converts reasonably at every stage. The limiting factor is how many qualified people enter it, so volume is the thing to increase.",
  };
}

function recommendationFor(bottleneck: Bottleneck): string {
  switch (bottleneck) {
    case "ACQUISITION":
      return "Increase the number of high-intent conversations you join. Focus on the channel and topics that already produced your best responses, and drop low-intent activity.";
    case "POSITIONING":
      return "Tighten how you describe the problem in conversation. People should recognise their own situation in your words before they have any reason to click.";
    case "CONVERSION":
      return "Work on the landing page rather than the channel. Run the landing page analyser and fix the weakest area before adding more traffic.";
    case "ACTIVATION":
      return "Shorten the path to first value. Cut setup steps and follow up personally with the users who signed up but stalled.";
    case "PRODUCT":
      return "Talk to the activated users who did not pay. You are looking for whether the problem is worth money to them, not whether they liked the product.";
  }
}

function nextActionsFor(bottleneck: Bottleneck): string[] {
  switch (bottleneck) {
    case "ACQUISITION":
      return [
        "Review the highest-scoring open opportunities and respond to the top three",
        "Run a one-week experiment on your best-performing channel",
        "Skip opportunities scoring below 60 until volume is no longer the constraint",
      ];
    case "POSITIONING":
      return [
        "Rewrite your standard opening so it names the problem in the customer's own words",
        "Compare the conversations that led to visits against those that did not",
      ];
    case "CONVERSION":
      return [
        "Run the landing page analyser and fix the weakest area",
        "Ask three people from recent conversations what the page made them expect",
      ];
    case "ACTIVATION":
      return [
        "Map every step between signup and first value, then remove one",
        "Email the users who signed up but never activated and ask what stopped them",
      ];
    case "PRODUCT":
      return [
        "Interview five activated users who did not convert to paid",
        "Test a clearer pricing page before increasing acquisition activity",
      ];
  }
}

function nextExperimentFor(bottleneck: Bottleneck, hitTarget: boolean): string {
  const volumeNote = hitTarget
    ? "You hit your conversation target, so the volume side of this experiment worked."
    : "You did not hit your conversation target, so treat these results as directional rather than conclusive.";

  switch (bottleneck) {
    case "ACQUISITION":
      return `${volumeNote} Next, run the same play on your strongest channel only, and double the conversation target.`;
    case "POSITIONING":
      return `${volumeNote} Next, test a clearer problem statement in your replies and measure whether the visit rate per conversation improves.`;
    case "CONVERSION":
      return `${volumeNote} Next, test a clearer call to action or improve the landing page before increasing activity — more traffic will not fix this.`;
    case "ACTIVATION":
      return `${volumeNote} Next, improve onboarding before running more acquisition. You are paying to fill a funnel that leaks at the first step.`;
    case "PRODUCT":
      return `${volumeNote} Next, pause acquisition experiments and run five customer interviews focused on willingness to pay.`;
  }
}

export const PLATFORM_ORDER: Platform[] = ["REDDIT", "X", "LINKEDIN"];
