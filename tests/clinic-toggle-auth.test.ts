/**
 * API Auth Tests for PATCH /api/clinics/[id]
 *
 * Verifies that unauthenticated requests return 401.
 * All authenticated users (clinicians and admins) can toggle opt-in.
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

  test("returns 200 when user is a clinician (all users can toggle)", async () => {
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

  test("returns 200 when user is an admin", async () => {
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
