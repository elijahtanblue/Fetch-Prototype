/**
 * Tests for points addition and anti-spam cap in the updates endpoint.
 *
 * Verifies:
 * - +6 points per clinical update
 * - Cap at 100
 * - Anti-spam: max 3 point-earning updates per patient per 7 days
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

describe("Points + Anti-Spam", () => {
  beforeEach(() => {
    mockEpisodeFindUnique.mockReset();
    mockUpdateCreate.mockReset();
    mockUpdateCount.mockReset();
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockEventCreate.mockClear();

    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", ...validBody });
  });

  test("adds 6 points when under spam cap (0 prior updates)", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(0);

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    const updateArg = mockClinicUpdate.mock.calls[0][0];
    expect(updateArg.data.accessPercent).toBe(56); // 50 + 6
  });

  test("adds 6 points when under spam cap (2 prior updates)", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 30, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(2); // 2 prior, under cap of 3

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    const updateArg = mockClinicUpdate.mock.calls[0][0];
    expect(updateArg.data.accessPercent).toBe(36); // 30 + 6
  });

  test("does NOT add points when at spam cap (3 prior updates)", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(3); // at cap

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    const updateArg = mockClinicUpdate.mock.calls[0][0];
    expect(updateArg.data.accessPercent).toBe(50); // unchanged
  });

  test("does NOT add points when over spam cap (5 prior updates)", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 60, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(5);

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    const updateArg = mockClinicUpdate.mock.calls[0][0];
    expect(updateArg.data.accessPercent).toBe(60); // unchanged
  });

  test("caps accessPercent at 100", async () => {
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 97, lastDecayAt: new Date() });
    mockUpdateCount.mockResolvedValue(0);

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    const updateArg = mockClinicUpdate.mock.calls[0][0];
    expect(updateArg.data.accessPercent).toBe(100); // 97 + 6 = 103 → capped at 100
  });

  test("applies decay before adding points", async () => {
    // 5 days ago → 5% decay. 60 - 5 = 55, then +6 = 61
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 60, lastDecayAt: fiveDaysAgo });
    mockUpdateCount.mockResolvedValue(0);

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest(validBody));

    const updateArg = mockClinicUpdate.mock.calls[0][0];
    // After decay: 60 - 5 = 55, then +6 = 61
    expect(updateArg.data.accessPercent).toBe(61);
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
});
