/**
 * SimulationEvent Tests for POST /api/episodes and POST /api/updates
 *
 * Verifies that VISIT and CLINICAL_UPDATE SimulationEvents are created
 * with correct type, clinicId, userId, and metadata.
 */

const mockPatientFindUnique = jest.fn();
const mockEpisodeCreate = jest.fn();
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
    patient: { findUnique: mockPatientFindUnique },
    episode: { create: mockEpisodeCreate, findUnique: mockEpisodeFindUnique },
    clinicalUpdate: { create: mockUpdateCreate, count: mockUpdateCount },
    clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
    simulationEvent: { create: mockEventCreate },
    accessEvent: { create: jest.fn(async () => ({})) },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => ({
    user: { id: "u1", role: "clinician", clinicId: "c1" },
  })),
}));

describe("SimulationEvent - VISIT (Episode Creation)", () => {
  beforeEach(() => {
    mockPatientFindUnique.mockReset();
    mockEpisodeCreate.mockReset();
    mockEventCreate.mockClear();
  });

  test("creates a VISIT SimulationEvent when episode is created", async () => {
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
    const req = new Request("http://localhost/api/episodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: "p1", reason: "Back pain", startDate: "2026-02-22" }),
    });
    await POST(req);

    expect(mockEventCreate).toHaveBeenCalledTimes(1);
    const arg = mockEventCreate.mock.calls[0][0];
    expect(arg.data.type).toBe("VISIT");
    expect(arg.data.clinicId).toBe("c1");
    expect(arg.data.userId).toBe("u1");
  });

  test("VISIT event metadata contains episodeId and patientId", async () => {
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
    const req = new Request("http://localhost/api/episodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: "p1", reason: "Back pain", startDate: "2026-02-22" }),
    });
    await POST(req);

    const metadata = JSON.parse(mockEventCreate.mock.calls[0][0].data.metadata);
    expect(metadata.episodeId).toBe("ep1");
    expect(metadata.patientId).toBe("p1");
  });
});

describe("SimulationEvent - CLINICAL_UPDATE", () => {
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

  test("creates a CLINICAL_UPDATE SimulationEvent when update is created", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1" });

    const { POST } = await import("@/app/api/updates/route");
    const req = new Request("http://localhost/api/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId: "ep1",
        painRegion: "Lower back",
        diagnosis: "Disc herniation",
        treatmentModalities: "Manual therapy",
      }),
    });
    await POST(req);

    expect(mockEventCreate).toHaveBeenCalledTimes(1);
    const arg = mockEventCreate.mock.calls[0][0];
    expect(arg.data.type).toBe("CLINICAL_UPDATE");
    expect(arg.data.clinicId).toBe("c1");
    expect(arg.data.userId).toBe("u1");
  });

  test("CLINICAL_UPDATE event metadata contains clinicalUpdateId and episodeId", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1" });

    const { POST } = await import("@/app/api/updates/route");
    const req = new Request("http://localhost/api/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId: "ep1",
        painRegion: "Lower back",
        diagnosis: "Disc herniation",
        treatmentModalities: "Manual therapy",
      }),
    });
    await POST(req);

    const metadata = JSON.parse(mockEventCreate.mock.calls[0][0].data.metadata);
    expect(metadata.clinicalUpdateId).toBe("cu1");
    expect(metadata.episodeId).toBe("ep1");
  });
});
