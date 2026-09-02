import { daysAgo } from "../fixture-utils";
import type { CommentDTO, CommunityDTO, PostDTO } from "../types";

/** DEMO DATA — not from the LinkedIn API. */

interface FixtureComment {
  externalId: string;
  parentExternalId: string | null;
  author: string;
  body: string;
  upvotes: number;
  depth: number;
  isOp: boolean;
  ageDays: number;
}

interface FixturePost {
  externalId: string;
  communityExternalId: string;
  title: string;
  body: string;
  author: string;
  upvotes: number;
  ageDays: number;
  comments: FixtureComment[];
}

/** LinkedIn discovery is organised around professional audiences, not forums. */
export const LINKEDIN_COMMUNITIES: Omit<CommunityDTO, "isDemoData">[] = [
  {
    externalId: "support-leaders",
    name: "Customer support leaders",
    url: "https://www.linkedin.com/search/results/content/?keywords=customer%20support",
    description:
      "Heads of support and CX at small and mid-sized software companies.",
    memberCount: null,
    selfPromoRules: "strict",
    topics: [
      "customer support",
      "support tickets",
      "customer experience",
      "support team",
      "response time",
    ],
  },
  {
    externalId: "saas-founders",
    name: "SaaS founders & operators",
    url: "https://www.linkedin.com/search/results/content/?keywords=saas%20founder",
    description:
      "Founders, COOs and heads of growth at early and growth-stage SaaS companies.",
    memberCount: null,
    selfPromoRules: "strict",
    topics: [
      "saas",
      "founder",
      "growth",
      "customer acquisition",
      "product market fit",
    ],
  },
];

export const LINKEDIN_POSTS: FixturePost[] = [
  {
    externalId: "li_demo301",
    communityExternalId: "support-leaders",
    title: "Our support team is overwhelmed with repetitive tickets",
    body: "An honest post. Our support team is overwhelmed with repetitive tickets and I've been putting off addressing it for two quarters. Volume is up 60% year on year, headcount is flat. We're triaging instead of supporting. If you've been through this at a 20-50 person company, I'd genuinely value hearing what you did — and what you'd skip.",
    author: "Priya Raman · Head of Customer Experience",
    upvotes: 284,
    ageDays: 2,
    comments: [
      {
        externalId: "li_c301a",
        parentExternalId: null,
        author: "Daniel Okafor · Director of Support",
        body: "We were in exactly this position 18 months ago. The thing that actually moved the needle wasn't a tool, it was categorising six months of tickets and discovering four root causes in the product itself.",
        upvotes: 94,
        depth: 0,
        isOp: false,
        ageDays: 2,
      },
      {
        externalId: "li_c301b",
        parentExternalId: "li_c301a",
        author: "Priya Raman · Head of Customer Experience",
        body: "This is a really good point. We've never done that analysis properly — we've just been clearing the queue.",
        upvotes: 31,
        depth: 1,
        isOp: true,
        ageDays: 1,
      },
      {
        externalId: "li_c301c",
        parentExternalId: null,
        author: "Sara Lindqvist · COO",
        body: "The flat-headcount-rising-volume squeeze is the most common support failure mode I see. Deflection helps but only after you know which tickets shouldn't exist.",
        upvotes: 76,
        depth: 0,
        isOp: false,
        ageDays: 1,
      },
    ],
  },
  {
    externalId: "li_demo302",
    communityExternalId: "saas-founders",
    title: "The uncomfortable truth about our first year of customer acquisition",
    body: "We spent our first year building and assumed distribution would follow. It didn't. Sharing the numbers and what I'd do differently, because I wish someone had shown me this before I started.",
    author: "Tom Whitfield · Founder",
    upvotes: 512,
    ageDays: 5,
    comments: [
      {
        externalId: "li_c302a",
        parentExternalId: null,
        author: "Amara Nwosu · Head of Growth",
        body: "The build-first assumption is so common it should be taught as a default failure mode. Thanks for posting real numbers.",
        upvotes: 118,
        depth: 0,
        isOp: false,
        ageDays: 5,
      },
      {
        externalId: "li_c302b",
        parentExternalId: null,
        author: "Kevin Mataki · Founder",
        body: "Going through this now. Product's solid, nobody knows we exist, and I have no idea which channel to commit to. How did you eventually pick?",
        upvotes: 87,
        depth: 0,
        isOp: false,
        ageDays: 4,
      },
      {
        externalId: "li_c302c",
        parentExternalId: "li_c302b",
        author: "Tom Whitfield · Founder",
        body: "Picked the one where I could already find people describing the problem in their own words. That narrowed it to one channel very quickly.",
        upvotes: 64,
        depth: 1,
        isOp: true,
        ageDays: 4,
      },
    ],
  },
  {
    externalId: "li_demo303",
    communityExternalId: "saas-founders",
    title: "Congratulations to our team on a great quarter",
    body: "Proud of what everyone achieved this quarter. Grateful for this team and excited for what's next.",
    author: "Michael Brandt · CEO",
    upvotes: 149,
    ageDays: 14,
    comments: [
      {
        externalId: "li_c303a",
        parentExternalId: null,
        author: "Elena Fischer · VP Sales",
        body: "Well deserved!",
        upvotes: 12,
        depth: 0,
        isOp: false,
        ageDays: 14,
      },
    ],
  },
  {
    externalId: "li_demo304",
    communityExternalId: "support-leaders",
    title: "What we learned cutting first response time from 14 hours to 2",
    body: "Sharing the actual mechanics, not the highlight reel. Most of the gain came from three unglamorous changes, and one thing we tried made it worse.",
    author: "Jonas Berg · Support Operations Lead",
    upvotes: 231,
    ageDays: 9,
    comments: [
      {
        externalId: "li_c304a",
        parentExternalId: null,
        author: "Rachel Adeyemi · Customer Success Manager",
        body: "Which one made it worse? That's the part nobody ever shares.",
        upvotes: 83,
        depth: 0,
        isOp: false,
        ageDays: 9,
      },
      {
        externalId: "li_c304b",
        parentExternalId: "li_c304a",
        author: "Jonas Berg · Support Operations Lead",
        body: "Auto-responses. Cut the metric, made customers angrier. We were measuring the wrong thing.",
        upvotes: 121,
        depth: 1,
        isOp: true,
        ageDays: 8,
      },
    ],
  },
];

export function toLinkedInCommunityDTOs(): CommunityDTO[] {
  return LINKEDIN_COMMUNITIES.map((community) => ({
    ...community,
    isDemoData: true,
  }));
}

export function toLinkedInPostDTO(post: FixturePost): PostDTO {
  return {
    externalId: post.externalId,
    communityExternalId: post.communityExternalId,
    title: post.title,
    body: post.body,
    author: post.author,
    url: `https://www.linkedin.com/feed/update/urn:li:activity:${post.externalId}/`,
    upvotes: post.upvotes,
    commentCount: post.comments.length,
    createdAt: daysAgo(post.ageDays),
    isDemoData: true,
  };
}

export function toLinkedInCommentDTOs(post: FixturePost): CommentDTO[] {
  return post.comments.map((comment) => ({
    externalId: comment.externalId,
    parentExternalId: comment.parentExternalId,
    postExternalId: post.externalId,
    author: comment.author,
    body: comment.body,
    upvotes: comment.upvotes,
    depth: comment.depth,
    isOp: comment.isOp,
    createdAt: daysAgo(comment.ageDays),
  }));
}
