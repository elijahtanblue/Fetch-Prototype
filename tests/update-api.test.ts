/**
 * API Tests for POST /api/updates
 *
 * Verifies validation (missing fields → 400), episode not found → 404,
 * persistence (clinicalUpdate.create called), correct response,
 * and workflow-specific behavior (STRUCTURED vs QUICK_HANDOFF).
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

describe("POST /api/updates - Validation & Persistence", () => {
  beforeEach(() => {
    mockEpisodeFindUnique.mockReset();
    mockUpdateCreate.mockReset();
    mockUpdateCount.mockReset();
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockEventCreate.mockClear();
    mockAccessEventCreate.mockClear();

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

  test("returns 400 when treatmentModalities is missing for STRUCTURED", async () => {
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
        updateType: "STRUCTURED",
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

  test("returns 400 for invalid updateType", async () => {
    const { POST } = await import("@/app/api/updates/route");
    const res = await POST(makeRequest({ ...validBody, updateType: "INVALID" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid updateType");
  });

  test("QUICK_HANDOFF requires treatmentModalities", async () => {
    const { POST } = await import("@/app/api/updates/route");
    const res = await POST(makeRequest({
      episodeId: "ep1",
      painRegion: "Neck",
      diagnosis: "Strain",
      updateType: "QUICK_HANDOFF",
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("treatmentModalities");
  });

  test("QUICK_HANDOFF succeeds with all required fields", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", updateType: "QUICK_HANDOFF" });

    const { POST } = await import("@/app/api/updates/route");
    const res = await POST(makeRequest({
      episodeId: "ep1",
      painRegion: "Neck",
      diagnosis: "Strain",
      treatmentModalities: "Ice therapy",
      updateType: "QUICK_HANDOFF",
    }));
    expect(res.status).toBe(201);
  });

  test("QUICK_HANDOFF awards 2 points (not 6)", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", updateType: "QUICK_HANDOFF" });

    const { POST } = await import("@/app/api/updates/route");
    const res = await POST(makeRequest({
      episodeId: "ep1",
      painRegion: "Neck",
      diagnosis: "Strain",
      treatmentModalities: "Ice therapy",
      updateType: "QUICK_HANDOFF",
    }));
    const data = await res.json();
    expect(data.pointsEarned).toBe(2);
  });

  test("STRUCTURED awards 6 points", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1", ...validBody });

    const { POST } = await import("@/app/api/updates/route");
    const res = await POST(makeRequest(validBody));
    const data = await res.json();
    expect(data.pointsEarned).toBe(6);
  });

  test("STRUCTURED with notesRaw generates notesSummary", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1" });

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest({
      ...validBody,
      notesRaw: "Patient showed significant improvement. Further monitoring recommended.",
    }));

    const createCall = mockUpdateCreate.mock.calls[0][0];
    expect(createCall.data.notesRaw).toBe("Patient showed significant improvement. Further monitoring recommended.");
    expect(createCall.data.notesSummary).toBe("Patient showed significant improvement.");
    expect(createCall.data.notes).toBe("Patient showed significant improvement.");
  });

  test("STRUCTURED saves precautions, responsePattern, suggestedNextSteps", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1" });

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest({
      ...validBody,
      precautions: "Avoid lifting",
      responsePattern: "Improves with rest",
      suggestedNextSteps: "Reassess in 2 weeks",
    }));

    const createCall = mockUpdateCreate.mock.calls[0][0];
    expect(createCall.data.precautions).toBe("Avoid lifting");
    expect(createCall.data.responsePattern).toBe("Improves with rest");
    expect(createCall.data.suggestedNextSteps).toBe("Reassess in 2 weeks");
  });

  test("QUICK_HANDOFF with notesRaw generates notesSummary", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1" });

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest({
      episodeId: "ep1",
      painRegion: "Neck",
      diagnosis: "Strain",
      treatmentModalities: "Ice therapy",
      updateType: "QUICK_HANDOFF",
      notesRaw: "Patient reports improvement. Continue current plan.",
    }));

    const createCall = mockUpdateCreate.mock.calls[0][0];
    expect(createCall.data.notesRaw).toBe("Patient reports improvement. Continue current plan.");
    expect(createCall.data.notesSummary).toBe("Patient reports improvement.");
    expect(createCall.data.notes).toBe("Patient reports improvement.");
  });

  test("QUICK_HANDOFF uses QUICK_HANDOFF reason code", async () => {
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1" });

    const { POST } = await import("@/app/api/updates/route");
    await POST(makeRequest({
      episodeId: "ep1",
      painRegion: "Neck",
      diagnosis: "Strain",
      treatmentModalities: "Ice therapy",
      updateType: "QUICK_HANDOFF",
    }));

    // Check accessEvent was created with QUICK_HANDOFF reason
    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reasonCode: "QUICK_HANDOFF",
        delta: 2,
      }),
    });
  });
});
