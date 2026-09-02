import { daysAgo } from "../fixture-utils";
import type { CommentDTO, CommunityDTO, PostDTO } from "../types";

/**
 * DEMO DATA — not from the Reddit API.
 *
 * Threads span the themes early-stage SaaS founders actually discuss
 * (acquisition, support load, activation, churn, pricing, dev tooling) so that
 * scoring against a founder's real ICP keywords produces a genuine spread of
 * high- and low-value opportunities rather than uniformly perfect matches.
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

export const REDDIT_COMMUNITIES: FixtureCommunity[] = [
  {
    externalId: "SaaS",
    name: "r/SaaS",
    url: "https://www.reddit.com/r/SaaS/",
    description:
      "Founders and operators building software-as-a-service businesses. Heavy on growth, pricing and early traction discussion.",
    memberCount: 312_000,
    selfPromoRules: "moderate",
    topics: [
      "saas",
      "pricing",
      "churn",
      "customer acquisition",
      "first customers",
      "mrr",
      "onboarding",
    ],
  },
  {
    externalId: "startups",
    name: "r/startups",
    url: "https://www.reddit.com/r/startups/",
    description:
      "Early-stage startup discussion. Strict rules against self-promotion and link dropping.",
    memberCount: 1_800_000,
    selfPromoRules: "strict",
    topics: [
      "startups",
      "traction",
      "fundraising",
      "go to market",
      "customer acquisition",
      "product market fit",
    ],
  },
  {
    externalId: "Entrepreneur",
    name: "r/Entrepreneur",
    url: "https://www.reddit.com/r/Entrepreneur/",
    description:
      "Broad entrepreneurship community. Mixed audience of software and non-software businesses.",
    memberCount: 4_100_000,
    selfPromoRules: "strict",
    topics: ["business", "marketing", "sales", "entrepreneurship", "growth"],
  },
  {
    externalId: "CustomerSuccess",
    name: "r/CustomerSuccess",
    url: "https://www.reddit.com/r/CustomerSuccess/",
    description:
      "Customer success and support professionals discussing tooling, workflow and team scaling.",
    memberCount: 41_000,
    selfPromoRules: "moderate",
    topics: [
      "customer support",
      "support tickets",
      "helpdesk",
      "customer success",
      "response time",
      "support automation",
    ],
  },
  {
    externalId: "indiehackers",
    name: "r/indiehackers",
    url: "https://www.reddit.com/r/indiehackers/",
    description:
      "Bootstrapped and solo founders shipping products. Tolerant of relevant product mentions when they answer the question.",
    memberCount: 96_000,
    selfPromoRules: "lenient",
    topics: [
      "bootstrapping",
      "indie hacking",
      "side project",
      "first customers",
      "launch",
      "solo founder",
    ],
  },
];

export const REDDIT_POSTS: FixturePost[] = [
  {
    externalId: "t3_demo101",
    communityExternalId: "SaaS",
    title:
      "I launched my SaaS but still have zero users. How do I get my first customers?",
    body: "Been building for eight months, finally shipped three weeks ago. Product works, a few friends said it's useful, but I have literally zero signups from strangers. I have no audience and no budget. I don't know where my customers even hang out. What actually worked for you to get the first ten?",
    author: "u/quiet_launch",
    upvotes: 214,
    ageDays: 2,
    comments: [
      {
        externalId: "t1_d101a",
        parentExternalId: null,
        author: "u/ph_veteran",
        body: "Product Hunt gave us a spike but almost none of it stuck. Treat it as a one-day event, not a channel.",
        upvotes: 68,
        depth: 0,
        isOp: false,
        ageDays: 2,
      },
      {
        externalId: "t1_d101b",
        parentExternalId: null,
        author: "u/tired_bootstrapper",
        body: "I've tried Reddit but nobody converts. I post in the right subreddits, get some upvotes, and then nothing. Struggling with exactly this and it's demoralising.",
        upvotes: 52,
        depth: 0,
        isOp: false,
        ageDays: 1,
      },
      {
        externalId: "t1_d101c",
        parentExternalId: "t1_d101b",
        author: "u/growth_hank",
        body: "Are you posting about your product or answering questions? Massive difference. The second one works, the first one gets you ignored.",
        upvotes: 44,
        depth: 1,
        isOp: false,
        ageDays: 1,
      },
      {
        externalId: "t1_d101d",
        parentExternalId: null,
        author: "u/sam_builds",
        body: "How are people getting their first 10 customers in 2026? Cold email is dead for us, ads are too expensive at our price point. Genuinely looking for what tool or process people use to find the right conversations.",
        upvotes: 39,
        depth: 0,
        isOp: false,
        ageDays: 1,
      },
      {
        externalId: "t1_d101e",
        parentExternalId: null,
        author: "u/quiet_launch",
        body: "This is helpful, thanks. To be clear I'm not looking for a growth hack, I just don't know where to spend the two hours a day I have.",
        upvotes: 12,
        depth: 0,
        isOp: true,
        ageDays: 1,
      },
    ],
  },
  {
    externalId: "t3_demo102",
    communityExternalId: "CustomerSuccess",
    title: "Drowning in repetitive support tickets — what tool are you using?",
    body: "Two-person team, roughly 400 tickets a week and honestly 70% of them are the same six questions. Our response time has slipped to 14 hours and customers are noticing. Hiring another support person isn't in the budget this quarter. Looking for something that can deflect the repetitive stuff without making us sound like a robot. Anyone using something they actually like?",
    author: "u/ops_marta",
    upvotes: 156,
    ageDays: 1,
    comments: [
      {
        externalId: "t1_d102a",
        parentExternalId: null,
        author: "u/helpdesk_jo",
        body: "We went through this last year. A decent knowledge base plus deflection on the top 10 questions cut our volume by about 40%. The tooling matters less than actually writing the articles.",
        upvotes: 61,
        depth: 0,
        isOp: false,
        ageDays: 1,
      },
      {
        externalId: "t1_d102b",
        parentExternalId: null,
        author: "u/scaling_sup",
        body: "We looked at Zendesk and Intercom. Both felt heavy and expensive for a team our size. Ended up somewhere cheaper. What's your ticket volume?",
        upvotes: 43,
        depth: 0,
        isOp: false,
        ageDays: 1,
      },
      {
        externalId: "t1_d102c",
        parentExternalId: "t1_d102b",
        author: "u/ops_marta",
        body: "About 400/week. Zendesk quoted us way above what we can justify right now.",
        upvotes: 18,
        depth: 1,
        isOp: true,
        ageDays: 1,
      },
      {
        externalId: "t1_d102d",
        parentExternalId: null,
        author: "u/founder_ricky",
        body: "I'm the founder handling support myself and it's eating my entire morning. Support team overloaded is one thing, but when it's the founder doing it you're not building anything. Watching this thread closely.",
        upvotes: 37,
        depth: 0,
        isOp: false,
        ageDays: 0,
      },
      {
        externalId: "t1_d102e",
        parentExternalId: null,
        author: "u/cs_pragmatist",
        body: "Careful with full automation. We deflected too aggressively and our CSAT tanked. Reduce support workload, don't remove the human.",
        upvotes: 29,
        depth: 0,
        isOp: false,
        ageDays: 0,
      },
    ],
  },
  {
    externalId: "t3_demo103",
    communityExternalId: "indiehackers",
    title: "What tool do you use to find people actually talking about your problem?",
    body: "I keep hearing 'go where your customers are' but every time I try I end up scrolling for an hour and finding nothing. Is there a tool for this or is everyone just doing it manually? Happy to pay if it saves me the time.",
    author: "u/sidequest_dev",
    upvotes: 98,
    ageDays: 4,
    comments: [
      {
        externalId: "t1_d103a",
        parentExternalId: null,
        author: "u/manual_matt",
        body: "Manual, saved searches, and a spreadsheet. Not glamorous but it works. The hard part isn't finding posts, it's judging which ones are worth answering.",
        upvotes: 41,
        depth: 0,
        isOp: false,
        ageDays: 4,
      },
      {
        externalId: "t1_d103b",
        parentExternalId: "t1_d103a",
        author: "u/sidequest_dev",
        body: "That's exactly my problem. I can find 50 posts, I just don't know which 5 to actually spend time on.",
        upvotes: 27,
        depth: 1,
        isOp: true,
        ageDays: 3,
      },
      {
        externalId: "t1_d103c",
        parentExternalId: null,
        author: "u/lurker_turned_builder",
        body: "Whatever you use, don't mass-post. I've seen three tools get their users banned from this sub. Answer properly or don't bother.",
        upvotes: 55,
        depth: 0,
        isOp: false,
        ageDays: 3,
      },
    ],
  },
  {
    externalId: "t3_demo104",
    communityExternalId: "startups",
    title: "We get traffic but almost nobody signs up. Where do I even start?",
    body: "About 2,000 visitors a month from content, conversion to signup is under 1%. I've rewritten the headline four times. Not sure if it's the messaging, the offer, or that the traffic is just wrong.",
    author: "u/analytics_anna",
    upvotes: 187,
    ageDays: 6,
    comments: [
      {
        externalId: "t1_d104a",
        parentExternalId: null,
        author: "u/cro_chris",
        body: "Under 1% with content traffic usually means intent mismatch, not copy. Who are the visitors and what were they searching for?",
        upvotes: 72,
        depth: 0,
        isOp: false,
        ageDays: 6,
      },
      {
        externalId: "t1_d104b",
        parentExternalId: null,
        author: "u/positioning_pat",
        body: "Nine times out of ten the landing page doesn't say who it's for. If I can't tell in five seconds whether it's for me, I leave.",
        upvotes: 64,
        depth: 0,
        isOp: false,
        ageDays: 5,
      },
      {
        externalId: "t1_d104c",
        parentExternalId: "t1_d104b",
        author: "u/analytics_anna",
        body: "Fair. Our headline is pretty generic now that I look at it again.",
        upvotes: 21,
        depth: 1,
        isOp: true,
        ageDays: 5,
      },
    ],
  },
  {
    externalId: "t3_demo105",
    communityExternalId: "SaaS",
    title: "People sign up and never come back. Activation is killing us.",
    body: "Signups are fine, around 60 a week. But only about 8% ever complete setup and actually use the thing. Feels like we're filling a bucket with a hole in it. How are you solving activation?",
    author: "u/bucket_with_hole",
    upvotes: 143,
    ageDays: 9,
    comments: [
      {
        externalId: "t1_d105a",
        parentExternalId: null,
        author: "u/onboarding_owen",
        body: "We cut our setup from 11 steps to 3 and activation roughly doubled. Every step you add is a place to lose someone.",
        upvotes: 88,
        depth: 0,
        isOp: false,
        ageDays: 9,
      },
      {
        externalId: "t1_d105b",
        parentExternalId: null,
        author: "u/data_driven_dee",
        body: "Have you watched session recordings? We assumed it was the form. It was actually an error message nobody could understand.",
        upvotes: 52,
        depth: 0,
        isOp: false,
        ageDays: 8,
      },
      {
        externalId: "t1_d105c",
        parentExternalId: null,
        author: "u/quiet_pm",
        body: "8% activation with 60 signups a week means you have an activation problem, not an acquisition problem. Don't spend another dollar on ads until that's fixed.",
        upvotes: 71,
        depth: 0,
        isOp: false,
        ageDays: 8,
      },
    ],
  },
  {
    externalId: "t3_demo106",
    communityExternalId: "Entrepreneur",
    title: "Just hit $10k MRR. AMA about the boring middle.",
    body: "Took four years. No funding, no viral moment. Happy to answer anything about the unglamorous part nobody posts about.",
    author: "u/slow_and_steady_sam",
    upvotes: 892,
    ageDays: 12,
    comments: [
      {
        externalId: "t1_d106a",
        parentExternalId: null,
        author: "u/curious_cat_99",
        body: "What channel actually drove the most revenue?",
        upvotes: 104,
        depth: 0,
        isOp: false,
        ageDays: 12,
      },
      {
        externalId: "t1_d106b",
        parentExternalId: "t1_d106a",
        author: "u/slow_and_steady_sam",
        body: "Honestly, answering questions in two niche forums for two years. Nothing scalable, just consistent.",
        upvotes: 156,
        depth: 1,
        isOp: true,
        ageDays: 12,
      },
      {
        externalId: "t1_d106c",
        parentExternalId: null,
        author: "u/skeptical_steve",
        body: "Congrats. What was your churn like getting there?",
        upvotes: 47,
        depth: 0,
        isOp: false,
        ageDays: 11,
      },
    ],
  },
  {
    externalId: "t3_demo107",
    communityExternalId: "startups",
    title: "Thoughts on the new office space trend?",
    body: "Seeing a lot of startups go back to in-person. Curious what people think about hybrid vs fully remote for a team of 12.",
    author: "u/office_debate",
    upvotes: 63,
    ageDays: 18,
    comments: [
      {
        externalId: "t1_d107a",
        parentExternalId: null,
        author: "u/remote_rachel",
        body: "Fully remote, 12 people, no issues. Async writing culture is the thing that actually matters.",
        upvotes: 34,
        depth: 0,
        isOp: false,
        ageDays: 18,
      },
      {
        externalId: "t1_d107b",
        parentExternalId: null,
        author: "u/hybrid_harry",
        body: "Two days in office has been a decent middle ground for us.",
        upvotes: 19,
        depth: 0,
        isOp: false,
        ageDays: 17,
      },
    ],
  },
  {
    externalId: "t3_demo108",
    communityExternalId: "CustomerSuccess",
    title: "Alternative to Zendesk for a team of three?",
    body: "Zendesk renewal came in at a number that made me laugh. We're three people handling maybe 250 tickets a week. What are people using that doesn't cost enterprise money? Would rather not build our own.",
    author: "u/renewal_shock",
    upvotes: 121,
    ageDays: 3,
    comments: [
      {
        externalId: "t1_d108a",
        parentExternalId: null,
        author: "u/frugal_founder",
        body: "We moved off Zendesk two years ago and haven't looked back. The migration was the painful bit, not the tool.",
        upvotes: 48,
        depth: 0,
        isOp: false,
        ageDays: 3,
      },
      {
        externalId: "t1_d108b",
        parentExternalId: null,
        author: "u/support_sceptic",
        body: "Before you switch — how much of your volume is actually repetitive? We nearly migrated and then realised the real fix was reducing ticket volume, not changing where the tickets land.",
        upvotes: 66,
        depth: 0,
        isOp: false,
        ageDays: 2,
      },
      {
        externalId: "t1_d108c",
        parentExternalId: "t1_d108b",
        author: "u/renewal_shock",
        body: "Good question. Probably 60% is the same handful of questions about billing and setup.",
        upvotes: 24,
        depth: 1,
        isOp: true,
        ageDays: 2,
      },
      {
        externalId: "t1_d108d",
        parentExternalId: "t1_d108c",
        author: "u/support_sceptic",
        body: "Then a cheaper helpdesk just makes the same problem cheaper. Worth fixing the deflection first.",
        upvotes: 51,
        depth: 2,
        isOp: false,
        ageDays: 2,
      },
    ],
  },
  {
    externalId: "t3_demo109",
    communityExternalId: "indiehackers",
    title: "How do you decide what to charge? Pricing paralysis.",
    body: "B2B tool, small teams. I've been stuck between $19 and $49 for a month and I'm losing more to indecision than I would to picking wrong.",
    author: "u/pricing_paralysis",
    upvotes: 76,
    ageDays: 7,
    comments: [
      {
        externalId: "t1_d109a",
        parentExternalId: null,
        author: "u/price_it_higher",
        body: "Pick $49. You can always discount. Going up later is much harder.",
        upvotes: 58,
        depth: 0,
        isOp: false,
        ageDays: 7,
      },
      {
        externalId: "t1_d109b",
        parentExternalId: null,
        author: "u/value_based_val",
        body: "Neither, until you know what problem you're solving in dollar terms. What does the problem cost them per month?",
        upvotes: 44,
        depth: 0,
        isOp: false,
        ageDays: 6,
      },
    ],
  },
  {
    externalId: "t3_demo110",
    communityExternalId: "SaaS",
    title: "Anyone using AI for their support workflow yet? Looking for honest takes.",
    body: "Board is pushing us to 'do something with AI' in support. I'm sceptical but our repetitive ticket load is genuinely a problem. Looking for people who've actually shipped this, not vendors.",
    author: "u/pragmatic_vp",
    upvotes: 134,
    ageDays: 5,
    comments: [
      {
        externalId: "t1_d110a",
        parentExternalId: null,
        author: "u/shipped_it_already",
        body: "We did. Deflected about 35% of tier-one. The wins were real but so was the tuning effort — budget a month, not a weekend.",
        upvotes: 79,
        depth: 0,
        isOp: false,
        ageDays: 5,
      },
      {
        externalId: "t1_d110b",
        parentExternalId: null,
        author: "u/burned_by_bots",
        body: "We tried and rolled it back. Customers hated it. Depends entirely on whether your questions are genuinely repetitive or just look that way in aggregate.",
        upvotes: 62,
        depth: 0,
        isOp: false,
        ageDays: 4,
      },
      {
        externalId: "t1_d110c",
        parentExternalId: "t1_d110b",
        author: "u/pragmatic_vp",
        body: "This is the honest take I was after. Ours are genuinely repetitive — same six billing questions forever.",
        upvotes: 31,
        depth: 1,
        isOp: true,
        ageDays: 4,
      },
    ],
  },
];

export function toCommunityDTOs(): CommunityDTO[] {
  return REDDIT_COMMUNITIES.map((community) => ({
    ...community,
    isDemoData: true,
  }));
}

export function toPostDTO(post: FixturePost): PostDTO {
  const community = REDDIT_COMMUNITIES.find(
    (c) => c.externalId === post.communityExternalId,
  );
  return {
    externalId: post.externalId,
    communityExternalId: post.communityExternalId,
    title: post.title,
    body: post.body,
    author: post.author,
    url: `${community?.url ?? "https://www.reddit.com/"}comments/${post.externalId.replace("t3_", "")}/`,
    upvotes: post.upvotes,
    commentCount: post.comments.length,
    createdAt: daysAgo(post.ageDays),
    isDemoData: true,
  };
}

export function toCommentDTOs(post: FixturePost): CommentDTO[] {
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
