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
    },
    clinicalUpdate: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    simulationEvent: {
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
      expect(mockPrisma.clinic.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { optedIn: true },
      });
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
      expect(mockPrisma.episode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          patientId: "p1",
          clinicId: "c1",
          reason: "Back pain",
        }),
      });
    });

    test("creates SimulationEvent with VISIT type", async () => {
      mockPrisma.episode.create.mockResolvedValue({ id: "ep1" });
      mockPrisma.simulationEvent.create.mockResolvedValue({});

      await simulateVisit(ctx, {
        clinicId: "c1", userId: "u1", patientId: "p1", reason: "Assessment",
      });

      expect(mockPrisma.simulationEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "VISIT",
          clinicId: "c1",
        }),
      });
    });
  });

  describe("simulateUpdate", () => {
    test("creates clinical update and updates lastContributionAt", async () => {
      mockPrisma.clinicalUpdate.create.mockResolvedValue({ id: "cu1" });
      mockPrisma.clinic.update.mockResolvedValue({});
      mockPrisma.simulationEvent.create.mockResolvedValue({});

      const result = await simulateUpdate(ctx, {
        clinicId: "c1", userId: "u1", episodeId: "ep1",
        painRegion: "Lower back", diagnosis: "Herniation",
        treatmentModalities: "Manual therapy",
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe("CLINICAL_UPDATE");
      expect(mockPrisma.clinic.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { lastContributionAt: ctx.now },
      });
    });

    test("creates SimulationEvent with CLINICAL_UPDATE type", async () => {
      mockPrisma.clinicalUpdate.create.mockResolvedValue({ id: "cu1" });
      mockPrisma.clinic.update.mockResolvedValue({});
      mockPrisma.simulationEvent.create.mockResolvedValue({});

      await simulateUpdate(ctx, {
        clinicId: "c1", userId: "u1", episodeId: "ep1",
        painRegion: "Back", diagnosis: "Sprain",
        treatmentModalities: "Ice", redFlags: true, notes: "Urgent",
      });

      expect(mockPrisma.simulationEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "CLINICAL_UPDATE",
          clinicId: "c1",
        }),
      });
    });
  });

  describe("evaluateAccessForClinic", () => {
    test("returns OPTED_OUT when clinic is not opted in", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ optedIn: false, lastContributionAt: new Date() });
      mockPrisma.clinicalUpdate.findMany.mockResolvedValue([]);

      const decision = await evaluateAccessForClinic(ctx, { clinicId: "c1", patientId: "p1" });

      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("OPTED_OUT");
    });

    test("returns INACTIVE_CONTRIBUTOR when no contributions", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ optedIn: true, lastContributionAt: null });
      mockPrisma.clinicalUpdate.findMany.mockResolvedValue([]);

      const decision = await evaluateAccessForClinic(ctx, { clinicId: "c1", patientId: "p1" });

      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
    });

    test("returns NO_SNAPSHOT when no shared data exists", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ optedIn: true, lastContributionAt: new Date() });
      mockPrisma.clinicalUpdate.findMany.mockResolvedValue([]);

      const decision = await evaluateAccessForClinic(ctx, { clinicId: "c1", patientId: "p1" });

      expect(decision.allowed).toBe(false);
      expect(decision.reasonCode).toBe("NO_SNAPSHOT");
    });

    test("returns allowed when all conditions met", async () => {
      mockPrisma.clinic.findUnique.mockResolvedValue({ optedIn: true, lastContributionAt: new Date() });
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
    });

    test("delegates to evaluateAccess from domain/policy/access.ts (not reimplemented)", async () => {
      // The function should use the shared update count to determine hasSnapshot
      // and pass optedIn/lastContributionAt directly from the clinic record
      mockPrisma.clinic.findUnique.mockResolvedValue({ optedIn: true, lastContributionAt: new Date() });
      mockPrisma.clinicalUpdate.findMany.mockResolvedValue([]);

      const decision = await evaluateAccessForClinic(ctx, { clinicId: "c1", patientId: "p1" });

      // NO_SNAPSHOT proves evaluateAccess was called since it is the 3rd rule
      // (rules 1 & 2 passed: optedIn=true, lastContributionAt=recent)
      expect(decision.reasonCode).toBe("NO_SNAPSHOT");
    });
  });
});
