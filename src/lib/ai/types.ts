import type { Bottleneck, Platform, PromotionRisk } from "@prisma/client";

/**
 * Provider-agnostic AI contract. The mock provider satisfies it today with
 * deterministic demo analysis; a Claude or OpenAI provider can implement the
 * same interface later with no call-site changes.
 */

// --- SaaS Analyzer (PRD s6) + Channel Strategist (PRD s7) ------------------

export interface SaaSIntake {
  name: string;
  website: string;
  description: string;
  problemSolved: string;
  targetCustomer: string;
  category: string;
  pricing: string;
  currentUsers: number;
  payingUsers: number;
  businessModel: string;
  targetGeography: string;
  competitors: string;
  currentChannels: string;
  biggestProblem: string;
  marketingBudget?: string | null;
  hoursPerWeek?: number | null;
  existingAudience?: string | null;
  socialProfiles?: string | null;
}

export interface ProblemMapEntry {
  problem: string;
  relatedProblems: string[];
}

export interface SaaSAnalysis {
  productSummary: string;
  coreProblem: string;
  valueProposition: string;
  productCategory: string;

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

  analyzeSaaS(input: SaaSIntake): Promise<SaaSAnalysis>;
  recommendChannels(
    input: SaaSIntake,
    analysis: SaaSAnalysis,
  ): Promise<ChannelRecommendation[]>;
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
