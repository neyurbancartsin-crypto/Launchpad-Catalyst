import { daysAgo } from "../fixture-utils";
import type { CommentDTO, CommunityDTO, PostDTO } from "../types";

/**
 * DEMO DATA — not from the Hacker News API.
 *
 * Hacker News has no sub-community concept like a subreddit or a repo — it is
 * one flat stream. "Community" here means a fixed discovery category (PRD
 * request): Front Page, Ask HN, Show HN. Show HN is culturally the one place
 * where mentioning your own product is the entire point of the category, so
 * it is modelled as lenient while the other two stay strict — matching HN's
 * actual guidelines against unsolicited self-promotion in comments.
 */

type FixtureCommunity = Omit<CommunityDTO, "isDemoData">;

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

interface FixtureStory {
  externalId: string;
  communityExternalId: string; // "front_page" | "ask_hn" | "show_hn"
  title: string;
  body: string;
  author: string;
  upvotes: number;
  ageDays: number;
  comments: FixtureComment[];
}

export const HACKERNEWS_COMMUNITIES: FixtureCommunity[] = [
  {
    externalId: "front_page",
    name: "Hacker News — Front Page",
    url: "https://news.ycombinator.com/",
    description:
      "Whatever the community has upvoted to the top. Broad audience of engineers, founders and operators.",
    memberCount: null,
    selfPromoRules: "strict",
    topics: ["startups", "saas", "engineering", "product"],
  },
  {
    externalId: "ask_hn",
    name: "Ask HN",
    url: "https://news.ycombinator.com/ask",
    description:
      "Founders and engineers asking the community direct questions — high concentration of genuine problem statements.",
    memberCount: null,
    selfPromoRules: "strict",
    topics: ["advice", "startups", "customer acquisition", "hiring", "tooling"],
  },
  {
    externalId: "show_hn",
    name: "Show HN",
    url: "https://news.ycombinator.com/show",
    description:
      "Founders sharing something they built. The one HN category where mentioning your own product is exactly the point.",
    memberCount: null,
    selfPromoRules: "lenient",
    topics: ["launch", "side project", "indie hacking", "saas", "first customers"],
  },
];

