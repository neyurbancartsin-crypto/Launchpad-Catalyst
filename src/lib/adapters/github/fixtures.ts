import { daysAgo } from "../fixture-utils";
import type { CommentDTO, CommunityDTO, PostDTO } from "../types";

/**
 * DEMO DATA — not from the GitHub API.
 *
 * "Community" maps to a repository here: the natural grouping GitHub's own
 * search offers (`repo:owner/name`). Threads span the same acquisition/
 * support/activation themes as the other platform fixtures so scoring
 * produces a genuine spread against a founder's real ICP keywords.
 */

type FixtureCommunity = Omit<CommunityDTO, "isDemoData">;

interface FixtureComment {
  externalId: string;
  author: string;
  body: string;
  upvotes: number;
  isOp: boolean;
  ageDays: number;
}

interface FixtureIssue {
  externalId: string; // "owner/repo#number"
  communityExternalId: string; // "owner/repo"
  title: string;
  body: string;
  author: string;
  upvotes: number;
  ageDays: number;
  comments: FixtureComment[];
}

export const GITHUB_COMMUNITIES: FixtureCommunity[] = [
  {
    externalId: "zendesk/zendesk_api_client_rb",
    name: "zendesk/zendesk_api_client_rb",
    url: "https://github.com/zendesk/zendesk_api_client_rb",
    description:
      "Official Ruby client for the Zendesk API. Issues frequently discuss ticket automation and workflow pain points, not just bugs.",
    memberCount: 312,
    selfPromoRules: "moderate",
    topics: ["customer support", "helpdesk", "support automation", "zendesk", "api"],
  },
  {
    externalId: "chatwoot/chatwoot",
    name: "chatwoot/chatwoot",
    url: "https://github.com/chatwoot/chatwoot",
    description:
      "Open-source customer engagement suite. Issues and discussions include real operators describing support workload and tooling gaps.",
    memberCount: 1240,
    selfPromoRules: "lenient",
    topics: [
      "customer support",
      "support tickets",
      "helpdesk",
      "support automation",
      "open source",
    ],
  },
  {
    externalId: "vercel/next.js",
    name: "vercel/next.js",
    url: "https://github.com/vercel/next.js",
    description:
      "The Next.js framework. High-traffic issue tracker; occasional threads touch on team workflow and tooling beyond pure framework bugs.",
    memberCount: 4300,
    selfPromoRules: "strict",
    topics: ["saas", "developer tools", "framework", "deployment"],
  },
  {
    externalId: "supabase/supabase",
    name: "supabase/supabase",
    url: "https://github.com/supabase/supabase",
    description:
      "Open-source Firebase alternative. Discussions include founders comparing backend tooling and describing scaling pain points.",
    memberCount: 980,
    selfPromoRules: "moderate",
    topics: ["saas", "database", "backend", "startups", "developer tools"],
  },
];

