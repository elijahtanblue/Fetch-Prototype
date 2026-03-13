import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL ?? process.env.Database_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL (or Database_URL) for seed-demo-auth script");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function ensureClinic(name: string, defaults: { optedIn: boolean; accessPercent: number }) {
  const existing = await prisma.clinic.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.clinic.create({
    data: {
      name,
      optedIn: defaults.optedIn,
      accessPercent: defaults.accessPercent,
      lastDecayAt: defaults.optedIn ? new Date() : null,
    },
  });
}

async function main() {
  const passwordHash = await hash("password123", 12);

  const cityPhysio = await ensureClinic("City Physio", { optedIn: true, accessPercent: 80 });
  const harbourHealth = await ensureClinic("Harbour Health", { optedIn: false, accessPercent: 0 });
  const summitRehab = await ensureClinic("Summit Rehabilitation", { optedIn: true, accessPercent: 50 });

  await prisma.user.upsert({
    where: { email: "edsun@diversus.com" },
    update: {
      password: passwordHash,
      name: "Ed Sun",
      role: "clinician",
      clinicId: cityPhysio.id,
    },
    create: {
      email: "edsun@diversus.com",
      password: passwordHash,
      name: "Ed Sun",
      role: "clinician",
      clinicId: cityPhysio.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "edzhang@diversus.com" },
    update: {
      password: passwordHash,
      name: "Ed Zhang",
      role: "clinician",
      clinicId: harbourHealth.id,
    },
    create: {
      email: "edzhang@diversus.com",
      password: passwordHash,
      name: "Ed Zhang",
      role: "clinician",
      clinicId: harbourHealth.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "elijah@admin.com" },
    update: {
      password: passwordHash,
      name: "Elijah Admin",
      role: "admin",
      clinicId: summitRehab.id,
    },
    create: {
      email: "elijah@admin.com",
      password: passwordHash,
      name: "Elijah Admin",
      role: "admin",
      clinicId: summitRehab.id,
    },
  });

  console.log("Demo auth credentials ensured for 3 users (password123).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
