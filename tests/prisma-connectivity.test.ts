/**
 * Prisma Connectivity Smoke Test
 *
 * Verifies that the Prisma client can be imported and instantiated.
 * Uses mocked adapter to avoid requiring a real database connection.
 */

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => {
  const mockClient = {
    clinic: { findMany: jest.fn(async () => []) },
    user: { findMany: jest.fn(async () => []) },
    patient: { findMany: jest.fn(async () => []) },
    $connect: jest.fn(async () => {}),
    $disconnect: jest.fn(async () => {}),
  };
  return {
    PrismaClient: jest.fn(() => mockClient),
  };
});

describe("Prisma Connectivity", () => {
  test("prisma client can be imported from lib/db", async () => {
    const { prisma } = await import("@/lib/db");
    expect(prisma).toBeDefined();
  });

  test("prisma client has expected model accessors", async () => {
    const { prisma } = await import("@/lib/db");
    expect(prisma.clinic).toBeDefined();
    expect(prisma.user).toBeDefined();
    expect(prisma.patient).toBeDefined();
  });

  test("prisma.clinic.findMany can be called", async () => {
    const { prisma } = await import("@/lib/db");
    const result = await prisma.clinic.findMany();
    expect(Array.isArray(result)).toBe(true);
  });
});
