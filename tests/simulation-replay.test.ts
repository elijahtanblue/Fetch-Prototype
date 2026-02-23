/**
 * Deterministic replay tests.
 *
 * Verifies that replaying the same event sequence produces identical results.
 */

import {
  replayEvents,
  type SimulationContext,
} from "@/domain/services/simulation";

// Stateful mock that tracks clinic state across calls
function createReplayMockPrisma() {
  const clinicState: Record<string, { optedIn: boolean; lastContributionAt: Date | null }> = {
    cA: { optedIn: false, lastContributionAt: null },
    cB: { optedIn: false, lastContributionAt: null },
  };
  const updates: Array<{ clinicId: string; patientId: string }> = [];
  let idCounter = 0;

  return {
    clinic: {
      findUnique: jest.fn(async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
        const c = clinicState[where.id];
        if (!c) return null;
        if (select) return { ...c };
        return { id: where.id, name: `Clinic ${where.id}`, ...c };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const c = clinicState[where.id];
        Object.assign(c, data);
        return { id: where.id, name: `Clinic ${where.id}`, ...c };
      }),
    },
    episode: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        idCounter++;
        return { id: `ep-${idCounter}`, ...data };
      }),
    },
    clinicalUpdate: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        idCounter++;
        updates.push({ clinicId: data.clinicId as string, patientId: "p1" });
        return { id: `cu-${idCounter}`, createdAt: new Date(), ...data };
      }),
      findMany: jest.fn(async ({ where }: { where: { episode: { patientId: string }; clinicId: { not: string } } }) => {
        const excludeClinicId = where.clinicId.not;
        const matching = updates.filter((u) => u.clinicId !== excludeClinicId);
        return matching.map((u) => ({
          id: `cu-x`, painRegion: "Back", diagnosis: "Test", treatmentModalities: "Test",
          redFlags: false, notes: "", createdAt: new Date(),
          episode: { reason: "Test", startDate: new Date() },
          clinic: { name: `Clinic ${u.clinicId}` },
        }));
      }),
    },
    simulationEvent: {
      create: jest.fn(async () => ({})),
    },
    reset() {
      clinicState.cA = { optedIn: false, lastContributionAt: null };
      clinicState.cB = { optedIn: false, lastContributionAt: null };
      updates.length = 0;
      idCounter = 0;
    },
  };
}

describe("Simulation Replay - Deterministic Behavior", () => {
  const events = [
    { type: "TOGGLE_OPT_IN", clinicId: "cA", userId: "uA", metadata: JSON.stringify({ previousStatus: false, newStatus: true }) },
    { type: "TOGGLE_OPT_IN", clinicId: "cB", userId: "uB", metadata: JSON.stringify({ previousStatus: false, newStatus: true }) },
  ];

  test("same event sequence produces same results on two runs", async () => {
    const mock = createReplayMockPrisma();
    const ctx: SimulationContext = { prisma: mock as unknown as SimulationContext["prisma"], now: new Date("2026-02-23T12:00:00Z") };

    const run1 = await replayEvents(ctx, events, { viewerClinicId: "cA", patientId: "p1" });

    // Reset state for second run
    mock.reset();
    const run2 = await replayEvents(ctx, events, { viewerClinicId: "cA", patientId: "p1" });

    expect(run1.length).toBe(run2.length);
    for (let i = 0; i < run1.length; i++) {
      expect(run1[i].action).toBe(run2[i].action);
      expect(run1[i].accessDecision?.allowed).toBe(run2[i].accessDecision?.allowed);
      expect(run1[i].accessDecision?.reasonCode).toBe(run2[i].accessDecision?.reasonCode);
    }
  });

  test("empty event sequence produces empty results", async () => {
    const mock = createReplayMockPrisma();
    const ctx: SimulationContext = { prisma: mock as unknown as SimulationContext["prisma"] };

    const results = await replayEvents(ctx, [], { viewerClinicId: "cA", patientId: "p1" });

    expect(results).toHaveLength(0);
  });

  test("single toggle event replays correctly", async () => {
    const mock = createReplayMockPrisma();
    const ctx: SimulationContext = { prisma: mock as unknown as SimulationContext["prisma"], now: new Date("2026-02-23T12:00:00Z") };

    const results = await replayEvents(
      ctx,
      [{ type: "TOGGLE_OPT_IN", clinicId: "cA", userId: "uA", metadata: "{}" }],
      { viewerClinicId: "cA", patientId: "p1" }
    );

    expect(results).toHaveLength(1);
    expect(results[0].action).toBe("TOGGLE_OPT_IN");
    // After toggle, clinic A is opted in but hasn't contributed → INACTIVE_CONTRIBUTOR
    expect(results[0].accessDecision?.allowed).toBe(false);
    expect(results[0].accessDecision?.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
  });
});
