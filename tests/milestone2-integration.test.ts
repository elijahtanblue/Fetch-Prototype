/**
 * Milestone 2 Integration Tests:
 * - Decay persistence + AccessEvent ledger logging
 * - Patient consent opt-out blocks visibility but not points
 * - INACTIVE tier restrictions (server-side)
 */

import "./helpers/polyfills";

const mockClinicFindUnique = jest.fn();
const mockClinicUpdate = jest.fn();
const mockUpdateFindMany = jest.fn();
const mockPatientFindUnique = jest.fn();
const mockAccessEventCreate = jest.fn();
const mockEpisodeFindUnique = jest.fn();
const mockUpdateCreate = jest.fn();
const mockUpdateCount = jest.fn();
const mockSimEventCreate = jest.fn();

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
    clinicalUpdate: { findMany: mockUpdateFindMany, create: mockUpdateCreate, count: mockUpdateCount },
    patient: { findUnique: mockPatientFindUnique },
    accessEvent: { create: mockAccessEventCreate },
    episode: { findUnique: mockEpisodeFindUnique },
    simulationEvent: { create: mockSimEventCreate },
  })),
}));

const mockAuth = jest.fn();
jest.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

function makeSnapshotParams(patientId: string) {
  return { params: Promise.resolve({ patientId }) };
}

// ----- Decay Persistence + Ledger -----
describe("Decay persistence and ledger logging", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
    mockClinicUpdate.mockResolvedValue({});
    mockAccessEventCreate.mockResolvedValue({});
    mockPatientFindUnique.mockResolvedValue({ consentStatus: "SHARE" });
    mockUpdateFindMany.mockResolvedValue([]);
  });

  test("persists decay and creates AccessEvent with DECAY reason code", async () => {
    // Clinic at 80%, last decay was 3 days ago → should decay to 77%
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: threeDaysAgo,
    });

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    await GET(req, makeSnapshotParams("p1"));

    // Verify clinic was updated with decayed percent
    expect(mockClinicUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({
          accessPercent: 77,
        }),
      })
    );

    // Verify AccessEvent ledger entry was created
    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: {
        clinicId: "c1",
        delta: -3,
        reasonCode: "DECAY",
      },
    });
  });

  test("does not create AccessEvent when no decay occurs", async () => {
    // Clinic at 80%, last decay was just now → no change
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    await GET(req, makeSnapshotParams("p1"));

    expect(mockClinicUpdate).not.toHaveBeenCalled();
    expect(mockAccessEventCreate).not.toHaveBeenCalled();
  });

  test("decay does not go below 0", async () => {
    // Clinic at 2%, last decay was 10 days ago → should clamp to 0
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 2,
      lastDecayAt: tenDaysAgo,
    });

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    await GET(req, makeSnapshotParams("p1"));

    expect(mockClinicUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessPercent: 0,
        }),
      })
    );

    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: {
        clinicId: "c1",
        delta: -2,
        reasonCode: "DECAY",
      },
    });
  });
});

