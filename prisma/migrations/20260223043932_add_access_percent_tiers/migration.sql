-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "accessPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastDecayAt" TIMESTAMP(3);
