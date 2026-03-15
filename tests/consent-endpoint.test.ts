/**
 * Tests for PATCH /api/patients/[id]/consent
 *
 * Verifies:
 * - Auth required (401)
 * - Clinic-ownership check (clinician can update own-clinic, 403 for other)
 * - Valid consentStatus values (400)
 * - Pet not found (404)
 * - Successful toggle
 */

const mockPatientFindUnique = jest.fn();
const mockPatientUpdate = jest.fn();

let mockSession: Record<string, unknown> | null = null;

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    patient: { findUnique: mockPatientFindUnique, update: mockPatientUpdate },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => mockSession),
}));

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/patients/p1/consent", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/patients/[id]/consent", () => {
  beforeEach(() => {
    mockSession = { user: { id: "u3", role: "admin", clinicId: "c3" } };
    mockPatientFindUnique.mockReset();
    mockPatientUpdate.mockReset();
  });

  test("returns 401 when not authenticated", async () => {
    mockSession = null;

    const { PATCH } = await import("@/app/api/customers/[id]/consent/route");
    const res = await PATCH(makeRequest({ consentStatus: "OPT_OUT" }), makeParams("p1"));

    expect(res.status).toBe(401);
  });

  test("returns 403 when clinician updates another clinic's patient", async () => {
    mockSession = { user: { id: "u1", role: "clinician", clinicId: "c1" } };
    mockPatientFindUnique.mockResolvedValue({ id: "p1", clinicId: "c2" });

    const { PATCH } = await import("@/app/api/customers/[id]/consent/route");
    const res = await PATCH(makeRequest({ consentStatus: "OPT_OUT" }), makeParams("p1"));

    expect(res.status).toBe(403);
  });

  test("allows clinician to update own-clinic patient consent", async () => {
    mockSession = { user: { id: "u1", role: "clinician", clinicId: "c1" } };
    mockPatientFindUnique.mockResolvedValue({ id: "p1", clinicId: "c1", consentStatus: "SHARE" });
    mockPatientUpdate.mockResolvedValue({
      id: "p1",
      firstName: "John",
      lastName: "Smith",
      consentStatus: "OPT_OUT",
      consentUpdatedAt: new Date(),
    });

    const { PATCH } = await import("@/app/api/customers/[id]/consent/route");
    const res = await PATCH(makeRequest({ consentStatus: "OPT_OUT" }), makeParams("p1"));

    expect(res.status).toBe(200);
    expect((await res.json()).consentStatus).toBe("OPT_OUT");
  });

  test("returns 400 for invalid consentStatus", async () => {
    const { PATCH } = await import("@/app/api/customers/[id]/consent/route");
    const res = await PATCH(makeRequest({ consentStatus: "MAYBE" }), makeParams("p1"));

    expect(res.status).toBe(400);
  });

  test("returns 400 when consentStatus is missing", async () => {
    const { PATCH } = await import("@/app/api/customers/[id]/consent/route");
    const res = await PATCH(makeRequest({}), makeParams("p1"));

    expect(res.status).toBe(400);
  });

  test("returns 404 when patient not found", async () => {
    mockPatientFindUnique.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/customers/[id]/consent/route");
    const res = await PATCH(makeRequest({ consentStatus: "OPT_OUT" }), makeParams("p999"));

    expect(res.status).toBe(404);
  });

  test("sets consent to OPT_OUT", async () => {
    mockPatientFindUnique.mockResolvedValue({ id: "p1", consentStatus: "SHARE" });
    mockPatientUpdate.mockResolvedValue({
      id: "p1",
      firstName: "John",
      lastName: "Smith",
      consentStatus: "OPT_OUT",
      consentUpdatedAt: new Date(),
    });

    const { PATCH } = await import("@/app/api/customers/[id]/consent/route");
    const res = await PATCH(makeRequest({ consentStatus: "OPT_OUT" }), makeParams("p1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.consentStatus).toBe("OPT_OUT");
    expect(mockPatientUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ consentStatus: "OPT_OUT" }),
    });
  });

  test("sets consent to SHARE", async () => {
    mockPatientFindUnique.mockResolvedValue({ id: "p1", consentStatus: "OPT_OUT" });
    mockPatientUpdate.mockResolvedValue({
      id: "p1",
      firstName: "John",
      lastName: "Smith",
      consentStatus: "SHARE",
      consentUpdatedAt: new Date(),
    });

    const { PATCH } = await import("@/app/api/customers/[id]/consent/route");
    const res = await PATCH(makeRequest({ consentStatus: "SHARE" }), makeParams("p1"));
    const data = await res.json();

    expect(data.consentStatus).toBe("SHARE");
  });

  test("sets consentUpdatedAt to a Date", async () => {
    mockPatientFindUnique.mockResolvedValue({ id: "p1", consentStatus: "SHARE" });
    mockPatientUpdate.mockResolvedValue({
      id: "p1",
      firstName: "John",
      lastName: "Smith",
      consentStatus: "OPT_OUT",
      consentUpdatedAt: new Date(),
    });

    const { PATCH } = await import("@/app/api/customers/[id]/consent/route");
    await PATCH(makeRequest({ consentStatus: "OPT_OUT" }), makeParams("p1"));

    const updateArg = mockPatientUpdate.mock.calls[0][0];
    expect(updateArg.data.consentUpdatedAt).toBeInstanceOf(Date);
  });
});
