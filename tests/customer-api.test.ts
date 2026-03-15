/**
 * API Tests for Customer endpoints:
 * - POST /api/customers (create with phone uniqueness)
 * - DELETE /api/customers/[id] (vet own-clinic + admin, guarded by episodes)
 * - PATCH /api/customers/[id] (treatmentCompletedAt)
 * - PATCH /api/customers/[id]/consent (vet own-clinic + admin)
 */

import "./helpers/polyfills";

const mockPatientCreate = jest.fn();
const mockPatientFindUnique = jest.fn();
const mockPatientDelete = jest.fn();
const mockPatientUpdate = jest.fn();

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    patient: {
      create: mockPatientCreate,
      findUnique: mockPatientFindUnique,
      delete: mockPatientDelete,
      update: mockPatientUpdate,
    },
  })),
}));

const mockAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

// ---- POST /api/customers ----
describe("POST /api/customers", () => {
  let POST: (req: Request) => Promise<globalThis.Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/customers/route");
    POST = mod.POST as unknown as typeof POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
  });

  function makeReq(body: Record<string, unknown>) {
    return new Request("http://localhost/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as Request;
  }

  const validBody = {
    firstName: "Jane",
    lastName: "Doe",
    dateOfBirth: "1990-01-01",
    phoneNumber: "0412345678",
  };

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ user: null });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when missing required fields", async () => {
    const res = await POST(makeReq({ firstName: "Jane" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing required fields");
  });

  it("returns 400 for invalid phone number", async () => {
    const res = await POST(makeReq({ ...validBody, phoneNumber: "abc" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid phone number");
  });

  it("returns 409 when phone number already exists", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: "existing" });
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already exists");
  });

  it("creates customer with cleaned phone number", async () => {
    mockPatientFindUnique.mockResolvedValueOnce(null);
    mockPatientCreate.mockResolvedValueOnce({
      id: "p1",
      firstName: "Jane",
      lastName: "Doe",
      phoneNumber: "0412345678",
    });

    const res = await POST(
      makeReq({ ...validBody, phoneNumber: "0412 345 678" })
    );
    expect(res.status).toBe(201);

    expect(mockPatientCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phoneNumber: "0412345678",
        clinicId: "c1",
      }),
    });
  });

  it("assigns customer to current user's clinic", async () => {
    mockPatientFindUnique.mockResolvedValueOnce(null);
    mockPatientCreate.mockResolvedValueOnce({ id: "p1" });

    await POST(makeReq(validBody));
    expect(mockPatientCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ clinicId: "c1" }),
    });
  });
});

// ---- DELETE /api/customers/[id] ----
describe("DELETE /api/customers/[id]", () => {
  let DELETE: (
    req: Request,
    ctx: { params: Promise<{ id: string }> }
  ) => Promise<globalThis.Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/customers/[id]/route");
    DELETE = mod.DELETE as unknown as typeof DELETE;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "admin", clinicId: "c1" },
    });
  });

  const ctx = { params: Promise.resolve({ id: "p1" }) };

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ user: null });
    const res = await DELETE(
      new Request("http://localhost") as unknown as Request,
      ctx
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when vet deletes customer from another clinic", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
    mockPatientFindUnique.mockResolvedValueOnce({
      id: "p1",
      clinicId: "c2",
      _count: { episodes: 0 },
    });
    const res = await DELETE(
      new Request("http://localhost") as unknown as Request,
      ctx
    );
    expect(res.status).toBe(403);
  });

  it("allows vet to delete own-clinic customer with no episodes", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
    mockPatientFindUnique.mockResolvedValueOnce({
      id: "p1",
      clinicId: "c1",
      _count: { episodes: 0 },
    });
    mockPatientDelete.mockResolvedValueOnce({});
    const res = await DELETE(
      new Request("http://localhost") as unknown as Request,
      ctx
    );
    expect(res.status).toBe(200);
    expect(mockPatientDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });

  it("returns 404 when customer not found", async () => {
    mockPatientFindUnique.mockResolvedValueOnce(null);
    const res = await DELETE(
      new Request("http://localhost") as unknown as Request,
      ctx
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when customer has episodes", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({
      id: "p1",
      clinicId: "c1",
      _count: { episodes: 2 },
    });
    const res = await DELETE(
      new Request("http://localhost") as unknown as Request,
      ctx
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("existing visits");
  });

  it("admin can delete customer from any clinic", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({
      id: "p1",
      clinicId: "c2",
      _count: { episodes: 0 },
    });
    mockPatientDelete.mockResolvedValueOnce({});
    const res = await DELETE(
      new Request("http://localhost") as unknown as Request,
      ctx
    );
    expect(res.status).toBe(200);
    expect(mockPatientDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });
});

