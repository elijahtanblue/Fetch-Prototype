/**
 * Tests for seed credential changes:
 * 1. New email addresses (edsun@diversus.com, edzhang@diversus.com, elijah@admin.com)
 * 2. Patient renamed to Winston Liang
 *
 * Clinician toggle auth is covered in clinic-toggle-auth.test.ts.
 */

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

const seedCreateCalls: { model: string; data: Record<string, unknown> }[] = [];
let clinicCounter = 0;

jest.mock("../lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: {
      deleteMany: jest.fn(async () => {}),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        clinicCounter++;
        const clinic = { id: `c-${clinicCounter}`, ...data };
        seedCreateCalls.push({ model: "clinic", data: clinic });
        return clinic;
      }),
    },
    user: {
      deleteMany: jest.fn(async () => {}),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        seedCreateCalls.push({ model: "user", data });
      }),
    },
    patient: {
      deleteMany: jest.fn(async () => {}),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        seedCreateCalls.push({ model: "patient", data });
      }),
    },
    clinicalUpdate: { deleteMany: jest.fn(async () => {}) },
    episode: { deleteMany: jest.fn(async () => {}) },
    simulationEvent: { deleteMany: jest.fn(async () => {}) },
    accessEvent: { deleteMany: jest.fn(async () => {}) },
    $disconnect: jest.fn(),
  })),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(async () => "hashed"),
}));

describe("Seed Credentials", () => {
  beforeAll(async () => {
    seedCreateCalls.length = 0;
    clinicCounter = 0;
    await import("../prisma/seed");
  });

  test("uses edsun@diversus.com as first user email", () => {
    const emails = seedCreateCalls
      .filter((c) => c.model === "user")
      .map((c) => c.data.email as string);
    expect(emails).toContain("edsun@diversus.com");
  });

  test("uses edzhang@diversus.com as second user email", () => {
    const emails = seedCreateCalls
      .filter((c) => c.model === "user")
      .map((c) => c.data.email as string);
    expect(emails).toContain("edzhang@diversus.com");
  });

  test("uses elijah@admin.com as third user email", () => {
    const emails = seedCreateCalls
      .filter((c) => c.model === "user")
      .map((c) => c.data.email as string);
    expect(emails).toContain("elijah@admin.com");
  });

  test("old emails are not present in seed", () => {
    const emails = seedCreateCalls
      .filter((c) => c.model === "user")
      .map((c) => c.data.email as string);
    expect(emails).not.toContain("alice@cityphysio.com");
    expect(emails).not.toContain("bob@harbourhealth.com");
    expect(emails).not.toContain("carol@summitrehab.com");
  });

  test("seed includes Winston Liang patient", () => {
    const patients = seedCreateCalls.filter((c) => c.model === "patient");
    const winston = patients.find(
      (p) => p.data.firstName === "Winston" && p.data.lastName === "Liang"
    );
    expect(winston).toBeDefined();
  });

  test("seed includes John Smith patient", () => {
    const patients = seedCreateCalls.filter((c) => c.model === "patient");
    const john = patients.find(
      (p) => p.data.firstName === "John" && p.data.lastName === "Smith"
    );
    expect(john).toBeDefined();
  });

  test("seed creates exactly 2 patients", () => {
    const patients = seedCreateCalls.filter((c) => c.model === "patient");
    expect(patients).toHaveLength(2);
  });
});
