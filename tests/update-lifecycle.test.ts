/**
 * Tests for update lifecycle:
 * - PATCH /api/updates/[id] (edit)
 * - DELETE /api/updates/[id] (delete)
 * - dateOfVisit on create
 * - Authorization (cross-clinic prevention)
 */

import "./helpers/polyfills";

const mockUpdateFindUnique = jest.fn();
const mockUpdateUpdate = jest.fn();
const mockUpdateDelete = jest.fn();
const mockUpdateCreate = jest.fn();
const mockUpdateCount = jest.fn();
const mockEpisodeFindUnique = jest.fn();
const mockClinicFindUnique = jest.fn();
const mockClinicUpdate = jest.fn(async () => ({}));
const mockEventCreate = jest.fn(async () => ({}));
const mockAccessEventCreate = jest.fn(async () => ({}));

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinicalUpdate: {
      findUnique: mockUpdateFindUnique,
      update: mockUpdateUpdate,
      delete: mockUpdateDelete,
      create: mockUpdateCreate,
      count: mockUpdateCount,
    },
    episode: { findUnique: mockEpisodeFindUnique },
    clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
    simulationEvent: { create: mockEventCreate },
    accessEvent: { create: mockAccessEventCreate },
  })),
}));

const mockAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

// ---- PATCH /api/updates/[id] ----
describe("PATCH /api/updates/[id]", () => {
  let PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<globalThis.Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/updates/[id]/route");
    PATCH = mod.PATCH as unknown as typeof PATCH;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
  });

  const ctx = { params: Promise.resolve({ id: "cu1" }) };

  function makeReq(body: Record<string, unknown>) {
    return new Request("http://localhost/api/updates/cu1", {
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

  it("returns 404 when update not found", async () => {
    mockUpdateFindUnique.mockResolvedValueOnce(null);
    const res = await PATCH(makeReq({ painRegion: "Neck" }), ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when clinician edits another clinic's update", async () => {
    mockUpdateFindUnique.mockResolvedValueOnce({ id: "cu1", clinicId: "c2" });
    const res = await PATCH(makeReq({ painRegion: "Neck" }), ctx);
    expect(res.status).toBe(403);
  });

  it("edits own-clinic update successfully", async () => {
    mockUpdateFindUnique.mockResolvedValueOnce({ id: "cu1", clinicId: "c1" });
    mockUpdateUpdate.mockResolvedValueOnce({ id: "cu1", painRegion: "Neck" });

    const res = await PATCH(makeReq({ painRegion: "Neck", diagnosis: "Strain" }), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateUpdate).toHaveBeenCalledWith({
      where: { id: "cu1" },
      data: { painRegion: "Neck", diagnosis: "Strain" },
    });
  });

  it("updates dateOfVisit", async () => {
    mockUpdateFindUnique.mockResolvedValueOnce({ id: "cu1", clinicId: "c1" });
    mockUpdateUpdate.mockResolvedValueOnce({ id: "cu1" });

    const res = await PATCH(makeReq({ dateOfVisit: "2026-02-20" }), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateUpdate).toHaveBeenCalledWith({
      where: { id: "cu1" },
      data: { dateOfVisit: expect.any(Date) },
    });
  });

  it("clears dateOfVisit when null", async () => {
    mockUpdateFindUnique.mockResolvedValueOnce({ id: "cu1", clinicId: "c1" });
    mockUpdateUpdate.mockResolvedValueOnce({ id: "cu1" });

    const res = await PATCH(makeReq({ dateOfVisit: null }), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateUpdate).toHaveBeenCalledWith({
      where: { id: "cu1" },
      data: { dateOfVisit: null },
    });
  });

  it("regenerates notesSummary when notesRaw is edited", async () => {
    mockUpdateFindUnique.mockResolvedValueOnce({ id: "cu1", clinicId: "c1" });
    mockUpdateUpdate.mockResolvedValueOnce({ id: "cu1" });

    const res = await PATCH(makeReq({ notesRaw: "Patient reports improvement. Continuing exercises." }), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateUpdate).toHaveBeenCalledWith({
      where: { id: "cu1" },
      data: expect.objectContaining({
        notesRaw: "Patient reports improvement. Continuing exercises.",
        notesSummary: expect.any(String),
        notes: expect.any(String),
      }),
    });
  });

  it("returns 400 when no valid fields provided", async () => {
    mockUpdateFindUnique.mockResolvedValueOnce({ id: "cu1", clinicId: "c1" });
    const res = await PATCH(makeReq({ foo: "bar" }), ctx);
    expect(res.status).toBe(400);
  });
});

// ---- DELETE /api/updates/[id] ----
describe("DELETE /api/updates/[id]", () => {
  let DELETE: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<globalThis.Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/updates/[id]/route");
    DELETE = mod.DELETE as unknown as typeof DELETE;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
  });

  const ctx = { params: Promise.resolve({ id: "cu1" }) };
  const emptyReq = new Request("http://localhost") as unknown as Request;

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce({ user: null });
    const res = await DELETE(emptyReq, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when update not found", async () => {
    mockUpdateFindUnique.mockResolvedValueOnce(null);
    const res = await DELETE(emptyReq, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when clinician deletes another clinic's update", async () => {
    mockUpdateFindUnique.mockResolvedValueOnce({ id: "cu1", clinicId: "c2" });
    const res = await DELETE(emptyReq, ctx);
    expect(res.status).toBe(403);
  });

  it("deletes own-clinic update", async () => {
    mockUpdateFindUnique.mockResolvedValueOnce({ id: "cu1", clinicId: "c1" });
    mockUpdateDelete.mockResolvedValueOnce({});
    const res = await DELETE(emptyReq, ctx);
    expect(res.status).toBe(200);
    expect(mockUpdateDelete).toHaveBeenCalledWith({ where: { id: "cu1" } });
  });

  it("admin can delete any update", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "u1", role: "admin", clinicId: "c1" },
    });
    mockUpdateFindUnique.mockResolvedValueOnce({ id: "cu1", clinicId: "c2" });
    mockUpdateDelete.mockResolvedValueOnce({});
    const res = await DELETE(emptyReq, ctx);
    expect(res.status).toBe(200);
  });
});

// ---- dateOfVisit on POST /api/updates ----
describe("POST /api/updates — dateOfVisit", () => {
  let POST: (req: Request) => Promise<globalThis.Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/updates/route");
    POST = mod.POST as unknown as typeof POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", clinicId: "c1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1" });
    mockUpdateCount.mockResolvedValue(0);
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockClinicUpdate.mockResolvedValue({});
    mockAccessEventCreate.mockResolvedValue({});
    mockEventCreate.mockResolvedValue({});
  });

  it("stores dateOfVisit when provided", async () => {
    const req = new Request("http://localhost/api/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId: "ep1",
        painRegion: "Back",
        diagnosis: "Sprain",
        treatmentModalities: "Ice",
        dateOfVisit: "2026-02-20",
      }),
    });
    await POST(req);

    expect(mockUpdateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dateOfVisit: expect.any(Date),
      }),
    });
  });

  it("stores null dateOfVisit when not provided", async () => {
    const req = new Request("http://localhost/api/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId: "ep1",
        painRegion: "Back",
        diagnosis: "Sprain",
        treatmentModalities: "Ice",
      }),
    });
    await POST(req);

    expect(mockUpdateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dateOfVisit: null,
      }),
    });
  });
});
