/**
 * Endpoint integration tests for GET /api/snapshots/[patientId]
 *
 * Validates that the API response correctly maps policy decisions
 * (allowed/denied) to the response format.
 */

const mockClinicFindUnique = jest.fn();
const mockUpdateFindMany = jest.fn();

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: { findUnique: mockClinicFindUnique },
    clinicalUpdate: { findMany: mockUpdateFindMany },
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

describe("GET /api/snapshots/[patientId] - Policy Integration", () => {
  beforeEach(() => {
    mockClinicFindUnique.mockReset();
    mockUpdateFindMany.mockReset();
  });

  test("returns denied with OPTED_OUT when clinic is not opted in", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: false,
      lastContributionAt: new Date(),
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

  test("returns denied with INACTIVE_CONTRIBUTOR when no contributions", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      lastContributionAt: null,
    });
    mockUpdateFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("denied");
    expect(data.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
  });

  test("returns denied with INACTIVE_CONTRIBUTOR when contribution expired", async () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      lastContributionAt: sixtyDaysAgo,
    });
    mockUpdateFindMany.mockResolvedValue([
      {
        id: "cu1",
        painRegion: "Back",
        diagnosis: "Sprain",
        treatmentModalities: "Ice",
        redFlags: false,
        notes: "",
        createdAt: new Date(),
        episode: { reason: "Pain", startDate: new Date() },
        clinic: { name: "Other Clinic" },
      },
    ]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("denied");
    expect(data.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
  });

  test("returns denied with NO_SNAPSHOT when no shared updates exist", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      lastContributionAt: new Date(),
    });
    mockUpdateFindMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/snapshots/[patientId]/route");
    const req = new Request("http://localhost/api/snapshots/p1");
    const res = await GET(req, makeParams("p1"));
    const data = await res.json();

    expect(data.accessDecision).toBe("denied");
    expect(data.reasonCode).toBe("NO_SNAPSHOT");
  });

  test("returns allowed with snapshot data when all conditions met", async () => {
    mockClinicFindUnique.mockResolvedValue({
      optedIn: true,
      lastContributionAt: new Date(),
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
    expect(data.snapshot).toHaveLength(1);
    expect(data.snapshot[0].clinicName).toBe("Harbour Health");
    expect(data.snapshot[0].painRegion).toBe("Lower back");
    expect(data.snapshot[0].redFlags).toBe(true);
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
