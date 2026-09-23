import type { Bottleneck, Platform, PromotionRisk } from "@prisma/client";

/**
 * Provider-agnostic AI contract. The mock provider satisfies it today with
 * deterministic demo analysis; a Claude or OpenAI provider can implement the
 * same interface later with no call-site changes.
 */

// --- SaaS Analyzer (PRD s6) + Channel Strategist (PRD s7) ------------------

/**
 * The founder answers only these — two required, two optional. Everything
 * that used to be asked directly (name, category, pricing, business model,
 * geography, competitors, current channels, acquisition problem) is now
 * inferred by the AI analysis instead; see SaaSAnalysis below.
 */
export interface SaaSIntake {
  description: string;
  problemSolved: string;
  targetCustomer?: string | null;
  website?: string | null;
}

export interface ProblemMapEntry {
  problem: string;
  relatedProblems: string[];
}

export interface KeywordSynonymEntry {
  keyword: string;
  synonyms: string[];
}

export interface SaaSAnalysis {
  /** Inferred when the founder didn't give one explicitly. */
  productName: string;
  productSummary: string;
  coreProblem: string;
  valueProposition: string;
  productCategory: string;
  /** "B2B" | "B2C" | "B2B2C" — inferred, not asked for directly. */
  businessModel: string;
  /** Inferred likely competitors/alternatives; may be empty. */
  likelyCompetitors: string[];

  primaryCustomer: string;
  secondaryCustomer: string;
  roles: string[];
  industries: string[];
  companySize: string;
  painPoints: string[];
  buyingTriggers: string[];
  objections: string[];

  problemMap: ProblemMapEntry[];
  searchTopics: string[];
  intentSignals: string[];

  /**
   * Search intelligence (additive to searchTopics/intentSignals above, not a
   * replacement): specific problem-shaped phrases a real person would
   * actually type, e.g. "unpaid invoice" rather than just "invoice" —
   * consumed by `lib/search/build-query.ts`, not the raw platform adapters.
   */
  positiveKeywords: string[];
  /** Variations/wording of a positive keyword, e.g. "unpaid invoice" -> ["overdue invoice", "outstanding invoice"]. */
  keywordSynonyms: KeywordSynonymEntry[];
  /** Phrases that should exclude a conversation even if it matches positively elsewhere. */
  negativeKeywords: string[];
}

export interface SaaSAnalysisWithChannels {
  analysis: SaaSAnalysis;
  channels: ChannelRecommendation[];
}

export interface ChannelRecommendation {
  platform: Platform;
  fitScore: number; // 0-10 (PRD s7)
  priority: "High" | "Medium" | "Low";
  whyItFits: string;
  whoToFind: string;
  topicsToTarget: string;
  conversationsToJoin: string;
  actionToTake: string;
}

// --- Conversation Analyzer (PRD s10) ---------------------------------------

export interface CommentAnalysis {
  commentExternalId: string;
  icpMatch: "High" | "Medium" | "Low";
  problemExpressed: boolean;
  intent: "High" | "Medium" | "Low" | "None";
  worthResponding: boolean;
  reason: string;
}

export interface ConversationAnalysisInput {
  postTitle: string;
  postBody: string;
  comments: {
    externalId: string;
    author: string;
    body: string;
    upvotes: number;
    isOp: boolean;
  }[];
  icpKeywords: string[];
  intentSignals: string[];
}

// --- Opportunity Scorer (PRD s15-17) ---------------------------------------

export interface OpportunityScoringInput {
  title: string;
  content: string;
  communityName: string;
  /** What the community is actually about; feeds the relevance component. */
  communityTopics: string[];
  selfPromoRules: "strict" | "moderate" | "lenient";
  upvotes: number;
  commentCount: number;
  postedAt: Date;
  icpKeywords: string[];
  problemKeywords: string[];
  intentSignals: string[];
  productCategory: string;
  competitors: string[];
}

