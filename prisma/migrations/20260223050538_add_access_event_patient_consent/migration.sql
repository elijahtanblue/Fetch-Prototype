-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "consentStatus" TEXT NOT NULL DEFAULT 'SHARE',
ADD COLUMN     "consentUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AccessEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "patientId" TEXT,
    "episodeId" TEXT,
    "updateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
