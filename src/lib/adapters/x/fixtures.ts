import { daysAgo } from "../fixture-utils";
import type { CommentDTO, CommunityDTO, PostDTO } from "../types";

/** DEMO DATA — not from the X API. */

interface FixtureReply {
  externalId: string;
  author: string;
  body: string;
  upvotes: number;
  depth: number;
  isOp: boolean;
  ageDays: number;
  parentExternalId: string | null;
}

interface FixturePost {
  externalId: string;
  communityExternalId: string;
  title: string;
  body: string;
  author: string;
  upvotes: number;
  ageDays: number;
  replies: FixtureReply[];
}

/** X has no subreddit equivalent; topics stand in as the discovery surface. */
export const X_COMMUNITIES: Omit<CommunityDTO, "isDemoData">[] = [
  {
    externalId: "build-in-public",
    name: "#buildinpublic",
    url: "https://x.com/search?q=%23buildinpublic",
    description:
      "Founders sharing progress, metrics and problems openly. High volume of early-stage discussion.",
    memberCount: null,
    selfPromoRules: "lenient",
    topics: [
      "build in public",
      "saas",
      "mrr",
      "solo founder",
      "launch",
      "first customers",
    ],
  },
  {
    externalId: "customer-support",
    name: "Customer support & CX",
    url: "https://x.com/search?q=customer%20support%20tickets",
    description:
      "Support leaders and operators discussing ticket volume, tooling and response times.",
    memberCount: null,
    selfPromoRules: "moderate",
    topics: [
      "customer support",
      "support tickets",
      "response time",
      "helpdesk",
      "support automation",
    ],
  },
  {
    externalId: "saas-growth",
    name: "SaaS growth",
    url: "https://x.com/search?q=saas%20growth",
    description:
      "Growth, acquisition and retention discussion among SaaS operators.",
    memberCount: null,
    selfPromoRules: "moderate",
    topics: ["saas", "growth", "churn", "customer acquisition", "activation"],
  },
];

