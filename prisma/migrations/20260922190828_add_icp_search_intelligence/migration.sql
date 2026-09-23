-- AlterTable
ALTER TABLE "ICP" ADD COLUMN     "keywordSynonyms" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "negativeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "positiveKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
