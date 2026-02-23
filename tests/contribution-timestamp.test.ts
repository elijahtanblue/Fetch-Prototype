/**
 * Tests for clinic contribution update + points system
 *
 * Verifies that creating a clinical update sets the clinic's
 * lastContributionAt timestamp and creates an AccessEvent via points ledger.
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

describe("Contribution Timestamp + Points Update", () => {
  beforeEach(() => {
    mockEpisodeFindUnique.mockReset();
    mockUpdateCreate.mockReset();
    mockUpdateCount.mockReset();
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockEventCreate.mockClear();
    mockAccessEventCreate.mockClear();

    // Default: episode exists, clinic has accessPercent 50, no spam
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", ...validBody });
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(0);
  });

  test("updates clinic with lastContributionAt after creating an update", async () => {
    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    // clinic.update is called for timestamps
    const timestampCall = mockClinicUpdate.mock.calls.find(
      (call: Array<Record<string, unknown>>) => call[0]?.data && 'lastContributionAt' in (call[0].data as Record<string, unknown>)
    );
    expect(timestampCall).toBeDefined();
    expect((timestampCall![0].data as Record<string, unknown>).lastContributionAt).toBeInstanceOf(Date);
  });

  test("creates AccessEvent when points earned", async () => {
    mockUpdateCount.mockResolvedValue(0);

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    expect(mockAccessEventCreate).toHaveBeenCalledTimes(1);
    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "c1",
        delta: 6,
        reasonCode: "STRUCTURED_UPDATE",
      }),
    });
  });

  test("does NOT update clinic when validation fails", async () => {
    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest({ episodeId: "ep1" })); // missing required fields

    expect(mockClinicUpdate).not.toHaveBeenCalled();
    expect(mockAccessEventCreate).not.toHaveBeenCalled();
  });
});
