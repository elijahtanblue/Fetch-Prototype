-- AlterTable: add phoneNumber with default for existing rows, then make unique
ALTER TABLE "Patient" ADD COLUMN "phoneNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Patient" ADD COLUMN "treatmentCompletedAt" TIMESTAMP(3);

-- Set phone numbers for existing seed patients
UPDATE "Patient" SET "phoneNumber" = '0400000001' WHERE "firstName" = 'John' AND "lastName" = 'Smith';
UPDATE "Patient" SET "phoneNumber" = '0400000002' WHERE "firstName" = 'Winston' AND "lastName" = 'Liang';

-- Remove default and add unique constraint
ALTER TABLE "Patient" ALTER COLUMN "phoneNumber" DROP DEFAULT;
CREATE UNIQUE INDEX "Patient_phoneNumber_key" ON "Patient"("phoneNumber");
