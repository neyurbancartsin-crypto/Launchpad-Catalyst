-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('REDDIT', 'X', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('DEMO', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "PromotionRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('NEW', 'REVIEWED', 'RESPONDED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('DRAFT', 'EDITED', 'POSTED');

-- CreateEnum
CREATE TYPE "EngagementStage" AS ENUM ('OPPORTUNITY', 'ENGAGEMENT', 'PROFILE_VISIT', 'WEBSITE_VISIT', 'SIGNUP', 'ACTIVATION', 'PAID');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('PLANNED', 'RUNNING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "Bottleneck" AS ENUM ('ACQUISITION', 'POSITIONING', 'CONVERSION', 'ACTIVATION', 'PRODUCT');

-- CreateEnum
CREATE TYPE "PriorityBand" AS ENUM ('HIGH', 'REVIEW', 'LOW', 'DEPRIORITISE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "SaaSProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "problemSolved" TEXT NOT NULL,
    "targetCustomer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "pricing" TEXT NOT NULL,
    "currentUsers" INTEGER NOT NULL DEFAULT 0,
    "payingUsers" INTEGER NOT NULL DEFAULT 0,
    "businessModel" TEXT NOT NULL,
    "targetGeography" TEXT NOT NULL,
    "competitors" TEXT NOT NULL,
    "currentChannels" TEXT NOT NULL,
    "biggestProblem" TEXT NOT NULL,
    "marketingBudget" TEXT,
    "hoursPerWeek" INTEGER,
    "existingAudience" TEXT,
    "socialProfiles" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "aiAnalysisRaw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaaSProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ICP" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "productSummary" TEXT NOT NULL,
    "coreProblem" TEXT NOT NULL,
    "valueProposition" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "primaryCustomer" TEXT NOT NULL,
    "secondaryCustomer" TEXT NOT NULL,
    "roles" TEXT[],
    "industries" TEXT[],
    "companySize" TEXT NOT NULL,
    "painPoints" TEXT[],
    "buyingTriggers" TEXT[],
    "objections" TEXT[],
    "problemMap" JSONB NOT NULL,
    "searchTopics" TEXT[],
    "intentSignals" TEXT[],
    "editedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ICP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "priority" TEXT NOT NULL,
    "whyItFits" TEXT NOT NULL,
    "whoToFind" TEXT NOT NULL,
    "topicsToTarget" TEXT NOT NULL,
    "conversationsToJoin" TEXT NOT NULL,
    "actionToTake" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "memberCount" INTEGER,
    "relevanceScore" INTEGER NOT NULL,
    "selfPromoRules" TEXT NOT NULL DEFAULT 'moderate',
    "isDemoData" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "communityId" TEXT,
    "platform" "Platform" NOT NULL,
    "externalPostId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "communityName" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "icpScore" INTEGER NOT NULL,
    "problemScore" INTEGER NOT NULL,
    "intentScore" INTEGER NOT NULL,
    "recencyScore" INTEGER NOT NULL,
    "relevanceScore" INTEGER NOT NULL,
    "engagementScore" INTEGER NOT NULL,
    "opportunityScore" INTEGER NOT NULL,
    "priorityBand" "PriorityBand" NOT NULL,
    "promotionRisk" "PromotionRisk" NOT NULL,
    "promotionRiskReason" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "actionRationale" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'NEW',
    "isDemoData" BOOLEAN NOT NULL DEFAULT true,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "parentContent" TEXT NOT NULL,
    "comments" JSONB NOT NULL,
    "analysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "draft" TEXT NOT NULL,
    "finalText" TEXT,
    "mentionsProduct" BOOLEAN NOT NULL DEFAULT false,
    "guidanceNote" TEXT,
    "status" "ResponseStatus" NOT NULL DEFAULT 'DRAFT',
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Engagement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "platform" "Platform" NOT NULL,
    "stage" "EngagementStage" NOT NULL,
    "action" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Engagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "channel" "Platform",
    "action" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "targetConversations" INTEGER NOT NULL DEFAULT 0,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentResult" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "websiteVisits" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "activatedUsers" INTEGER NOT NULL DEFAULT 0,
    "paidUsers" INTEGER NOT NULL DEFAULT 0,
    "aiAnalysis" JSONB,
    "bottleneck" "Bottleneck",
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "bottleneck" "Bottleneck",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPageAudit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingPageAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "SaaSProject_userId_idx" ON "SaaSProject"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ICP_projectId_key" ON "ICP"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_projectId_platform_key" ON "Channel"("projectId", "platform");

-- CreateIndex
CREATE INDEX "Community_projectId_idx" ON "Community"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Community_projectId_platform_externalId_key" ON "Community"("projectId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "Opportunity_projectId_opportunityScore_idx" ON "Opportunity"("projectId", "opportunityScore");

-- CreateIndex
CREATE INDEX "Opportunity_projectId_status_idx" ON "Opportunity"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_projectId_platform_externalPostId_key" ON "Opportunity"("projectId", "platform", "externalPostId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_opportunityId_key" ON "Conversation"("opportunityId");

-- CreateIndex
CREATE INDEX "Response_opportunityId_idx" ON "Response"("opportunityId");

-- CreateIndex
CREATE INDEX "Engagement_projectId_stage_idx" ON "Engagement"("projectId", "stage");

-- CreateIndex
CREATE INDEX "Engagement_projectId_loggedAt_idx" ON "Engagement"("projectId", "loggedAt");

-- CreateIndex
CREATE INDEX "Experiment_projectId_idx" ON "Experiment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentResult_experimentId_key" ON "ExperimentResult"("experimentId");

-- CreateIndex
CREATE INDEX "GrowthReport_projectId_createdAt_idx" ON "GrowthReport"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "LandingPageAudit_projectId_createdAt_idx" ON "LandingPageAudit"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaaSProject" ADD CONSTRAINT "SaaSProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ICP" ADD CONSTRAINT "ICP_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SaaSProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SaaSProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SaaSProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SaaSProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SaaSProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engagement" ADD CONSTRAINT "Engagement_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SaaSProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthReport" ADD CONSTRAINT "GrowthReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SaaSProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingPageAudit" ADD CONSTRAINT "LandingPageAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SaaSProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