export interface OpportunityAssessment {
  icpScore: number;
  problemScore: number;
  intentScore: number;
  recencyScore: number;
  relevanceScore: number;
  engagementScore: number;
  opportunityScore: number;
  priorityBand: "HIGH" | "REVIEW" | "LOW" | "DEPRIORITISE";
  promotionRisk: PromotionRisk;
  promotionRiskReason: string;
  recommendedAction: string;
  actionRationale: string;
}

// --- Response Copilot (PRD s18) --------------------------------------------

export type ResponseStyle =
  | "helpful"
  | "conversational"
  | "short"
  | "detailed"
  | "technical"
  | "experience-based";

export interface ResponseGenerationInput {
  style: ResponseStyle;
  productName: string;
  productSummary: string;
  valueProposition: string;
  postTitle: string;
  postBody: string;
  targetComment?: string | null;
  communityName: string;
  platform: Platform;
  recommendedAction: string;
  promotionRisk: PromotionRisk;
  /** Explicit founder opt-in; never inferred. */
  allowProductMention: boolean;
}

export interface ResponseDraft {
  draft: string;
  mentionsProduct: boolean;
  guidanceNote: string;
}

// --- Growth Analyst (PRD s23-25) -------------------------------------------

export interface FunnelCounts {
  opportunities: number;
  engagements: number;
  profileVisits: number;
  websiteVisits: number;
  signups: number;
  activations: number;
  paid: number;
}

export interface GrowthAnalysisInput {
  periodStart: Date;
  periodEnd: Date;
  funnel: FunnelCounts;
  perPlatform: { platform: Platform; engagements: number; signups: number }[];
  topTopics: string[];
  conversationsStarted: number;
  responsesPosted: number;
}

export interface GrowthAnalysis {
  activitySummary: string;
  bestChannel: Platform | null;
  bestTopic: string | null;
  bestConversationType: string | null;
  bottleneck: Bottleneck;
  bottleneckExplanation: string;
  recommendation: string;
  nextActions: string[];
}

export interface ExperimentAnalysisInput {
  hypothesis: string;
  action: string;
  targetConversations: number;
  conversations: number;
  websiteVisits: number;
  signups: number;
  activatedUsers: number;
  paidUsers: number;
}

export interface ExperimentAnalysis {
  whatHappened: string;
  interpretation: string;
  nextExperiment: string;
  bottleneck: Bottleneck;
}

// --- Landing Page Analyzer (PRD s26) ---------------------------------------

export interface LandingPageAnalysisInput {
  url: string;
  productName: string;
  valueProposition: string;
  primaryCustomer: string;
}

export interface LandingPageAnalysis {
  scores: {
    icpClarity: number;
    problemClarity: number;
    valueProposition: number;
    cta: number;
    messaging: number;
    socialProof: number;
    pricingClarity: number;
    differentiation: number;
  };
  biggestIssue: string;
  recommendation: string;
  /** True when the audit is illustrative rather than a real page fetch. */
  isDemoData: boolean;
}

// --- Provider ---------------------------------------------------------------

export interface AIProvider {
  readonly id: string;
  /** True when outputs are demo analysis rather than a live model. */
  readonly isDemoProvider: boolean;

  /**
   * The SaaS Analyzer and Channel Strategist combined into a single call —
   * channel fit doesn't need the analyzer's own structured output restated
   * back into a second prompt, so one pass over the founder's (minimal)
   * intake produces both the full product/ICP understanding and channel
   * recommendations together.
   */
  analyzeSaaSWithChannels(input: SaaSIntake): Promise<SaaSAnalysisWithChannels>;
  analyzeConversation(
    input: ConversationAnalysisInput,
  ): Promise<CommentAnalysis[]>;
  scoreOpportunity(
    input: OpportunityScoringInput,
  ): Promise<OpportunityAssessment>;
  generateResponse(input: ResponseGenerationInput): Promise<ResponseDraft>;
  analyzeGrowth(input: GrowthAnalysisInput): Promise<GrowthAnalysis>;
  analyzeExperiment(
    input: ExperimentAnalysisInput,
  ): Promise<ExperimentAnalysis>;
  analyzeLandingPage(
    input: LandingPageAnalysisInput,
  ): Promise<LandingPageAnalysis>;
}