// ---- PATCH /api/customers/[id] ----
describe("PATCH /api/customers/[id]", () => {
  let PATCH: (
    req: Request,
    ctx: { params: Promise<{ id: string }> }
  ) => Promise<globalThis.Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/customers/[id]/route");
    PATCH = mod.PATCH as unknown as typeof PATCH;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
  });

  const ctx = { params: Promise.resolve({ id: "p1" }) };

  function makeReq(body: Record<string, unknown>) {
    return new Request("http://localhost/api/customers/p1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as Request;
  }

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ user: null });
    const res = await PATCH(makeReq({}), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 403 when vet updates customer from another clinic", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: "p1", clinicId: "c2" });
    const res = await PATCH(
      makeReq({ treatmentCompletedAt: "2026-02-24" }),
      ctx
    );
    expect(res.status).toBe(403);
  });

  it("allows vet to update own-clinic customer", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: "p1", clinicId: "c1" });
    mockPatientUpdate.mockResolvedValueOnce({ id: "p1", treatmentCompletedAt: new Date("2026-02-24") });
    const res = await PATCH(
      makeReq({ treatmentCompletedAt: "2026-02-24" }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(mockPatientUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { treatmentCompletedAt: expect.any(Date) },
    });
  });

  it("allows admin to update any customer", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "u1", role: "admin", clinicId: "c1" },
    });
    mockPatientFindUnique.mockResolvedValueOnce({ id: "p1", clinicId: "c2" });
    mockPatientUpdate.mockResolvedValueOnce({ id: "p1" });
    const res = await PATCH(
      makeReq({ treatmentCompletedAt: "2026-02-24" }),
      ctx
    );
    expect(res.status).toBe(200);
  });

  it("can clear treatmentCompletedAt by passing null", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: "p1", clinicId: "c1" });
    mockPatientUpdate.mockResolvedValueOnce({ id: "p1", treatmentCompletedAt: null });
    const res = await PATCH(
      makeReq({ treatmentCompletedAt: null }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(mockPatientUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { treatmentCompletedAt: null },
    });
  });

  it("returns 400 when no valid fields provided", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: "p1", clinicId: "c1" });
    const res = await PATCH(makeReq({ foo: "bar" }), ctx);
    expect(res.status).toBe(400);
  });
});

// ---- PATCH /api/customers/[id]/consent ----
describe("PATCH /api/customers/[id]/consent", () => {
  let PATCH_CONSENT: (
    req: Request,
    ctx: { params: Promise<{ id: string }> }
  ) => Promise<globalThis.Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/customers/[id]/consent/route");
    PATCH_CONSENT = mod.PATCH as unknown as typeof PATCH_CONSENT;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
  });

  const ctx = { params: Promise.resolve({ id: "p1" }) };

  function makeReq(body: Record<string, unknown>) {
    return new Request("http://localhost/api/customers/p1/consent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as Request;
  }

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ user: null });
    const res = await PATCH_CONSENT(
      makeReq({ consentStatus: "SHARE" }),
      ctx
    );
    expect(res.status).toBe(401);
  });

  it("allows vet to update consent for own-clinic customer", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: "p1", clinicId: "c1" });
    mockPatientUpdate.mockResolvedValueOnce({
      id: "p1",
      firstName: "John",
      lastName: "Smith",
      consentStatus: "OPT_OUT",
      consentUpdatedAt: new Date(),
    });
    const res = await PATCH_CONSENT(
      makeReq({ consentStatus: "OPT_OUT" }),
      ctx
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.consentStatus).toBe("OPT_OUT");
  });

  it("returns 403 when vet updates consent for another clinic's customer", async () => {
    mockPatientFindUnique.mockResolvedValueOnce({ id: "p1", clinicId: "c2" });
    const res = await PATCH_CONSENT(
      makeReq({ consentStatus: "OPT_OUT" }),
      ctx
    );
    expect(res.status).toBe(403);
  });

  it("allows admin to update consent for any customer", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "u1", role: "admin", clinicId: "c1" },
    });
    mockPatientFindUnique.mockResolvedValueOnce({ id: "p1", clinicId: "c2" });
    mockPatientUpdate.mockResolvedValueOnce({
      id: "p1",
      firstName: "John",
      lastName: "Smith",
      consentStatus: "SHARE",
      consentUpdatedAt: new Date(),
    });
    const res = await PATCH_CONSENT(
      makeReq({ consentStatus: "SHARE" }),
      ctx
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid consentStatus", async () => {
    const res = await PATCH_CONSENT(
      makeReq({ consentStatus: "INVALID" }),
      ctx
    );
    expect(res.status).toBe(400);
  });
});
