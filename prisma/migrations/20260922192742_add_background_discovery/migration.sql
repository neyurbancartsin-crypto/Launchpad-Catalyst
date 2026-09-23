-- AlterTable
ALTER TABLE "DiscoveryRun" ADD COLUMN     "isAuto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SaaSProject" ADD COLUMN     "autoDiscoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "discoveryIntervalHours" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "discoveryStartedAt" TIMESTAMP(3),
ADD COLUMN     "lastAutoDiscoveryAt" TIMESTAMP(3);
