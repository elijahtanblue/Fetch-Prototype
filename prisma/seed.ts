import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hash } from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data (idempotent re-seed)
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clinic.deleteMany();

  // Create 3 clinics
  const clinicA = await prisma.clinic.create({
    data: { name: "City Physio", optedIn: true },
  });

  const clinicB = await prisma.clinic.create({
    data: { name: "Harbour Health", optedIn: false },
  });

  const clinicC = await prisma.clinic.create({
    data: { name: "Summit Rehabilitation", optedIn: true },
  });

  // Create 3 users (one per clinic)
  const passwordHash = await hash("password123", 12);

  await prisma.user.create({
    data: {
      email: "edsun@diversus.com",
      password: passwordHash,
      name: "Ed Sun",
      role: "clinician",
      clinicId: clinicA.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "edzhang@diversus.com",
      password: passwordHash,
      name: "Ed Zhang",
      role: "clinician",
      clinicId: clinicB.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "elijah@admin.com",
      password: passwordHash,
      name: "Elijah Admin",
      role: "admin",
      clinicId: clinicC.id,
    },
  });

  // Create 1 shared patient visible to all clinicians
  await prisma.patient.create({
    data: {
      firstName: "Winston",
      lastName: "Liang",
      dateOfBirth: new Date("1985-03-15"),
      clinicId: clinicA.id,
    },
  });

  console.log("Seed completed: 3 clinics, 3 users, 1 patient.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
