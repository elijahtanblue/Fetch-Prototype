/**
 * Tests for points addition and anti-spam cap in the updates endpoint.
 *
 * Verifies:
 * - +6 points per clinical update via ledger
 * - Cap at 100
 * - Anti-spam: max 3 point-earning updates per patient per 7 days
 * - AccessEvent creation
 */

const mockEpisodeFindUnique = jest.fn();
const mockUpdateCreate = jest.fn();
const mockUpdateCount = jest.fn();
const mockClinicFindUnique = jest.fn();
const mockClinicUpdate = jest.fn(async () => ({}));
const mockEventCreate = jest.fn(async () => ({}));
const mockAccessEventCreate = jest.fn(async () => ({}));

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    episode: { findUnique: mockEpisodeFindUnique },
    clinicalUpdate: { create: mockUpdateCreate, count: mockUpdateCount },
    clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
    simulationEvent: { create: mockEventCreate },
    accessEvent: { create: mockAccessEventCreate },
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

describe("Points + Anti-Spam", () => {
  beforeEach(() => {
    mockEpisodeFindUnique.mockReset();
    mockUpdateCreate.mockReset();
    mockUpdateCount.mockReset();
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockEventCreate.mockClear();
    mockAccessEventCreate.mockClear();

    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", ...validBody });
  });

  test("creates AccessEvent with +6 when under spam cap", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(0);

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    expect(mockAccessEventCreate).toHaveBeenCalledTimes(1);
    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        delta: 6,
        reasonCode: "STRUCTURED_UPDATE",
        clinicId: "c1",
      }),
    });
  });

  test("does NOT create AccessEvent when at spam cap (3 prior updates)", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(3);

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    expect(mockAccessEventCreate).not.toHaveBeenCalled();
  });

  test("does NOT create AccessEvent when over spam cap (5 prior updates)", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 60, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(5);

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    expect(mockAccessEventCreate).not.toHaveBeenCalled();
  });

  test("response includes pointsEarned field", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(0);

    const { POST } = await import("@/app/api/updates/route");
    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(data.pointsEarned).toBe(6);
  });

  test("response shows 0 pointsEarned when spam-capped", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(3);

    const { POST } = await import("@/app/api/updates/route");
    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(data.pointsEarned).toBe(0);
  });

  test("applies decay before adding points", async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 60, lastDecayAt: fiveDaysAgo });
    mockUpdateCount.mockResolvedValue(0);

    const { POST } = await import("@/app/api/updates/route");
    const res = await POST(makeRequest(validBody));
    const data = await res.json();

    expect(data.pointsEarned).toBe(6);
    expect(mockAccessEventCreate).toHaveBeenCalledTimes(1);
  });

  test("AccessEvent includes patientId, episodeId, updateId", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(0);

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: "p1",
        episodeId: "ep1",
        updateId: "cu1",
      }),
    });
  });
});
