/**
 * API Tests for POST /api/updates
 *
 * Verifies validation (missing fields → 400), episode not found → 404,
 * persistence (clinicalUpdate.create called), and correct response.
 */

const mockEpisodeFindUnique = jest.fn();
const mockUpdateCreate = jest.fn();
const mockUpdateCount = jest.fn();
const mockClinicFindUnique = jest.fn();
const mockClinicUpdate = jest.fn(async () => ({}));
const mockEventCreate = jest.fn(async () => ({}));

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    episode: { findUnique: mockEpisodeFindUnique },
    clinicalUpdate: { create: mockUpdateCreate, count: mockUpdateCount },
    clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
    simulationEvent: { create: mockEventCreate },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => ({
    user: { id: "u1", role: "clinician", clinicId: "c1" },
  })),
}));

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/updates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  episodeId: "ep1",
  painRegion: "Lower back",
  diagnosis: "Lumbar disc herniation",
  treatmentModalities: "Manual therapy",
};

describe("POST /api/updates - Validation & Persistence", () => {
  beforeEach(() => {
    mockEpisodeFindUnique.mockReset();
    mockUpdateCreate.mockReset();
    mockUpdateCount.mockReset();
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockEventCreate.mockClear();

    // Default mocks for points system
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(0);
  });

  test("returns 400 when episodeId is missing", async () => {
    const { POST } = await import("@/app/api/updates/route");
    const { episodeId: _, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  test("returns 400 when painRegion is missing", async () => {
    const { POST } = await import("@/app/api/updates/route");
    const { painRegion: _, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  test("returns 400 when diagnosis is missing", async () => {
    const { POST } = await import("@/app/api/updates/route");
    const { diagnosis: _, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  test("returns 400 when treatmentModalities is missing", async () => {
    const { POST } = await import("@/app/api/updates/route");
    const { treatmentModalities: _, ...body } = validBody;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  test("returns 404 when episode does not exist", async () => {
    mockEpisodeFindUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/updates/route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  test("creates clinical update with correct data", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", ...validBody });

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    expect(mockUpdateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        episodeId: "ep1",
        clinicId: "c1",
        userId: "u1",
        painRegion: "Lower back",
        diagnosis: "Lumbar disc herniation",
        treatmentModalities: "Manual therapy",
        redFlags: false,
        notes: "",
      }),
    });
  });

  test("returns 201 on successful creation", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", ...validBody });

    const { POST } = await import("@/app/api/updates/route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
  });
});
