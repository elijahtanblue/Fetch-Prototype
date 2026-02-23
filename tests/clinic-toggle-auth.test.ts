/**
 * API Auth Tests for PATCH /api/clinics/[id]
 *
 * Verifies:
 * - Unauthenticated → 401
 * - Clinician toggling OWN clinic → 200
 * - Clinician toggling OTHER clinic → 403
 * - Admin toggling any clinic → 200
 */

let mockSession: Record<string, unknown> | null = null;

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: {
      findUnique: jest.fn(async () => ({
        id: "c1",
        name: "City Physio",
        optedIn: false,
        accessPercent: 30,
      })),
      update: jest.fn(async () => ({
        id: "c1",
        name: "City Physio",
        optedIn: true,
      })),
    },
    simulationEvent: {
      create: jest.fn(async () => ({})),
    },
    accessEvent: {
      create: jest.fn(async () => ({})),
    },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => mockSession),
}));

describe("PATCH /api/clinics/[id] - Authorization", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("returns 401 when user is not authenticated", async () => {
    mockSession = null;
    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c1", {
      method: "PATCH",
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(response.status).toBe(401);
  });

  test("returns 200 when clinician toggles their OWN clinic", async () => {
    mockSession = {
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    };
    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c1", {
      method: "PATCH",
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(response.status).toBe(200);
  });

  test("returns 403 when clinician toggles ANOTHER clinic", async () => {
    mockSession = {
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    };
    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c2", {
      method: "PATCH",
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "c2" }),
    });
    expect(response.status).toBe(403);
  });

  test("returns 200 when admin toggles any clinic", async () => {
    mockSession = {
      user: { id: "u3", role: "admin", clinicId: "c3" },
    };
    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c1", {
      method: "PATCH",
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(response.status).toBe(200);
  });
});
