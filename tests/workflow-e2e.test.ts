/**
 * Milestone 5 — End-to-end happy path tests for both workflows.
 *
 * Verifies:
 * - STRUCTURED workflow: full fields + summary + 6pts
 * - QUICK_HANDOFF workflow: minimal fields + summary + 2pts
 * - Both workflows in same episode produce correct snapshot
 * - notesRaw firewall enforced across both types in snapshot
 * - dateOfVisit compatibility with both workflows
 * - Points/tier integration regressions
 */

import "./helpers/polyfills";

const mockEpisodeFindUnique = jest.fn();
const mockUpdateCreate = jest.fn();
const mockUpdateCount = jest.fn();
const mockClinicFindUnique = jest.fn();
const mockClinicUpdate = jest.fn(async () => ({}));
const mockEventCreate = jest.fn(async () => ({}));
const mockAccessEventCreate = jest.fn(async () => ({}));
const mockUpdateFindMany = jest.fn();
const mockPatientFindUnique = jest.fn();

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    episode: { findUnique: mockEpisodeFindUnique },
    clinicalUpdate: {
      create: mockUpdateCreate,
      count: mockUpdateCount,
      findMany: mockUpdateFindMany,
    },
    clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
    simulationEvent: { create: mockEventCreate },
    accessEvent: { create: mockAccessEventCreate },
    patient: { findUnique: mockPatientFindUnique },
  })),
}));

const mockAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

function makeUpdateReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/updates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSnapshotParams(patientId: string) {
  return { params: Promise.resolve({ patientId }) };
}

describe("STRUCTURED workflow — end-to-end happy path", () => {
  let POST: (req: Request) => Promise<Response>;

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
  });

  it("creates STRUCTURED update with all fields, summary, dateOfVisit, and awards 6 points", async () => {
    const res = await POST(makeUpdateReq({
      episodeId: "ep1",
      updateType: "STRUCTURED",
      painRegion: "Lower back, L4-L5",
      diagnosis: "Lumbar disc herniation",
      treatmentModalities: "Manual therapy, exercise prescription",
      redFlags: true,
      precautions: "Avoid heavy lifting",
      responsePattern: "Improves with extension exercises",
      suggestedNextSteps: "Reassess in 2 weeks",
      notesRaw: "Patient presented with acute LBP. Neurological exam clear. Started McKenzie protocol.",
      dateOfVisit: "2026-02-20",
    }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.pointsEarned).toBe(6);

    // Verify create was called with correct data
    expect(mockUpdateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        updateType: "STRUCTURED",
        painRegion: "Lower back, L4-L5",
        diagnosis: "Lumbar disc herniation",
        treatmentModalities: "Manual therapy, exercise prescription",
        redFlags: true,
        precautions: "Avoid heavy lifting",
        responsePattern: "Improves with extension exercises",
        suggestedNextSteps: "Reassess in 2 weeks",
        notesRaw: "Patient presented with acute LBP. Neurological exam clear. Started McKenzie protocol.",
        notesSummary: "Patient presented with acute LBP.",
        notes: "Patient presented with acute LBP.",
        dateOfVisit: expect.any(Date),
      }),
    });

    // Verify points ledger entry
    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        delta: 6,
        reasonCode: "STRUCTURED_UPDATE",
        clinicId: "c1",
        patientId: "p1",
      }),
    });
  });
});

