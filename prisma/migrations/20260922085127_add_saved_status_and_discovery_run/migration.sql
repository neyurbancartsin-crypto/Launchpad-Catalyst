-- AlterEnum
ALTER TYPE "OpportunityStatus" ADD VALUE 'SAVED';

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "newCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "errorSummary" TEXT,

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoveryRun_projectId_runAt_idx" ON "DiscoveryRun"("projectId", "runAt");

-- AddForeignKey
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SaaSProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
