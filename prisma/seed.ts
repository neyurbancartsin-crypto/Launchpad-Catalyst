/**
 * Seeds a demo account that lands mid-loop: onboarded, opportunities
 * discovered, one response posted, some funnel results logged, and an
 * experiment ready to analyse.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { MockAIProvider } from "../src/lib/ai/mock-provider";
import { syncOpportunities } from "../src/lib/discovery";
import type { SaaSIntake } from "../src/lib/ai/types";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@launchpadcatalyst.test";
const DEMO_PASSWORD = "demo-password-123";

const INTAKE: SaaSIntake = {
  name: "ReplyDesk",
  website: "https://replydesk.example.com",
  description:
    "ReplyDesk automatically answers repetitive customer support tickets by learning from your past replies and your help centre, so small support teams stop retyping the same six answers every day.",
  problemSolved:
    "Small support teams drown in repetitive support tickets. The same handful of questions arrive over and over, response time slips, and hiring more support staff is too expensive.",
  targetCustomer: "Support leads at small B2B SaaS companies",
  category: "Customer support automation",
  pricing: "$49/month",
  currentUsers: 12,
  payingUsers: 3,
  businessModel: "B2B",
  targetGeography: "US and Europe",
  competitors: "Zendesk, Intercom",
  currentChannels: "Occasional Twitter posts",
  biggestProblem:
    "I do not know where my customers spend time or which conversations are worth joining.",
  marketingBudget: "$0-200/month",
  hoursPerWeek: 8,
  existingAudience: "400 Twitter followers",
  socialProfiles: "x.com/replydesk",
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Seeding demo account…");

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: "Demo Founder",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
    },
    update: {},
  });

  // Start from a clean project so re-seeding is idempotent.
  await prisma.saaSProject.deleteMany({ where: { userId: user.id } });

  const ai = new MockAIProvider();
  const analysis = await ai.analyzeSaaS(INTAKE);
  const channels = await ai.recommendChannels(INTAKE, analysis);

  const project = await prisma.saaSProject.create({
    data: {
      userId: user.id,
      ...INTAKE,
      onboardingComplete: true,
      aiAnalysisRaw: analysis as unknown as object,
    },
  });

  const icp = await prisma.iCP.create({
    data: {
      projectId: project.id,
      productSummary: analysis.productSummary,
      coreProblem: analysis.coreProblem,
      valueProposition: analysis.valueProposition,
      productCategory: analysis.productCategory,
      primaryCustomer: analysis.primaryCustomer,
      secondaryCustomer: analysis.secondaryCustomer,
      roles: analysis.roles,
      industries: analysis.industries,
      companySize: analysis.companySize,
      painPoints: analysis.painPoints,
      buyingTriggers: analysis.buyingTriggers,
      objections: analysis.objections,
      problemMap: analysis.problemMap as unknown as object,
      searchTopics: analysis.searchTopics,
      intentSignals: analysis.intentSignals,
    },
  });

  for (const channel of channels) {
    await prisma.channel.create({ data: { projectId: project.id, ...channel } });
  }

  const summary = await syncOpportunities(project, icp);
  console.log(`  Discovered ${summary.discovered} opportunities`);

  // Post a response on the strongest opportunity so the loop has history.
  const best = await prisma.opportunity.findFirst({
    where: { projectId: project.id },
    orderBy: { opportunityScore: "desc" },
  });

  if (best) {
    const draft = await ai.generateResponse({
      style: "experience-based",
      productName: project.name,
      productSummary: icp.productSummary,
      valueProposition: icp.valueProposition,
      postTitle: best.title,
      postBody: best.content,
      targetComment: null,
      communityName: best.communityName,
      platform: best.platform,
      recommendedAction: best.recommendedAction,
      promotionRisk: best.promotionRisk,
      allowProductMention: false,
    });

    await prisma.response.create({
      data: {
        opportunityId: best.id,
        style: "experience-based",
        draft: draft.draft,
        finalText: draft.draft,
        mentionsProduct: draft.mentionsProduct,
        guidanceNote: draft.guidanceNote,
        status: "POSTED",
        postedAt: daysAgo(3),
      },
    });

    await prisma.opportunity.update({
      where: { id: best.id },
      data: { status: "RESPONDED" },
    });

    await prisma.engagement.createMany({
      data: [
        { projectId: project.id, opportunityId: best.id, platform: best.platform, stage: "ENGAGEMENT", action: "Posted response", count: 1, loggedAt: daysAgo(3) },
        { projectId: project.id, opportunityId: best.id, platform: best.platform, stage: "PROFILE_VISIT", count: 6, loggedAt: daysAgo(3) },
        { projectId: project.id, opportunityId: best.id, platform: best.platform, stage: "WEBSITE_VISIT", count: 4, loggedAt: daysAgo(2) },
        { projectId: project.id, opportunityId: best.id, platform: best.platform, stage: "SIGNUP", count: 2, loggedAt: daysAgo(2) },
        { projectId: project.id, platform: "REDDIT", stage: "ENGAGEMENT", action: "Comment", count: 4, loggedAt: daysAgo(5) },
        { projectId: project.id, platform: "REDDIT", stage: "WEBSITE_VISIT", count: 4, loggedAt: daysAgo(4) },
        { projectId: project.id, platform: "REDDIT", stage: "SIGNUP", count: 1, loggedAt: daysAgo(4) },
        { projectId: project.id, platform: "X", stage: "ENGAGEMENT", action: "Reply", count: 3, loggedAt: daysAgo(6) },
        { projectId: project.id, platform: "X", stage: "WEBSITE_VISIT", count: 2, loggedAt: daysAgo(6) },
        { projectId: project.id, platform: "LINKEDIN", stage: "ENGAGEMENT", action: "Comment", count: 2, loggedAt: daysAgo(6) },
      ],
    });
  }

  // A completed experiment with results the founder can analyse.
  const experiment = await prisma.experiment.create({
    data: {
      projectId: project.id,
      name: "Reddit support-problem conversations",
      hypothesis:
        "Support leads discussing repetitive ticket volume on Reddit may become potential users.",
      channel: "REDDIT",
      action: "Provide useful answers without immediately pitching.",
      startDate: daysAgo(7),
      endDate: daysAgo(0),
      targetConversations: 20,
      status: "RUNNING",
    },
  });

  await prisma.experimentResult.create({
    data: {
      experimentId: experiment.id,
      conversations: 23,
      websiteVisits: 8,
      signups: 4,
      activatedUsers: 2,
      paidUsers: 0,
    },
  });

  console.log(`\nDemo account ready:`);
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
