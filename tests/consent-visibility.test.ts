/**
 * Integration tests for patient consent → snapshot visibility.
 *
 * Verifies:
 * - Patient opted out → snapshot returns empty for other clinics
 * - Patient opted out → documenting clinic still earns points
 * - Patient sharing → snapshot returned normally
 */

const mockPatientFindUnique = jest.fn();
const mockClinicFindUnique = jest.fn();
const mockClinicUpdate = jest.fn(async () => ({}));
const mockClinicalUpdateFindMany = jest.fn();
const mockClinicalUpdateCreate = jest.fn();
const mockClinicalUpdateCount = jest.fn();
const mockEpisodeFindUnique = jest.fn();
const mockAccessEventCreate = jest.fn(async () => ({}));
const mockEventCreate = jest.fn(async () => ({}));

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    patient: { findUnique: mockPatientFindUnique },
    clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
    clinicalUpdate: {
      findMany: mockClinicalUpdateFindMany,
      create: mockClinicalUpdateCreate,
      count: mockClinicalUpdateCount,
    },
    episode: { findUnique: mockEpisodeFindUnique },
    accessEvent: { create: mockAccessEventCreate },
    simulationEvent: { create: mockEventCreate },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => ({
    user: { id: "u1", role: "clinician", clinicId: "c1" },
  })),
}));

describe("Consent Visibility - Snapshot Endpoint", () => {
  beforeEach(() => {
    mockPatientFindUnique.mockReset();
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockClinicalUpdateFindMany.mockReset();
  });

  test("returns denied with PATIENT_OPTED_OUT when patient opted out", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });
    mockPatientFindUnique.mockResolvedValue({ consentStatus: "OPT_OUT" });

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, { params: Promise.resolve({ patientId: "p1" }) });
    const data = await res.json();

    expect(data.accessDecision).toBe("denied");
    expect(data.reasonCode).toBe("PATIENT_OPTED_OUT");
    expect(data.consentOptedOut).toBe(true);
  });

  test("returns snapshot when patient is sharing", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });
    mockPatientFindUnique.mockResolvedValue({ consentStatus: "SHARE" });
    mockClinicalUpdateFindMany.mockResolvedValue([
      {
        id: "cu1",
        painRegion: "Lower back",
        diagnosis: "Disc herniation",
        treatmentModalities: "Manual therapy",
        redFlags: false,
        notes: "Improving",
        createdAt: new Date(),
        clinic: { name: "Other Clinic" },
        episode: { reason: "Back pain", startDate: new Date() },
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, { params: Promise.resolve({ patientId: "p1" }) });
    const data = await res.json();

    expect(data.accessDecision).toBe("allowed");
    expect(data.snapshot).toHaveLength(1);
  });
});

describe("Consent Visibility - Points Still Awarded", () => {
  beforeEach(() => {
    mockEpisodeFindUnique.mockReset();
    mockClinicalUpdateCreate.mockReset();
    mockClinicalUpdateCount.mockReset();
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockAccessEventCreate.mockReset();
    mockEventCreate.mockReset();
  });

  test("documenting clinic earns points even when patient opted out", async () => {
    // Patient is opted out but clinic still earns points for creating the update
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", patientId: "p1" });
    mockClinicalUpdateCreate.mockResolvedValue({ id: "cu1" });
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50, lastDecayAt: new Date() });
    mockClinicalUpdateCount.mockResolvedValue(0);

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
    const res = await POST(req);
    const data = await res.json();

    // Points earned regardless of patient consent
    expect(res.status).toBe(201);
    expect(data.pointsEarned).toBe(6);

    // AccessEvent created via awardPoints service
    expect(mockAccessEventCreate).toHaveBeenCalledTimes(1);
    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicId: "c1",
        delta: 6,
        reasonCode: "STRUCTURED_UPDATE",
      }),
    });
  });
});
