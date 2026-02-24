/**
 * Endpoint integration tests for GET /api/snapshots/[patientId]
 *
 * Validates that the API response correctly maps policy decisions
 * (allowed/denied) with tier-based field filtering.
 */

const mockClinicFindUnique = jest.fn();
const mockClinicUpdate = jest.fn();
const mockUpdateFindMany = jest.fn();
const mockPatientFindUnique = jest.fn();

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
    clinicalUpdate: { findMany: mockUpdateFindMany },
    patient: { findUnique: mockPatientFindUnique },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => ({
    user: { id: "u1", role: "clinician", clinicId: "c1" },
  })),
}));

function makeParams(patientId: string) {
  return { params: Promise.resolve({ patientId }) };
}

describe("GET /api/snapshots/[patientId] - Tier Integration", () => {
  beforeEach(() => {
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockUpdateFindMany.mockReset();
    mockPatientFindUnique.mockReset();
    mockClinicUpdate.mockResolvedValue({});
    // Default: patient consents to sharing
    mockPatientFindUnique.mockResolvedValue({ consentStatus: "SHARE" });
  });

  test("returns denied with OPTED_OUT when clinic is not opted in", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: false,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("denied");
    expect(data.reasonCode).toBe("OPTED_OUT");
    expect(data.explanation).toBeDefined();
  });

  test("returns denied with INACTIVE_CONTRIBUTOR when accessPercent is 0", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 0,
      lastDecayAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("denied");
    expect(data.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
    expect(data.tier).toBe("inactive");
  });

  test("returns denied with NO_SNAPSHOT when no shared updates exist", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("denied");
    expect(data.reasonCode).toBe("NO_SNAPSHOT");
  });

  test("returns allowed with full tier and all fields when accessPercent >= 70", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu1",
        painRegion: "Lower back",
        diagnosis: "Disc herniation",
        treatmentModalities: "Manual therapy",
        redFlags: true,
        notes: "Improving",
        createdAt: new Date("2026-02-20"),
        episode: { reason: "Back pain", startDate: new Date("2026-02-15") },
        clinic: { name: "Harbour Health" },
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("allowed");
    expect(data.tier).toBe("full");
    expect(data.accessPercent).toBe(80);
    expect(data.snapshot).toHaveLength(1);
    expect(data.snapshot[0].clinicName).toBe("Harbour Health");
    expect(data.snapshot[0].painRegion).toBe("Lower back");
    expect(data.snapshot[0].redFlags).toBe(true);
    expect(data.snapshot[0].notes).toBe("Improving");
  });

  test("returns allowed with limited tier filtering when accessPercent 40-69", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 50,
      lastDecayAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu1", painRegion: "Back", diagnosis: "Sprain",
        treatmentModalities: "Ice", redFlags: true, notes: "Note 1",
        createdAt: new Date(), episode: { reason: "Pain", startDate: new Date() },
        clinic: { name: "Other Clinic" },
      },
      {
        id: "cu2", painRegion: "Neck", diagnosis: "Strain",
        treatmentModalities: "Heat", redFlags: false, notes: "Note 2",
        createdAt: new Date(), episode: { reason: "Check", startDate: new Date() },
        clinic: { name: "Another Clinic" },
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("allowed");
    expect(data.tier).toBe("limited");
    // Limited: only most recent, no redFlags field
    expect(data.snapshot).toHaveLength(1);
    expect(data.snapshot[0].diagnosis).toBe("Sprain");
    expect(data.snapshot[0].redFlags).toBeUndefined();
  });

  test("full tier includes notesSummary and structured fields", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu1",
        painRegion: "Lower back",
        diagnosis: "Disc herniation",
        treatmentModalities: "Manual therapy",
        redFlags: false,
        notes: "Summary text",
        updateType: "STRUCTURED",
        precautions: "Avoid lifting",
        responsePattern: "Improves with rest",
        suggestedNextSteps: "Reassess in 2 weeks",
        notesSummary: "Patient improved.",
        notesRaw: "SECRET RAW NOTES SHOULD NOT APPEAR",
        createdAt: new Date(),
        episode: { reason: "Back pain", startDate: new Date() },
        clinic: { name: "Other Clinic" },
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("allowed");
    expect(data.tier).toBe("full");
    expect(data.snapshot[0].notesSummary).toBe("Patient improved.");
    expect(data.snapshot[0].precautions).toBe("Avoid lifting");
    expect(data.snapshot[0].responsePattern).toBe("Improves with rest");
    expect(data.snapshot[0].suggestedNextSteps).toBe("Reassess in 2 weeks");
    expect(data.snapshot[0].updateType).toBe("STRUCTURED");
    // notesRaw must NEVER appear in cross-clinic snapshot
    expect(data.snapshot[0].notesRaw).toBeUndefined();
  });

  test("limited tier includes notesSummary but excludes structured fields", async () => {
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
        redFlags: false,
        notes: "Short",
        updateType: "STRUCTURED",
        precautions: "Avoid lifting",
        responsePattern: "Improves with rest",
        suggestedNextSteps: "Reassess",
        notesSummary: "Patient improved.",
        createdAt: new Date(),
        episode: { reason: "Pain", startDate: new Date() },
        clinic: { name: "Other Clinic" },
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.tier).toBe("limited");
    expect(data.snapshot[0].notesSummary).toBe("Patient improved.");
    // Limited tier excludes precautions, responsePattern, suggestedNextSteps
    expect(data.snapshot[0].precautions).toBeUndefined();
    expect(data.snapshot[0].responsePattern).toBeUndefined();
    expect(data.snapshot[0].suggestedNextSteps).toBeUndefined();
  });

  test("legacy updates without new fields still render correctly", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu-legacy",
        painRegion: "Knee",
        diagnosis: "Meniscus tear",
        treatmentModalities: "Exercise",
        redFlags: false,
        notes: "Old note",
        createdAt: new Date(),
        episode: { reason: "Knee pain", startDate: new Date() },
        clinic: { name: "Legacy Clinic" },
        // No updateType, precautions, responsePattern, suggestedNextSteps, notesSummary
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("allowed");
    expect(data.snapshot[0].painRegion).toBe("Knee");
    expect(data.snapshot[0].notes).toBe("Old note");
    expect(data.snapshot[0].updateType).toBe("STRUCTURED"); // default
    expect(data.snapshot[0].notesSummary).toBeNull();
  });

  test("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as jest.Mock).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));

    expect(res.status).toBe(401);
  });
});