export const HACKERNEWS_STORIES: FixtureStory[] = [
  {
    externalId: "hn_demo501",
    communityExternalId: "ask_hn",
    title: "Ask HN: How do you find your first 10 customers without an audience?",
    body: "Shipped a B2B tool three weeks ago. Product works, but I have zero signups from strangers and no idea where to even look. What actually worked for you, concretely, not the usual 'talk to users' advice?",
    author: "quiet_launch",
    upvotes: 187,
    ageDays: 2,
    comments: [
      {
        externalId: "hn_c501a",
        parentExternalId: null,
        author: "growth_hank",
        body: "Answer questions where your exact customer already hangs out, don't post about your product. This thread is a decent example of the right instinct.",
        upvotes: 64,
        depth: 0,
        isOp: false,
        ageDays: 2,
      },
      {
        externalId: "hn_c501b",
        parentExternalId: null,
        author: "tired_bootstrapper",
        body: "I've tried this on a few forums and it converts at basically zero. Genuinely wondering if it's the channel or the offer.",
        upvotes: 41,
        depth: 0,
        isOp: false,
        ageDays: 1,
      },
      {
        externalId: "hn_c501c",
        parentExternalId: "hn_c501b",
        author: "quiet_launch",
        body: "This is what I keep running into too. Hard to tell which lever to pull first.",
        upvotes: 9,
        depth: 1,
        isOp: true,
        ageDays: 1,
      },
    ],
  },
  {
    externalId: "hn_demo502",
    communityExternalId: "ask_hn",
    title: "Ask HN: Repetitive support tickets are eating my week — what actually helped?",
    body: "Two-person team, 400 tickets a week, 70% are the same six questions. Not looking for a vendor pitch in the replies — genuinely asking what changed the math for you.",
    author: "ops_marta",
    upvotes: 143,
    ageDays: 1,
    comments: [
      {
        externalId: "hn_c502a",
        parentExternalId: null,
        author: "helpdesk_jo",
        body: "Categorising a week of tickets by root cause did more than any tool we bought afterwards. Turned out three product issues caused half the volume.",
        upvotes: 58,
        depth: 0,
        isOp: false,
        ageDays: 1,
      },
      {
        externalId: "hn_c502b",
        parentExternalId: null,
        author: "founder_ricky",
        body: "I'm the founder still doing support myself and it is absolutely eating my ability to build anything else.",
        upvotes: 33,
        depth: 0,
        isOp: false,
        ageDays: 0,
      },
    ],
  },
  {
    externalId: "hn_demo503",
    communityExternalId: "show_hn",
    title: "Show HN: A tool that finds relevant support-automation conversations for founders",
    body: "Built this after spending too many evenings manually searching Reddit and HN for people describing the exact problem my product solves. It scores conversations by ICP fit and intent, and drafts a value-first reply. Would love brutal feedback.",
    author: "sidequest_dev",
    upvotes: 96,
    ageDays: 4,
    comments: [
      {
        externalId: "hn_c503a",
        parentExternalId: null,
        author: "candid_carl",
        body: "The scoring breakdown is the right call — most tools like this feel like a black box. What stops it from encouraging spam at scale?",
        upvotes: 27,
        depth: 0,
        isOp: false,
        ageDays: 4,
      },
      {
        externalId: "hn_c503b",
        parentExternalId: "hn_c503a",
        author: "sidequest_dev",
        body: "Fair question — it deliberately never posts anything itself, and flags high self-promotion-risk threads so you don't pitch where it isn't welcome.",
        upvotes: 19,
        depth: 1,
        isOp: true,
        ageDays: 3,
      },
      {
        externalId: "hn_c503c",
        parentExternalId: null,
        author: "lurker_turned_builder",
        body: "Congrats on shipping. Curious what the false-positive rate looks like once you've run it for a month.",
        upvotes: 12,
        depth: 0,
        isOp: false,
        ageDays: 3,
      },
    ],
  },
  {
    externalId: "hn_demo504",
    communityExternalId: "front_page",
    title: "Why most SaaS landing pages fail to say who they're for",
    body: "Reviewed twenty landing pages this week. Seventeen could describe any product in any category. If a visitor can't tell it's for them in five seconds, the page has already lost.",
    author: "positioning_pat",
    upvotes: 412,
    ageDays: 8,
    comments: [
      {
        externalId: "hn_c504a",
        parentExternalId: null,
        author: "copy_colin",
        body: "The boring 'for X who need Y' formula keeps winning because it works, not because it's clever.",
        upvotes: 88,
        depth: 0,
        isOp: false,
        ageDays: 8,
      },
      {
        externalId: "hn_c504b",
        parentExternalId: null,
        author: "skeptical_steve",
        body: "Do you have data tying this to conversion, or is it a vibe-based critique?",
        upvotes: 34,
        depth: 0,
        isOp: false,
        ageDays: 7,
      },
    ],
  },
  {
    externalId: "hn_demo505",
    communityExternalId: "front_page",
    title: "The unglamorous four years behind a $10k MRR SaaS",
    body: "No funding, no viral moment, just answering questions in two niche communities for years. Sharing the numbers because most posts about this skip the boring middle.",
    author: "slow_and_steady_sam",
    upvotes: 356,
    ageDays: 15,
    comments: [
      {
        externalId: "hn_c505a",
        parentExternalId: null,
        author: "curious_cat_99",
        body: "What was the actual split between the two communities you mention?",
        upvotes: 41,
        depth: 0,
        isOp: false,
        ageDays: 15,
      },
    ],
  },
];

export function toHackerNewsCommunityDTOs(): CommunityDTO[] {
  return HACKERNEWS_COMMUNITIES.map((community) => ({ ...community, isDemoData: true }));
}

export function toHackerNewsPostDTO(story: FixtureStory): PostDTO {
  return {
    externalId: story.externalId,
    communityExternalId: story.communityExternalId,
    title: story.title,
    body: story.body,
    author: story.author,
    url: `https://news.ycombinator.com/item?id=${story.externalId.replace("hn_demo", "")}`,
    upvotes: story.upvotes,
    commentCount: story.comments.length,
    createdAt: daysAgo(story.ageDays),
    isDemoData: true,
  };
}

export function toHackerNewsCommentDTOs(story: FixtureStory): CommentDTO[] {
  return story.comments.map((comment) => ({
    externalId: comment.externalId,
    parentExternalId: comment.parentExternalId,
    postExternalId: story.externalId,
    author: comment.author,
    body: comment.body,
    upvotes: comment.upvotes,
    depth: comment.depth,
    isOp: comment.isOp,
    createdAt: daysAgo(comment.ageDays),
  }));
}
