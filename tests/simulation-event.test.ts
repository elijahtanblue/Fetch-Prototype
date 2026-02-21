/**
 * SimulationEvent Tests for PATCH /api/clinics/[id]
 *
 * Verifies that a TOGGLE_OPT_IN SimulationEvent is created with
 * correct clinic ID, user ID, and metadata after a successful toggle.
 */

const mockEventCreate = jest.fn(async () => ({}));

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: {
      findUnique: jest.fn(async () => ({
        id: "c2",
        name: "Harbour Health",
        optedIn: false,
      })),
      update: jest.fn(async () => ({
        id: "c2",
        name: "Harbour Health",
        optedIn: true,
      })),
    },
    simulationEvent: {
      create: mockEventCreate,
    },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => ({
    user: { id: "u3", role: "admin", clinicId: "c3" },
  })),
}));

describe("SimulationEvent - TOGGLE_OPT_IN", () => {
  beforeEach(() => {
    mockEventCreate.mockClear();
  });

  test("creates a SimulationEvent after successful toggle", async () => {
    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c2", {
      method: "PATCH",
    });
    await PATCH(request, { params: Promise.resolve({ id: "c2" }) });

    expect(mockEventCreate).toHaveBeenCalledTimes(1);
  });

  test("event type is TOGGLE_OPT_IN", async () => {
    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c2", {
      method: "PATCH",
    });
    await PATCH(request, { params: Promise.resolve({ id: "c2" }) });

    const createArg = mockEventCreate.mock.calls[0][0];
    expect(createArg.data.type).toBe("TOGGLE_OPT_IN");
  });

  test("event references the correct clinic ID", async () => {
    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c2", {
      method: "PATCH",
    });
    await PATCH(request, { params: Promise.resolve({ id: "c2" }) });

    const createArg = mockEventCreate.mock.calls[0][0];
    expect(createArg.data.clinicId).toBe("c2");
  });

  test("event references the authenticated user ID", async () => {
    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c2", {
      method: "PATCH",
    });
    await PATCH(request, { params: Promise.resolve({ id: "c2" }) });

    const createArg = mockEventCreate.mock.calls[0][0];
    expect(createArg.data.userId).toBe("u3");
  });

  test("event metadata contains previous and new status", async () => {
    const { PATCH } = await import("@/app/api/clinics/[id]/route");
    const request = new Request("http://localhost/api/clinics/c2", {
      method: "PATCH",
    });
    await PATCH(request, { params: Promise.resolve({ id: "c2" }) });

    const createArg = mockEventCreate.mock.calls[0][0];
    const metadata = JSON.parse(createArg.data.metadata);
    expect(metadata.previousStatus).toBe(false);
    expect(metadata.newStatus).toBe(true);
  });
});
