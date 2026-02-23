-- AlterTable
ALTER TABLE "ClinicalUpdate" ADD COLUMN     "notesRaw" TEXT,
ADD COLUMN     "notesSummary" TEXT,
ADD COLUMN     "precautions" TEXT,
ADD COLUMN     "responsePattern" TEXT,
ADD COLUMN     "suggestedNextSteps" TEXT,
ADD COLUMN     "updateType" TEXT NOT NULL DEFAULT 'STRUCTURED';
