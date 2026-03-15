/**
 * Seed Integrity Tests
 *
 * These tests verify the seed script produces the expected data counts
 * and referential correctness. They use mocked Prisma operations to be
 * deterministic and not depend on an actual database connection.
 */

// Mock the Prisma adapter and client
jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(),
}));

// Track all create calls to verify seed data
const createCalls: { model: string; data: Record<string, unknown> }[] = [];
const deleteCalls: string[] = [];

let clinicIdCounter = 0;

const mockPrismaClient = {
  clinic: {
    deleteMany: jest.fn(async () => {
      deleteCalls.push("clinic");
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      clinicIdCounter++;
      const clinic = { id: `clinic-${clinicIdCounter}`, ...data };
      createCalls.push({ model: "clinic", data: clinic });
      return clinic;
    }),
  },
  user: {
    deleteMany: jest.fn(async () => {
      deleteCalls.push("user");
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      createCalls.push({ model: "user", data });
    }),
  },
  patient: {
    deleteMany: jest.fn(async () => {
      deleteCalls.push("patient");
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      createCalls.push({ model: "patient", data });
    }),
  },
  clinicalUpdate: {
    deleteMany: jest.fn(async () => {
      deleteCalls.push("clinicalUpdate");
    }),
  },
  episode: {
    deleteMany: jest.fn(async () => {
      deleteCalls.push("episode");
    }),
  },
  simulationEvent: {
    deleteMany: jest.fn(async () => {
      deleteCalls.push("simulationEvent");
    }),
  },
  accessEvent: {
    deleteMany: jest.fn(async () => {
      deleteCalls.push("accessEvent");
    }),
  },
  $disconnect: jest.fn(),
};

jest.mock("../lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(async () => "hashed-password"),
}));

describe("Seed Integrity", () => {
  beforeAll(async () => {
    createCalls.length = 0;
    deleteCalls.length = 0;
    clinicIdCounter = 0;
    // Run the seed script
    await import("../prisma/seed");
  });

  test("should clean data in correct dependency order", () => {
    expect(deleteCalls).toEqual([
      "accessEvent",
      "clinicalUpdate",
      "episode",
      "simulationEvent",
      "patient",
      "user",
      "clinic",
    ]);
  });

  test("should create exactly 3 clinics", () => {
    const clinicCreates = createCalls.filter((c) => c.model === "clinic");
    expect(clinicCreates).toHaveLength(3);
  });

  test("should create exactly 3 users", () => {
    const userCreates = createCalls.filter((c) => c.model === "user");
    expect(userCreates).toHaveLength(3);
  });

  test("should create exactly 2 patients", () => {
    const patientCreates = createCalls.filter((c) => c.model === "patient");
    expect(patientCreates).toHaveLength(2);
  });

  test("each user should reference a valid clinic ID", () => {
    const clinicIds = createCalls
      .filter((c) => c.model === "clinic")
      .map((c) => c.data.id);

    const userCreates = createCalls.filter((c) => c.model === "user");

    for (const user of userCreates) {
      expect(clinicIds).toContain(user.data.clinicId);
    }
  });

  test("the patient should reference a valid clinic ID", () => {
    const clinicIds = createCalls
      .filter((c) => c.model === "clinic")
      .map((c) => c.data.id);

    const patientCreates = createCalls.filter((c) => c.model === "patient");

    for (const patient of patientCreates) {
      expect(clinicIds).toContain(patient.data.clinicId);
    }
  });

  test("clinics should have expected names", () => {
    const clinicNames = createCalls
      .filter((c) => c.model === "clinic")
      .map((c) => c.data.name);

    expect(clinicNames).toContain("City Vet Clinic");
    expect(clinicNames).toContain("Harbour Vet");
    expect(clinicNames).toContain("Summit Animal Hospital");
  });

  test("users should have unique email addresses", () => {
    const emails = createCalls
      .filter((c) => c.model === "user")
      .map((c) => c.data.email);

    expect(new Set(emails).size).toBe(emails.length);
  });
});
