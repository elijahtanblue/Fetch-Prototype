/**
 * API Tests for POST /api/episodes
 *
 * Verifies validation (missing fields → 400), patient not found → 404,
 * persistence (episode.create called), and successful response.
 */

const mockPatientFindUnique = jest.fn();
const mockEpisodeCreate = jest.fn();
const mockEventCreate = jest.fn(async () => ({}));

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    patient: { findUnique: mockPatientFindUnique },
    episode: { create: mockEpisodeCreate },
    simulationEvent: { create: mockEventCreate },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => ({
    user: { id: "u1", role: "clinician", clinicId: "c1" },
  })),
}));

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/episodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/episodes - Validation & Persistence", () => {
  beforeEach(() => {
    mockPatientFindUnique.mockReset();
    mockEpisodeCreate.mockReset();
    mockEventCreate.mockClear();
  });

  test("returns 400 when patientId is missing", async () => {
    const { POST } = await import("@/app/api/episodes/route");
    const res = await POST(makeRequest({ reason: "Back pain", startDate: "2026-02-22" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 when reason is missing", async () => {
    const { POST } = await import("@/app/api/episodes/route");
    const res = await POST(makeRequest({ patientId: "p1", startDate: "2026-02-22" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 when startDate is missing", async () => {
    const { POST } = await import("@/app/api/episodes/route");
    const res = await POST(makeRequest({ patientId: "p1", reason: "Back pain" }));
    expect(res.status).toBe(400);
  });

  test("returns 404 when patient does not exist", async () => {
    mockPatientFindUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/episodes/route");
    const res = await POST(
      makeRequest({ patientId: "p999", reason: "Back pain", startDate: "2026-02-22" })
    );
    expect(res.status).toBe(404);
  });

  test("creates episode with correct data", async () => {
    mockPatientFindUnique.mockResolvedValue({ id: "p1" });
    mockEpisodeCreate.mockResolvedValue({
      id: "ep1",
      patientId: "p1",
      clinicId: "c1",
      userId: "u1",
      reason: "Back pain",
      startDate: new Date("2026-02-22"),
    });

    const { POST } = await import("@/app/api/episodes/route");
    await POST(
      makeRequest({ patientId: "p1", reason: "Back pain", startDate: "2026-02-22" })
    );

    expect(mockEpisodeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: "p1",
        clinicId: "c1",
        userId: "u1",
        reason: "Back pain",
      }),
    });
  });

  test("returns 201 on successful creation", async () => {
    mockPatientFindUnique.mockResolvedValue({ id: "p1" });
    mockEpisodeCreate.mockResolvedValue({
      id: "ep1",
      patientId: "p1",
      clinicId: "c1",
      userId: "u1",
      reason: "Back pain",
      startDate: new Date("2026-02-22"),
    });

    const { POST } = await import("@/app/api/episodes/route");
    const res = await POST(
      makeRequest({ patientId: "p1", reason: "Back pain", startDate: "2026-02-22" })
    );
    expect(res.status).toBe(201);
  });
});
