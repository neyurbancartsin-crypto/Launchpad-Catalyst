import { daysAgo } from "../fixture-utils";
import type { CommentDTO, CommunityDTO, PostDTO } from "../types";

/**
 * DEMO DATA — not from the Stack Exchange API.
 *
 * "Community" maps to a tag (e.g. "customer-support"), mirroring how
 * `/search/advanced?tagged=` scopes a real query. Stack Overflow's Help
 * Center explicitly prohibits promotional answers, so every fixture
 * community is modelled as strict — a deliberately conservative default.
 */

type FixtureCommunity = Omit<CommunityDTO, "isDemoData">;

interface FixtureAnswer {
  externalId: string;
  author: string;
  body: string;
  upvotes: number;
  isAccepted: boolean;
  ageDays: number;
}

interface FixtureQuestion {
  externalId: string;
  communityExternalId: string;
  title: string;
  body: string;
  author: string;
  upvotes: number;
  ageDays: number;
  answers: FixtureAnswer[];
}

export const STACKOVERFLOW_COMMUNITIES: FixtureCommunity[] = [
  {
    externalId: "customer-support",
    name: "customer-support",
    url: "https://stackoverflow.com/questions/tagged/customer-support",
    description: "Questions tagged 'customer-support' on Stack Overflow.",
    memberCount: 1_240,
    selfPromoRules: "strict",
    topics: ["customer support", "helpdesk", "support automation", "ticketing"],
  },
  {
    externalId: "chatbot",
    name: "chatbot",
    url: "https://stackoverflow.com/questions/tagged/chatbot",
    description: "Questions tagged 'chatbot' on Stack Overflow.",
    memberCount: 8_900,
    selfPromoRules: "strict",
    topics: ["chatbot", "automation", "support automation", "nlp"],
  },
  {
    externalId: "saas",
    name: "saas",
    url: "https://stackoverflow.com/questions/tagged/saas",
    description: "Questions tagged 'saas' on Stack Overflow.",
    memberCount: 2_150,
    selfPromoRules: "strict",
    topics: ["saas", "multi-tenancy", "billing", "subscription"],
  },
  {
    externalId: "webhooks",
    name: "webhooks",
    url: "https://stackoverflow.com/questions/tagged/webhooks",
    description: "Questions tagged 'webhooks' on Stack Overflow.",
    memberCount: 4_300,
    selfPromoRules: "strict",
    topics: ["webhooks", "api", "integration", "developer tools"],
  },
];

export const STACKOVERFLOW_QUESTIONS: FixtureQuestion[] = [
  {
    externalId: "so_demo601",
    communityExternalId: "customer-support",
    title: "Best pattern for detecting duplicate/repetitive support tickets programmatically?",
    body: "We get roughly 400 tickets a week and I'd guess 70% are near-duplicates of six or seven core questions. Is there a standard approach (embeddings, simple keyword clustering, something else) for flagging these automatically before they reach an agent? Not looking for a specific vendor, more the underlying technique.",
    author: "ops_marta_dev",
    upvotes: 18,
    ageDays: 4,
    answers: [
      {
        externalId: "so_a601a",
        author: "ml_pragmatist",
        body: "Sentence embeddings plus a similarity threshold against your top N historical tickets works surprisingly well and doesn't need much infra. Full ML classification is usually overkill at this volume.",
        upvotes: 14,
        isAccepted: true,
        ageDays: 4,
      },
      {
        externalId: "so_a601b",
        author: "keyword_kevin",
        body: "Before reaching for embeddings, a simple keyword/tag taxonomy on incoming tickets got us most of the way there and was much easier to explain to non-engineers on the support team.",
        upvotes: 7,
        isAccepted: false,
        ageDays: 3,
      },
    ],
  },
  {
    externalId: "so_demo602",
    communityExternalId: "webhooks",
    title: "How to reliably fan out one webhook event to multiple downstream support tools?",
    body: "We're duct-taping a helpdesk webhook to three different internal tools and it's getting fragile. Anyone have a clean pattern for a single inbound webhook that reliably fans out with retries?",
    author: "support_sceptic_dev",
    upvotes: 11,
    ageDays: 6,
    answers: [
      {
        externalId: "so_a602a",
        author: "queue_all_the_things",
        body: "Put a queue in front of it. Accept the webhook, push to a queue, let each downstream consumer pull independently with its own retry policy. Removes the fragility entirely.",
        upvotes: 9,
        isAccepted: true,
        ageDays: 5,
      },
    ],
  },
  {
    externalId: "so_demo603",
    communityExternalId: "saas",
    title: "How do early-stage SaaS teams usually track which marketing channel actually drives signups?",
    body: "Not a coding question exactly, but a technical one: what's the simplest reliable way to attribute a signup back to the specific conversation or channel that produced it, without building a full attribution platform?",
    author: "analytics_anna_dev",
    upvotes: 9,
    ageDays: 9,
    answers: [
      {
        externalId: "so_a603a",
        author: "utm_enjoyer",
        body: "UTM parameters plus a single `source` column captured at signup gets you 90% of the value most early-stage teams need. Resist building anything more sophisticated until it's actually the bottleneck.",
        upvotes: 12,
        isAccepted: true,
        ageDays: 8,
      },
      {
        externalId: "so_a603b",
        author: "growth_hank_dev",
        body: "Agreed on UTMs. The harder part in practice is getting the team to actually tag every link consistently.",
        upvotes: 5,
        isAccepted: false,
        ageDays: 8,
      },
    ],
  },
  {
    externalId: "so_demo604",
    communityExternalId: "chatbot",
    title: "Chatbot keeps deflecting tickets it shouldn't — how do you tune the confidence threshold?",
    body: "Rolled out an automated first-response bot and it's deflecting some tickets that genuinely need a human. Customers are noticing. How do teams usually tune this without just cranking the threshold up and losing all the deflection value?",
    author: "burned_by_bots_dev",
    upvotes: 15,
    ageDays: 2,
    answers: [
      {
        externalId: "so_a604a",
        author: "shipped_it_already_dev",
        body: "We track a 'deflection regret' metric — tickets the bot closed that got reopened within 24 hours — and tune threshold against that specifically, not overall deflection rate. Changed our whole approach.",
        upvotes: 11,
        isAccepted: true,
        ageDays: 1,
      },
    ],
  },
];

export function toStackOverflowCommunityDTOs(): CommunityDTO[] {
  return STACKOVERFLOW_COMMUNITIES.map((community) => ({ ...community, isDemoData: true }));
}

export function toStackOverflowPostDTO(question: FixtureQuestion): PostDTO {
  return {
    externalId: question.externalId,
    communityExternalId: question.communityExternalId,
    title: question.title,
    body: question.body,
    author: question.author,
    url: `https://stackoverflow.com/questions/${question.externalId.replace("so_demo", "")}`,
    upvotes: question.upvotes,
    commentCount: question.answers.length,
    createdAt: daysAgo(question.ageDays),
    isDemoData: true,
  };
}

export function toStackOverflowCommentDTOs(question: FixtureQuestion): CommentDTO[] {
  return question.answers.map((answer) => ({
    externalId: answer.externalId,
    parentExternalId: null, // answers reply to the question, not to each other
    postExternalId: question.externalId,
    author: answer.author,
    body: answer.isAccepted ? `[Accepted answer] ${answer.body}` : answer.body,
    upvotes: answer.upvotes,
    depth: 0,
    isOp: false, // the question asker does not author their own answers
    createdAt: daysAgo(answer.ageDays),
  }));
}