export const X_POSTS: FixturePost[] = [
  {
    externalId: "x_demo201",
    communityExternalId: "customer-support",
    title: "Four hours a day on repetitive customer questions",
    body: "We're spending 4 hours every single day answering the same repetitive customer questions. Two-person team. This is not sustainable and I don't know what the fix is that doesn't cost us $2k/mo.",
    author: "@marta_ops",
    upvotes: 342,
    ageDays: 1,
    replies: [
      {
        externalId: "x_r201a",
        parentExternalId: null,
        author: "@support_sage",
        body: "What percentage is genuinely the same question vs just similar? That ratio decides whether tooling helps or not.",
        upvotes: 41,
        depth: 0,
        isOp: false,
        ageDays: 1,
      },
      {
        externalId: "x_r201b",
        parentExternalId: "x_r201a",
        author: "@marta_ops",
        body: "Honestly? Six questions cover about 70% of everything.",
        upvotes: 28,
        depth: 1,
        isOp: true,
        ageDays: 1,
      },
      {
        externalId: "x_r201c",
        parentExternalId: null,
        author: "@bootstrapped_bea",
        body: "Same boat. Founder doing support is the tax nobody warns you about.",
        upvotes: 67,
        depth: 0,
        isOp: false,
        ageDays: 0,
      },
    ],
  },
  {
    externalId: "x_demo202",
    communityExternalId: "build-in-public",
    title: "Month 3: 40 signups, 2 paying. What am I doing wrong?",
    body: "Shipped in June. 40 signups, 2 converted. Everyone says 'talk to your users' but half of them never even finished onboarding so there's nobody to talk to. How do you get past this stage?",
    author: "@shipping_sol",
    upvotes: 218,
    ageDays: 3,
    replies: [
      {
        externalId: "x_r202a",
        parentExternalId: null,
        author: "@activation_ana",
        body: "Talk to the 38 who didn't convert, not the 2 who did. The churned tell you more.",
        upvotes: 89,
        depth: 0,
        isOp: false,
        ageDays: 3,
      },
      {
        externalId: "x_r202b",
        parentExternalId: null,
        author: "@candid_carl",
        body: "2/40 is 5% which honestly isn't terrible for month 3. Your problem might be volume, not conversion.",
        upvotes: 54,
        depth: 0,
        isOp: false,
        ageDays: 2,
      },
    ],
  },
  {
    externalId: "x_demo203",
    communityExternalId: "saas-growth",
    title: "Looking for a better way to find relevant conversations",
    body: "Anyone using something decent to surface conversations where people describe the problem you solve? Manual searching is eating my week and I'm clearly missing most of it.",
    author: "@growth_gav",
    upvotes: 127,
    ageDays: 2,
    replies: [
      {
        externalId: "x_r203a",
        parentExternalId: null,
        author: "@tooling_tam",
        body: "Saved searches plus discipline. Every tool I've tried optimises for volume when the problem is judgement.",
        upvotes: 46,
        depth: 0,
        isOp: false,
        ageDays: 2,
      },
      {
        externalId: "x_r203b",
        parentExternalId: null,
        author: "@no_spam_nia",
        body: "Whatever you pick, please don't turn it into a reply bot. You can tell instantly and it poisons the well for everyone.",
        upvotes: 71,
        depth: 0,
        isOp: false,
        ageDays: 1,
      },
    ],
  },
  {
    externalId: "x_demo204",
    communityExternalId: "build-in-public",
    title: "Hot take: most SaaS landing pages don't say who they're for",
    body: "Been reviewing 20 landing pages this week. Seventeen of them could describe any product in any category. If I can't tell whether it's for me in five seconds, you've lost.",
    author: "@positioning_pia",
    upvotes: 476,
    ageDays: 8,
    replies: [
      {
        externalId: "x_r204a",
        parentExternalId: null,
        author: "@copy_colin",
        body: "The 'for X who Y' formula is boring and it works. Boring and works beats clever and vague.",
        upvotes: 98,
        depth: 0,
        isOp: false,
        ageDays: 8,
      },
      {
        externalId: "x_r204b",
        parentExternalId: null,
        author: "@founder_fi",
        body: "Guilty. Just rewrote ours after reading this.",
        upvotes: 34,
        depth: 0,
        isOp: false,
        ageDays: 7,
      },
    ],
  },
  {
    externalId: "x_demo205",
    communityExternalId: "saas-growth",
    title: "Our conference booth ROI thread",
    body: "Breaking down what we spent at three conferences this year and what came back. Long thread.",
    author: "@events_eli",
    upvotes: 203,
    ageDays: 21,
    replies: [
      {
        externalId: "x_r205a",
        parentExternalId: null,
        author: "@budget_ben",
        body: "Curious how you attributed pipeline to the booth specifically.",
        upvotes: 27,
        depth: 0,
        isOp: false,
        ageDays: 21,
      },
    ],
  },
];

export function toXCommunityDTOs(): CommunityDTO[] {
  return X_COMMUNITIES.map((community) => ({ ...community, isDemoData: true }));
}

export function toXPostDTO(post: FixturePost): PostDTO {
  return {
    externalId: post.externalId,
    communityExternalId: post.communityExternalId,
    title: post.title,
    body: post.body,
    author: post.author,
    url: `https://x.com/${post.author.replace("@", "")}/status/${post.externalId}`,
    upvotes: post.upvotes,
    commentCount: post.replies.length,
    createdAt: daysAgo(post.ageDays),
    isDemoData: true,
  };
}

export function toXCommentDTOs(post: FixturePost): CommentDTO[] {
  return post.replies.map((reply) => ({
    externalId: reply.externalId,
    parentExternalId: reply.parentExternalId,
    postExternalId: post.externalId,
    author: reply.author,
    body: reply.body,
    upvotes: reply.upvotes,
    depth: reply.depth,
    isOp: reply.isOp,
    createdAt: daysAgo(reply.ageDays),
  }));
}
