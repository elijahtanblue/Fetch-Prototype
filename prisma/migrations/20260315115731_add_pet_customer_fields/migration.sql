-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "address" TEXT,
ADD COLUMN     "insuranceCommencementDate" TIMESTAMP(3),
ADD COLUMN     "petBreed" TEXT,
ADD COLUMN     "petDateOfBirth" TIMESTAMP(3),
ADD COLUMN     "petDesexed" BOOLEAN,
ADD COLUMN     "petGender" TEXT,
ADD COLUMN     "petName" TEXT,
ADD COLUMN     "petType" TEXT;
