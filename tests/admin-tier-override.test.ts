/**
 * Tests for PUT /api/clinics/[id] admin tier override endpoint.
 *
 * Verifies:
 * - Admin-only access (401/403)
 * - Valid tier values accepted
 * - accessPercent set to TIER_OVERRIDE_VALUES
 * - Invalid tier rejected with 400
 */

const mockClinicFindUnique = jest.fn();
const mockClinicUpdate = jest.fn();

let mockSession: Record<string, unknown> | null = null;

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
    simulationEvent: { create: jest.fn(async () => ({})) },
    accessEvent: { create: jest.fn(async () => ({})) },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => mockSession),
}));

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/clinics/c1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/clinics/[id] - Admin Tier Override", () => {
  beforeEach(() => {
    mockSession = { user: { id: "u3", role: "admin", clinicId: "c3" } };
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
  });

  test("returns 401 when not authenticated", async () => {
    mockSession = null;

    const { PUT } = await import("@/app/api/clinics/[id]/route");
    const res = await PUT(makeRequest({ tier: "full" }), makeParams("c1"));

    expect(res.status).toBe(401);
  });

  test("returns 403 when not admin", async () => {
    mockSession = { user: { id: "u1", role: "clinician", clinicId: "c1" } };

    const { PUT } = await import("@/app/api/clinics/[id]/route");
    const res = await PUT(makeRequest({ tier: "full" }), makeParams("c1"));

    expect(res.status).toBe(403);
  });

  test("returns 400 for invalid tier", async () => {
    const { PUT } = await import("@/app/api/clinics/[id]/route");
    const res = await PUT(makeRequest({ tier: "supreme" }), makeParams("c1"));

    expect(res.status).toBe(400);
  });

  test("returns 400 when tier is missing", async () => {
    const { PUT } = await import("@/app/api/clinics/[id]/route");
    const res = await PUT(makeRequest({}), makeParams("c1"));

    expect(res.status).toBe(400);
  });

  test("returns 404 when clinic not found", async () => {
    mockClinicFindUnique.mockResolvedValue(null);

    const { PUT } = await import("@/app/api/clinics/[id]/route");
    const res = await PUT(makeRequest({ tier: "full" }), makeParams("c999"));

    expect(res.status).toBe(404);
  });

  test("sets accessPercent to 100 for full tier", async () => {
    mockClinicFindUnique.mockResolvedValue({ id: "c1", name: "City Physio", accessPercent: 30 });
    mockClinicUpdate.mockResolvedValue({ id: "c1", name: "City Physio", accessPercent: 100 });

    const { PUT } = await import("@/app/api/clinics/[id]/route");
    const res = await PUT(makeRequest({ tier: "full" }), makeParams("c1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.accessPercent).toBe(100);
    expect(data.tier).toBe("full");
    expect(mockClinicUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accessPercent: 100 }),
      })
    );
  });

  test("sets accessPercent to 69 for limited tier", async () => {
    mockClinicFindUnique.mockResolvedValue({ id: "c1", name: "City Physio", accessPercent: 90 });
    mockClinicUpdate.mockResolvedValue({ id: "c1", name: "City Physio", accessPercent: 69 });

    const { PUT } = await import("@/app/api/clinics/[id]/route");
    const res = await PUT(makeRequest({ tier: "limited" }), makeParams("c1"));
    const data = await res.json();

    expect(data.accessPercent).toBe(69);
    expect(data.tier).toBe("limited");
  });

  test("sets accessPercent to 39 for minimal tier", async () => {
    mockClinicFindUnique.mockResolvedValue({ id: "c1", name: "City Physio", accessPercent: 90 });
    mockClinicUpdate.mockResolvedValue({ id: "c1", name: "City Physio", accessPercent: 39 });

    const { PUT } = await import("@/app/api/clinics/[id]/route");
    const res = await PUT(makeRequest({ tier: "minimal" }), makeParams("c1"));
    const data = await res.json();

    expect(data.accessPercent).toBe(39);
    expect(data.tier).toBe("minimal");
  });

  test("sets accessPercent to 19 for inactive tier", async () => {
    mockClinicFindUnique.mockResolvedValue({ id: "c1", name: "City Physio", accessPercent: 90 });
    mockClinicUpdate.mockResolvedValue({ id: "c1", name: "City Physio", accessPercent: 19 });

    const { PUT } = await import("@/app/api/clinics/[id]/route");
    const res = await PUT(makeRequest({ tier: "inactive" }), makeParams("c1"));
    const data = await res.json();

    expect(data.accessPercent).toBe(19);
    expect(data.tier).toBe("inactive");
  });
});
