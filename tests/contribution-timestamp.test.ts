/**
 * Tests for clinic contribution update + points system
 *
 * Verifies that creating a clinical update sets the clinic's
 * lastContributionAt timestamp and adds points to accessPercent.
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

describe("Contribution Timestamp + Points Update", () => {
  beforeEach(() => {
    mockEpisodeFindUnique.mockReset();
    mockUpdateCreate.mockReset();
    mockUpdateCount.mockReset();
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockEventCreate.mockClear();

    // Default: episode exists, clinic has accessPercent 50, no spam
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", ...validBody });
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(0);
  });

  test("updates clinic after creating an update", async () => {
    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    expect(mockClinicUpdate).toHaveBeenCalledTimes(1);
  });

  test("updates the correct clinic (user's clinicId)", async () => {
    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    expect(mockClinicUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
      })
    );
  });

  test("sets lastContributionAt to a Date", async () => {
    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    const updateArg = mockClinicUpdate.mock.calls[0][0];
    expect(updateArg.data.lastContributionAt).toBeInstanceOf(Date);
  });

  test("adds points to accessPercent when under spam cap", async () => {
    mockUpdateCount.mockResolvedValue(0); // no prior updates

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    const updateArg = mockClinicUpdate.mock.calls[0][0];
    expect(updateArg.data.accessPercent).toBe(56); // 50 + 6
  });

  test("does NOT update clinic when validation fails", async () => {
    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest({ episodeId: "ep1" })); // missing required fields

    expect(mockClinicUpdate).not.toHaveBeenCalled();
  });
});
