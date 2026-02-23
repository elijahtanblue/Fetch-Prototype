/**
 * API endpoint tests for /api/simulation/* routes.
 *
 * Tests auth (401/403), validation (400), and success cases.
 */

import "../tests/helpers/polyfills";

let mockSession: Record<string, unknown> | null = null;

const mockClinicFindUnique = jest.fn();
const mockClinicUpdate = jest.fn();
const mockUserFindFirst = jest.fn();
const mockEpisodeCreate = jest.fn();
const mockClinicalUpdateCreate = jest.fn();
const mockClinicalUpdateFindMany = jest.fn();
const mockSimulationEventCreate = jest.fn();
const mockSimulationEventFindMany = jest.fn();

jest.mock("@prisma/adapter-neon", () => ({
  PrismaNeon: jest.fn(() => ({})),
}));

const mockPatientFindUnique = jest.fn();

jest.mock("@/lib/generated/prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    clinic: { findUnique: mockClinicFindUnique, update: mockClinicUpdate },
    user: { findFirst: mockUserFindFirst },
    episode: { create: mockEpisodeCreate },
    clinicalUpdate: { create: mockClinicalUpdateCreate, findMany: mockClinicalUpdateFindMany },
    patient: { findUnique: mockPatientFindUnique },
    simulationEvent: { create: mockSimulationEventCreate, findMany: mockSimulationEventFindMany },
  })),
}));

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(async () => mockSession),
}));

function makeRequest(url: string, body?: Record<string, unknown>) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Simulation API Endpoints", () => {
  beforeEach(() => {
    mockSession = { user: { id: "u3", role: "admin", clinicId: "c3" } };
    mockClinicFindUnique.mockReset();
    mockClinicUpdate.mockReset();
    mockUserFindFirst.mockReset();
    mockEpisodeCreate.mockReset();
    mockClinicalUpdateCreate.mockReset();
    mockClinicalUpdateFindMany.mockReset();
    mockSimulationEventCreate.mockReset();
    mockSimulationEventFindMany.mockReset();
    mockPatientFindUnique.mockReset();
    mockUserFindFirst.mockResolvedValue({ id: "u1" });
    mockSimulationEventCreate.mockResolvedValue({});
    mockPatientFindUnique.mockResolvedValue({ consentStatus: "SHARE" });
  });

  describe("POST /api/simulation/toggle", () => {
    test("returns 401 when not authenticated", async () => {
      mockSession = null;
      const { POST } = await import("@/app/api/simulation/toggle/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/toggle", { clinicId: "c1" }));
      expect(res.status).toBe(401);
    });

    test("returns 403 when not admin", async () => {
      mockSession = { user: { id: "u1", role: "clinician", clinicId: "c1" } };
      const { POST } = await import("@/app/api/simulation/toggle/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/toggle", { clinicId: "c1" }));
      expect(res.status).toBe(403);
    });

    test("returns 400 when clinicId missing", async () => {
      const { POST } = await import("@/app/api/simulation/toggle/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/toggle", {}));
      expect(res.status).toBe(400);
    });

    test("returns success on valid toggle", async () => {
      mockClinicFindUnique.mockResolvedValue({ id: "c1", name: "City Physio", optedIn: false });
      mockClinicUpdate.mockResolvedValue({ id: "c1", name: "City Physio", optedIn: true });

      const { POST } = await import("@/app/api/simulation/toggle/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/toggle", { clinicId: "c1" }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.action).toBe("TOGGLE_OPT_IN");
      expect(data.success).toBe(true);
    });
  });

  describe("POST /api/simulation/visit", () => {
    test("returns 401 when not authenticated", async () => {
      mockSession = null;
      const { POST } = await import("@/app/api/simulation/visit/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/visit", { clinicId: "c1", patientId: "p1", reason: "Pain" }));
      expect(res.status).toBe(401);
    });

    test("returns 403 when not admin", async () => {
      mockSession = { user: { id: "u1", role: "clinician", clinicId: "c1" } };
      const { POST } = await import("@/app/api/simulation/visit/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/visit", { clinicId: "c1", patientId: "p1", reason: "Pain" }));
      expect(res.status).toBe(403);
    });

    test("returns 400 when required fields missing", async () => {
      const { POST } = await import("@/app/api/simulation/visit/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/visit", { clinicId: "c1" }));
      expect(res.status).toBe(400);
    });

    test("returns success on valid visit", async () => {
      mockEpisodeCreate.mockResolvedValue({ id: "ep1" });

      const { POST } = await import("@/app/api/simulation/visit/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/visit", {
        clinicId: "c1", patientId: "p1", reason: "Assessment",
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.action).toBe("VISIT");
      expect(data.success).toBe(true);
    });
  });

  describe("POST /api/simulation/update", () => {
    test("returns 400 when required fields missing", async () => {
      const { POST } = await import("@/app/api/simulation/update/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/update", { clinicId: "c1" }));
      expect(res.status).toBe(400);
    });

    test("returns success on valid update", async () => {
      mockClinicalUpdateCreate.mockResolvedValue({ id: "cu1" });
      mockClinicUpdate.mockResolvedValue({});

      const { POST } = await import("@/app/api/simulation/update/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/update", {
        clinicId: "c1", episodeId: "ep1",
        painRegion: "Back", diagnosis: "Sprain", treatmentModalities: "Ice",
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.action).toBe("CLINICAL_UPDATE");
    });
  });

  describe("POST /api/simulation/access", () => {
    test("returns 400 when required fields missing", async () => {
      const { POST } = await import("@/app/api/simulation/access/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/access", {}));
      expect(res.status).toBe(400);
    });

    test("returns access decision", async () => {
      mockClinicFindUnique.mockResolvedValue({ optedIn: true, accessPercent: 80, lastDecayAt: new Date() });
      mockClinicalUpdateFindMany.mockResolvedValue([]);

      const { POST } = await import("@/app/api/simulation/access/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/access", {
        clinicId: "c1", patientId: "p1",
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.allowed).toBeDefined();
    });
  });

  describe("GET /api/simulation/events", () => {
    test("returns 401 when not authenticated", async () => {
      mockSession = null;
      const { GET } = await import("@/app/api/simulation/events/route");
      const res = await GET();
      expect(res.status).toBe(401);
    });

    test("returns 403 when not admin", async () => {
      mockSession = { user: { id: "u1", role: "clinician", clinicId: "c1" } };
      const { GET } = await import("@/app/api/simulation/events/route");
      const res = await GET();
      expect(res.status).toBe(403);
    });

    test("returns event list", async () => {
      mockSimulationEventFindMany.mockResolvedValue([
        { id: "se1", type: "TOGGLE_OPT_IN", clinicId: "c1", userId: "u1", metadata: "{}", createdAt: new Date(), clinic: { name: "City Physio" }, user: { name: "Ed Sun" } },
      ]);

      const { GET } = await import("@/app/api/simulation/events/route");
      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].type).toBe("TOGGLE_OPT_IN");
    });
  });

  describe("POST /api/simulation/replay", () => {
    test("returns 400 when required fields missing", async () => {
      const { POST } = await import("@/app/api/simulation/replay/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/replay", {}));
      expect(res.status).toBe(400);
    });

    test("returns replay results", async () => {
      mockSimulationEventFindMany.mockResolvedValue([]);

      const { POST } = await import("@/app/api/simulation/replay/route");
      const res = await POST(makeRequest("http://localhost/api/simulation/replay", {
        viewerClinicId: "c1", patientId: "p1",
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
