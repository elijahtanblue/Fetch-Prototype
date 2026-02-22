/**
 * Tests for clinic.lastContributionAt update
 *
 * Verifies that creating a clinical update sets the clinic's
 * lastContributionAt timestamp.
 */

const mockEpisodeFindUnique = jest.fn();
const mockUpdateCreate = jest.fn();
const mockClinicUpdate = jest.fn(async () => ({}));
const mockEventCreate = jest.fn(async () => ({}));

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    episode: { findUnique: mockEpisodeFindUnique },
    clinicalUpdate: { create: mockUpdateCreate },
    clinic: { update: mockClinicUpdate },
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

describe("Contribution Timestamp Update", () => {
  beforeEach(() => {
    mockEpisodeFindUnique.mockReset();
    mockUpdateCreate.mockReset();
    mockClinicUpdate.mockReset();
    mockEventCreate.mockClear();
  });

  test("updates clinic.lastContributionAt after creating an update", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", ...validBody });

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    expect(mockClinicUpdate).toHaveBeenCalledTimes(1);
  });

  test("updates the correct clinic (user's clinicId)", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", ...validBody });

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    expect(mockClinicUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
      })
    );
  });

  test("sets lastContributionAt to a Date", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", ...validBody });

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    const updateArg = mockClinicUpdate.mock.calls[0][0];
    expect(updateArg.data.lastContributionAt).toBeInstanceOf(Date);
  });

  test("does NOT update lastContributionAt when validation fails", async () => {
    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest({ episodeId: "ep1" })); // missing required fields

    expect(mockClinicUpdate).not.toHaveBeenCalled();
  });
});
