-- AlterTable: add dateOfVisit and updatedAt to ClinicalUpdate
ALTER TABLE "ClinicalUpdate" ADD COLUMN "dateOfVisit" TIMESTAMP(3);
ALTER TABLE "ClinicalUpdate" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