// ----- Patient Consent Opt-Out -----
describe("Patient consent opt-out visibility vs points", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
    mockClinicUpdate.mockResolvedValue({});
    mockAccessEventCreate.mockResolvedValue({});
  });

  test("opted-out patient returns denied with PATIENT_OPTED_OUT", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });
    mockPatientFindUnique.mockResolvedValue({ consentStatus: "OPT_OUT" });

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeSnapshotParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("denied");
    expect(data.reasonCode).toBe("PATIENT_OPTED_OUT");
    expect(data.consentOptedOut).toBe(true);
  });

  test("opted-out patient does not prevent documenting clinic from earning points", async () => {
    // The update API doesn't check patient consent — it still awards points
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });

    mockEpisodeFindUnique.mockResolvedValue({
      id: "ep1",
      clinicId: "c1",
      patient: { consentStatus: "OPT_OUT" },
    });
    mockUpdateCreate.mockResolvedValue({ id: "cu1" });
    mockUpdateCount.mockResolvedValue(0); // no anti-spam block
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 50 });
    mockClinicUpdate.mockResolvedValue({});
    mockAccessEventCreate.mockResolvedValue({});
    mockSimEventCreate.mockResolvedValue({});

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

    // Points should still be awarded
    expect(data.pointsEarned).toBe(6);
    expect(mockAccessEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reasonCode: "STRUCTURED_UPDATE",
        delta: 6,
      }),
    });
  });

  test("SHARE consent patient returns snapshot data", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 80,
      lastDecayAt: new Date(),
    });
    mockPatientFindUnique.mockResolvedValue({ consentStatus: "SHARE" });
    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu1",
        painRegion: "Back",
        diagnosis: "Sprain",
        treatmentModalities: "Ice",
        redFlags: false,
        notes: "OK",
        createdAt: new Date(),
        episode: { reason: "Pain", startDate: new Date() },
        clinic: { name: "Other Clinic" },
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeSnapshotParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("allowed");
    expect(data.snapshot).toHaveLength(1);
  });
});

// ----- INACTIVE Tier Server-Side Restrictions -----
describe("INACTIVE tier server-side enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
    mockClinicUpdate.mockResolvedValue({});
    mockAccessEventCreate.mockResolvedValue({});
    mockPatientFindUnique.mockResolvedValue({ consentStatus: "SHARE" });
  });

  test("INACTIVE clinic (0%) gets denied with INACTIVE_CONTRIBUTOR", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 0,
      lastDecayAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu1",
        painRegion: "Back",
        diagnosis: "Sprain",
        treatmentModalities: "Ice",
        redFlags: false,
        notes: "Data",
        createdAt: new Date(),
        episode: { reason: "Pain", startDate: new Date() },
        clinic: { name: "Other" },
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeSnapshotParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("denied");
    expect(data.tier).toBe("inactive");
    expect(data.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
    // No snapshot data leaked
    expect(data.snapshot).toBeUndefined();
  });

  test("INACTIVE clinic (19%) still denied", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 19,
      lastDecayAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu1",
        painRegion: "Neck",
        diagnosis: "Strain",
        treatmentModalities: "Heat",
        redFlags: true,
        notes: "X",
        createdAt: new Date(),
        episode: { reason: "Neck pain", startDate: new Date() },
        clinic: { name: "Another" },
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeSnapshotParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("denied");
    expect(data.tier).toBe("inactive");
    expect(data.snapshot).toBeUndefined();
  });

  test("minimal tier (20%) is allowed and returns data", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      accessPercent: 20,
      lastDecayAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu1",
        painRegion: "Knee",
        diagnosis: "Tear",
        treatmentModalities: "Exercise",
        redFlags: false,
        notes: "Z",
        createdAt: new Date(),
        episode: { reason: "Knee pain", startDate: new Date() },
        clinic: { name: "Clinic B" },
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeSnapshotParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("allowed");
    expect(data.tier).toBe("minimal");
    expect(data.snapshot).toHaveLength(1);
  });

  test("INACTIVE clinic can still post updates and earn points", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "clinician", clinicId: "c1" },
    });
    mockEpisodeFindUnique.mockResolvedValue({ id: "ep1", clinicId: "c1" });
    mockUpdateCreate.mockResolvedValue({ id: "cu1" });
    mockUpdateCount.mockResolvedValue(0);
    mockClinicFindUnique.mockResolvedValue({ accessPercent: 5 }); // inactive
    mockClinicUpdate.mockResolvedValue({});
    mockAccessEventCreate.mockResolvedValue({});
    mockSimEventCreate.mockResolvedValue({});

    const { POST } = await import("@/app/api/updates/route");
    const req = new Request("http://localhost/api/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        episodeId: "ep1",
        painRegion: "Back",
        diagnosis: "Sprain",
        treatmentModalities: "Ice",
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.pointsEarned).toBe(6);
  });
});