describe("QUICK_HANDOFF workflow — end-to-end happy path", () => {
  let POST: (req: Request) => Promise<Response>;

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
    mockUpdateCreate.mockResolvedValue({ id: "cu2" });
    mockUpdateCount.mockResolvedValue(0);
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 30, lastDecayAt: new Date() });
  });

  it("creates QUICK_HANDOFF with minimal fields, summary, dateOfVisit, and awards 2 points", async () => {
    const res = await POST(makeUpdateReq({
      episodeId: "ep1",
      updateType: "QUICK_HANDOFF",
      painRegion: "Right shoulder",
      diagnosis: "Rotator cuff strain",
      treatmentModalities: "Ice, gentle ROM",
      notesRaw: "Seen for follow-up. Pain reduced from 7/10 to 4/10.",
      dateOfVisit: "2026-02-22",
    }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.pointsEarned).toBe(2);

    // Verify create — no structured-only fields
    expect(mockUpdateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        updateType: "QUICK_HANDOFF",
        painRegion: "Right shoulder",
        diagnosis: "Rotator cuff strain",
        treatmentModalities: "Ice, gentle ROM",
        notesRaw: "Seen for follow-up. Pain reduced from 7/10 to 4/10.",
        notesSummary: "Seen for follow-up.",
        notes: "Seen for follow-up.",
        dateOfVisit: expect.any(Date),
      }),
    });

    // Verify no precautions/responsePattern/suggestedNextSteps
    const createCall = mockUpdateCreate.mock.calls[0][0].data;
    expect(createCall.precautions).toBeUndefined();
    expect(createCall.responsePattern).toBeUndefined();
    expect(createCall.suggestedNextSteps).toBeUndefined();

    // Verify points ledger entry
    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        delta: 2,
        reasonCode: "QUICK_HANDOFF",
      }),
    });
  });
});

describe("Cross-workflow snapshot — notesRaw firewall + summary fields", () => {
  let GET: (req: Request, ctx: { params: Promise<{ patientId: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/snapshots/[patientId]/route");
    GET = mod.GET as unknown as typeof GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
    mockClinicUpdate.mockResolvedValue({});
    mockAccessEventCreate.mockResolvedValue({});
    mockPatientFindUnique.mockResolvedValue({ consentStatus: "SHARE" });
  });

  it("snapshot shows both STRUCTURED and QH updates with summaries, hides notesRaw", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });

    // Simulate both types from another clinic
    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu1",
        painRegion: "Lower back",
        diagnosis: "Disc herniation",
        treatmentModalities: "Manual therapy",
        redFlags: true,
        notes: "Patient presented with acute LBP.",
        updateType: "STRUCTURED",
        precautions: "Avoid heavy lifting",
        responsePattern: "Improves with extension",
        suggestedNextSteps: "Reassess in 2 weeks",
        notesSummary: "Patient presented with acute LBP.",
        notesRaw: "PRIVATE RAW NOTES - MUST NOT APPEAR",
        createdAt: new Date("2026-02-20"),
        episode: { reason: "Back pain", startDate: new Date("2026-02-15") },
        clinic: { name: "Harbour Health" },
      },
      {
        id: "cu2",
        painRegion: "Right shoulder",
        diagnosis: "Rotator cuff strain",
        treatmentModalities: "Ice, gentle ROM",
        redFlags: false,
        notes: "Seen for follow-up.",
        updateType: "QUICK_HANDOFF",
        precautions: null,
        responsePattern: null,
        suggestedNextSteps: null,
        notesSummary: "Seen for follow-up.",
        notesRaw: "ANOTHER PRIVATE RAW NOTE - MUST NOT APPEAR",
        createdAt: new Date("2026-02-22"),
        episode: { reason: "Shoulder pain", startDate: new Date("2026-02-18") },
        clinic: { name: "Harbour Health" },
      },
    ]);

    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeSnapshotParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("allowed");
    expect(data.tier).toBe("full");
    expect(data.snapshot).toHaveLength(2);

    // STRUCTURED entry: has all fields + summary
    const structured = data.snapshot.find((s: Record<string, unknown>) => s.updateType === "STRUCTURED");
    expect(structured.notesSummary).toBe("Patient presented with acute LBP.");
    expect(structured.precautions).toBe("Avoid heavy lifting");
    expect(structured.responsePattern).toBe("Improves with extension");
    expect(structured.suggestedNextSteps).toBe("Reassess in 2 weeks");
    expect(structured.redFlags).toBe(true);
    expect(structured.notesRaw).toBeUndefined(); // FIREWALL

    // QH entry: has summary, no structured fields
    const qh = data.snapshot.find((s: Record<string, unknown>) => s.updateType === "QUICK_HANDOFF");
    expect(qh.notesSummary).toBe("Seen for follow-up.");
    expect(qh.precautions).toBeNull();
    expect(qh.responsePattern).toBeNull();
    expect(qh.suggestedNextSteps).toBeNull();
    expect(qh.notesRaw).toBeUndefined(); // FIREWALL
  });

  it("limited tier shows only most recent update, hides redFlags and structured fields", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 50,
      lastDecayAt: new Date(),
    });

    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu1",
        painRegion: "Back",
        diagnosis: "Sprain",
        treatmentModalities: "Ice",
        redFlags: true,
        notes: "Summary text",
        updateType: "STRUCTURED",
        precautions: "Avoid lifting",
        responsePattern: "Better with rest",
        suggestedNextSteps: "Follow up",
        notesSummary: "Summary text",
        notesRaw: "SECRET",
        createdAt: new Date("2026-02-20"),
        episode: { reason: "Pain", startDate: new Date() },
        clinic: { name: "Other" },
      },
      {
        id: "cu2",
        painRegion: "Shoulder",
        diagnosis: "Strain",
        treatmentModalities: "Heat",
        redFlags: false,
        notes: "QH summary",
        updateType: "QUICK_HANDOFF",
        notesSummary: "QH summary",
        notesRaw: "SECRET2",
        createdAt: new Date("2026-02-22"),
        episode: { reason: "Shoulder", startDate: new Date() },
        clinic: { name: "Other" },
      },
    ]);

    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeSnapshotParams("p1"));
    const data = await res.json();

    expect(data.tier).toBe("limited");
    // Limited tier: only most recent (1 entry)
    expect(data.snapshot).toHaveLength(1);
    // No redFlags field at limited tier
    expect(data.snapshot[0].redFlags).toBeUndefined();
    // No structured fields at limited tier
    expect(data.snapshot[0].precautions).toBeUndefined();
    // But notesSummary IS present at limited tier
    expect(data.snapshot[0].notesSummary).toBeDefined();
    // notesRaw never present
    expect(data.snapshot[0].notesRaw).toBeUndefined();
  });
});

