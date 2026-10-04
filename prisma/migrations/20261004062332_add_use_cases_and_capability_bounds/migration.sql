-- AlterTable
ALTER TABLE "ICP" ADD COLUMN     "supportedUseCases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "unsupportedUseCases" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SaaSProject" ADD COLUMN     "useCases" TEXT;
