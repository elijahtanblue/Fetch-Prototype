/**
 * Unit tests for domain/services/simulation.ts
 *
 * Tests each simulation function with mocked Prisma client.
 * Verifies delegation to evaluateAccess from domain/policy/access.ts.
 */

import {
  simulateToggle,
  simulateVisit,
  simulateUpdate,
  evaluateAccessForClinic,
  type SimulationContext,
} from "@/domain/services/simulation";

function makeMockPrisma() {
  return {
    clinic: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    episode: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    clinicalUpdate: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    patient: {
      findUnique: jest.fn().mockResolvedValue({ consentStatus: "SHARE" }),
    },
    simulationEvent: {
      create: jest.fn(),
    },
    accessEvent: {
      create: jest.fn(),
    },
  };
}

describe("Simulation Service", () => {
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let ctx: SimulationContext;

  beforeEach(() => {
    mockPrisma = makeMockPrisma();
    ctx = { prisma: mockPrisma as unknown as SimulationContext["prisma"], now: new Date("2026-02-23T12:00:00Z") };
  });

  describe("simulateToggle", () => {
    test("flips optedIn from false to true", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ id: "c1", name: "City Physio", optedIn: false });
      mockPrisma.clinic.update.mockResolvedValue({ id: "c1", name: "City Physio", optedIn: true });
      mockPrisma.simulationEvent.create.mockResolvedValue({});

      const result = await simulateToggle(ctx, { clinicId: "c1", userId: "u1" });

      expect(result.success).toBe(true);
      expect(result.action).toBe("TOGGLE_OPT_IN");
      expect(result.data.optedIn).toBe(true);
    });

    test("flips optedIn from true to false", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ id: "c1", name: "City Physio", optedIn: true });
      mockPrisma.clinic.update.mockResolvedValue({ id: "c1", name: "City Physio", optedIn: false });
      mockPrisma.simulationEvent.create.mockResolvedValue({});

      const result = await simulateToggle(ctx, { clinicId: "c1", userId: "u1" });
      expect(result.data.optedIn).toBe(false);
    });

    test("creates SimulationEvent with TOGGLE_OPT_IN type", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ id: "c1", name: "City Physio", optedIn: false });
      mockPrisma.clinic.update.mockResolvedValue({ id: "c1", name: "City Physio", optedIn: true });
      mockPrisma.simulationEvent.create.mockResolvedValue({});

      await simulateToggle(ctx, { clinicId: "c1", userId: "u1" });

      expect(mockPrisma.simulationEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "TOGGLE_OPT_IN",
          clinicId: "c1",
          userId: "u1",
        }),
      });
    });

    test("returns failure when clinic not found", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue(null);
      const result = await simulateToggle(ctx, { clinicId: "c999", userId: "u1" });
      expect(result.success).toBe(false);
    });
  });

  describe("simulateVisit", () => {
    test("creates episode and SimulationEvent", async () => {
      mockPrisma.episode.create.mockResolvedValue({ id: "ep1" });
      mockPrisma.simulationEvent.create.mockResolvedValue({});

      const result = await simulateVisit(ctx, {
        clinicId: "c1", userId: "u1", patientId: "p1", reason: "Back pain",
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("VISIT");
      expect(result.data.episodeId).toBe("ep1");
    });
  });

  describe("simulateUpdate", () => {
    test("creates clinical update, awards points via ledger, and updates timestamps", async () => {
      mockPrisma.clinicalUpdate.create.mockResolvedValue({ id: "cu1" });
      // First findUnique for decay, second for awardPoints
      mockPrisma.clinic.findUnique
        .mockResolvedValueOnce({ accessPercent: 50, lastDecayAt: new Date() })
        .mockResolvedValueOnce({ accessPercent: 50 });
      mockPrisma.clinic.update.mockResolvedValue({});
      mockPrisma.episode.findUnique.mockResolvedValue({ patientId: "p1" });
      mockPrisma.clinicalUpdate.count.mockResolvedValue(0); // no anti-spam
      mockPrisma.accessEvent.create.mockResolvedValue({});
      mockPrisma.simulationEvent.create.mockResolvedValue({});

      const result = await simulateUpdate(ctx, {
        clinicId: "c1", userId: "u1", episodeId: "ep1",
        painRegion: "Lower back", diagnosis: "Herniation",
        treatmentModalities: "Manual therapy",
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("CLINICAL_UPDATE");
      expect(result.data.accessPercent).toBe(56); // 50 + 6
      // Verify AccessEvent ledger entry was created
      expect(mockPrisma.accessEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clinicId: "c1",
          delta: 6,
          reasonCode: "STRUCTURED_UPDATE",
        }),
      });
    });

    test("respects anti-spam cap and does not award points beyond limit", async () => {
      mockPrisma.clinicalUpdate.create.mockResolvedValue({ id: "cu4" });
      mockPrisma.clinic.findUnique
        .mockResolvedValueOnce({ accessPercent: 50, lastDecayAt: new Date() });
      mockPrisma.clinic.update.mockResolvedValue({});
      mockPrisma.episode.findUnique.mockResolvedValue({ patientId: "p1" });
      mockPrisma.clinicalUpdate.count.mockResolvedValue(3); // at cap
      mockPrisma.simulationEvent.create.mockResolvedValue({});

      const result = await simulateUpdate(ctx, {
        clinicId: "c1", userId: "u1", episodeId: "ep1",
        painRegion: "Back", diagnosis: "Sprain",
        treatmentModalities: "Ice",
      });

      expect(result.success).toBe(true);
      expect(result.data.accessPercent).toBe(50); // no points earned
      expect(mockPrisma.accessEvent.create).not.toHaveBeenCalled();
    });
  });

  describe("evaluateAccessForClinic", () => {
    test("returns OPTED_OUT when clinic is not opted in", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ optedIn: false, accessPercent: 80, lastDecayAt: new Date() });
      mockPrisma.clinic.update.mockResolvedValue({});
      mockPrisma.clinicalUpdate.findMany.mockResolvedValue([]);

      const decision = await evaluateAccessForClinic(ctx, { clinicId: "c1", patientId: "p1" });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("OPTED_OUT");
    });

    test("returns INACTIVE_CONTRIBUTOR when accessPercent is low", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ optedIn: true, accessPercent: 5, lastDecayAt: new Date() });
      mockPrisma.clinic.update.mockResolvedValue({});
      mockPrisma.clinicalUpdate.findMany.mockResolvedValue([]);

      const decision = await evaluateAccessForClinic(ctx, { clinicId: "c1", patientId: "p1" });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
    });

    test("returns NO_SNAPSHOT when no shared data exists", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ optedIn: true, accessPercent: 80, lastDecayAt: new Date() });
      mockPrisma.clinic.update.mockResolvedValue({});
      mockPrisma.clinicalUpdate.findMany.mockResolvedValue([]);

      const decision = await evaluateAccessForClinic(ctx, { clinicId: "c1", patientId: "p1" });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("NO_SNAPSHOT");
    });

    test("returns allowed with tier when all conditions met", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ optedIn: true, accessPercent: 80, lastDecayAt: new Date() });
      mockPrisma.clinic.update.mockResolvedValue({});
      mockPrisma.clinicalUpdate.findMany.mockResolvedValue([
        {
          id: "cu1", painRegion: "Back", diagnosis: "Sprain",
          treatmentModalities: "Ice", redFlags: false, notes: "", createdAt: new Date(),
          episode: { reason: "Pain", startDate: new Date() },
          clinic: { name: "Other Clinic" },
        },
      ]);

      const decision = await evaluateAccessForClinic(ctx, { clinicId: "c1", patientId: "p1" });
      expect(decision.allowed).toBe(true);
      expect(decision.tier).toBe("full");
    });

    test("persists decay and logs AccessEvent when access is checked", async () => {
      const twoDaysAgo = new Date("2026-02-21T12:00:00Z");
      mockPrisma.clinic.findUnique.mockResolvedValue({ optedIn: true, accessPercent: 80, lastDecayAt: twoDaysAgo });
      mockPrisma.clinic.update.mockResolvedValue({});
      mockPrisma.accessEvent.create.mockResolvedValue({});
      mockPrisma.clinicalUpdate.findMany.mockResolvedValue([]);

      await evaluateAccessForClinic(ctx, { clinicId: "c1", patientId: "p1" });

      // Should persist decayed value (80 - 2 days = 78)
      expect(mockPrisma.clinic.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: expect.objectContaining({ accessPercent: 78 }),
      });
      // Should log decay event
      expect(mockPrisma.accessEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clinicId: "c1",
          delta: -2,
          reasonCode: "DECAY",
        }),
      });
    });
  });
});