export const GITHUB_ISSUES: FixtureIssue[] = [
  {
    externalId: "zendesk/zendesk_api_client_rb#412",
    communityExternalId: "zendesk/zendesk_api_client_rb",
    title: "Looking for a way to auto-close repetitive tickets before they reach an agent",
    body: "We're on the Zendesk API trying to build our own deflection layer because 70% of our tickets are the same six billing questions. Is there a recommended pattern for this, or is everyone just hand-rolling macros? Feels like there should be a better way in 2026.",
    author: "ops-marta",
    upvotes: 14,
    ageDays: 3,
    comments: [
      {
        externalId: "ic_gh_401a",
        author: "helpdesk-jo",
        body: "We hand-rolled macros for a year before giving up. A proper knowledge base plus deflection on the top 10 questions did more than any API automation we tried.",
        upvotes: 9,
        isOp: false,
        ageDays: 3,
      },
      {
        externalId: "ic_gh_401b",
        author: "ops-marta",
        body: "That matches what I'm seeing elsewhere too. Might be a documentation problem more than a tooling one.",
        upvotes: 4,
        isOp: true,
        ageDays: 2,
      },
    ],
  },
  {
    externalId: "chatwoot/chatwoot#5821",
    communityExternalId: "chatwoot/chatwoot",
    title: "Feature request: bulk macro suggestions based on repeated ticket content",
    body: "Two-person support team here, self-hosting Chatwoot. We keep answering the same handful of questions and I'd love the system to suggest a macro when it detects a repeated pattern instead of us building one manually each time.",
    author: "support-sceptic",
    upvotes: 22,
    ageDays: 6,
    comments: [
      {
        externalId: "ic_gh_402a",
        author: "maintainer-dee",
        body: "This is a reasonable ask. In the meantime, tagging conversations consistently makes it much easier to spot the patterns manually — worth doing regardless of tooling.",
        upvotes: 11,
        isOp: false,
        ageDays: 5,
      },
      {
        externalId: "ic_gh_402b",
        author: "founder-ricky",
        body: "Following this closely. I'm the founder still doing support myself and it's eating my mornings.",
        upvotes: 8,
        isOp: false,
        ageDays: 4,
      },
    ],
  },
  {
    externalId: "supabase/supabase#9930",
    communityExternalId: "supabase/supabase",
    title: "How are people handling customer acquisition for a dev-tools SaaS built on Supabase?",
    body: "Not a bug report, sorry — genuinely don't know where else to ask. Shipped three weeks ago, product works, zero signups from strangers. Anyone here have a repeatable way to find early users for something backend/dev-tools flavoured?",
    author: "quiet-launch",
    upvotes: 31,
    ageDays: 2,
    comments: [
      {
        externalId: "ic_gh_403a",
        author: "growth-hank",
        body: "Answering questions in relevant repos and forums beats posting about your product directly. This very thread is a decent example of the right way to do it.",
        upvotes: 17,
        isOp: false,
        ageDays: 2,
      },
      {
        externalId: "ic_gh_403b",
        author: "tired-bootstrapper",
        body: "Struggling with exactly this. Feels like every channel needs its own playbook and nobody tells you which one first.",
        upvotes: 6,
        isOp: false,
        ageDays: 1,
      },
    ],
  },
  {
    externalId: "vercel/next.js#68210",
    communityExternalId: "vercel/next.js",
    title: "Discussion: recommended patterns for internal admin dashboards at scale",
    body: "Curious how larger teams structure their internal tooling built on Next.js — feels increasingly like its own discipline. Not looking for a library pitch, more interested in real-world patterns.",
    author: "positioning-pat",
    upvotes: 48,
    ageDays: 11,
    comments: [
      {
        externalId: "ic_gh_404a",
        author: "cro-chris",
        body: "We split ours into a separate app entirely once it grew past a few dashboards. Sharing auth was the only hard part.",
        upvotes: 19,
        isOp: false,
        ageDays: 10,
      },
    ],
  },
];

export function toGitHubCommunityDTOs(): CommunityDTO[] {
  return GITHUB_COMMUNITIES.map((community) => ({ ...community, isDemoData: true }));
}

export function toGitHubPostDTO(issue: FixtureIssue): PostDTO {
  const [owner, rest] = issue.externalId.split("/");
  const [repo, number] = rest.split("#");
  return {
    externalId: issue.externalId,
    communityExternalId: issue.communityExternalId,
    title: issue.title,
    body: issue.body,
    author: issue.author,
    url: `https://github.com/${owner}/${repo}/issues/${number}`,
    upvotes: issue.upvotes,
    commentCount: issue.comments.length,
    createdAt: daysAgo(issue.ageDays),
    isDemoData: true,
  };
}

export function toGitHubCommentDTOs(issue: FixtureIssue): CommentDTO[] {
  return issue.comments.map((comment) => ({
    externalId: comment.externalId,
    parentExternalId: null, // GitHub issue comments are a flat timeline, not threaded
    postExternalId: issue.externalId,
    author: comment.author,
    body: comment.body,
    upvotes: comment.upvotes,
    depth: 0,
    isOp: comment.isOp,
    createdAt: daysAgo(comment.ageDays),
  }));
}
