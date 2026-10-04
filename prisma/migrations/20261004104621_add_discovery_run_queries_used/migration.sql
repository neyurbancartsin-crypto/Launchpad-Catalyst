-- AlterTable
ALTER TABLE "DiscoveryRun" ADD COLUMN     "queriesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[];