describe("Points/tier integration regressions", () => {
  let POST: (req: Request) => Promise<Response>;

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
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
  });

  it("anti-spam caps points at 3 updates per 7 days per patient", async () => {
    // 3 prior updates = spam-capped
    mockUpdateCount.mockResolvedValue(3);

    const res = await POST(makeUpdateReq({
      episodeId: "ep1",
      painRegion: "Back",
      diagnosis: "Sprain",
      treatmentModalities: "Ice",
    }));

    const data = await res.json();
    expect(data.pointsEarned).toBe(0);
    // No ledger entry created when spam-capped
    expect(mockAccessEventCreate).not.toHaveBeenCalled();
  });

  it("STRUCTURED and QH earn different point amounts", async () => {
    mockUpdateCount.mockResolvedValue(0);

    // STRUCTURED = 6pts
    const res1 = await POST(makeUpdateReq({
      episodeId: "ep1",
      updateType: "STRUCTURED",
      painRegion: "Back",
      diagnosis: "Sprain",
      treatmentModalities: "Ice",
    }));
    expect((await res1.json()).pointsEarned).toBe(6);

    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", clinicId: "c1", patientId: "p1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu2" });
    mockUpdateCount.mockResolvedValue(0);
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });

    // QH = 2pts
    const res2 = await POST(makeUpdateReq({
      episodeId: "ep1",
      updateType: "QUICK_HANDOFF",
      painRegion: "Back",
      diagnosis: "Sprain",
      treatmentModalities: "Ice",
    }));
    expect((await res2.json()).pointsEarned).toBe(2);
  });
});
