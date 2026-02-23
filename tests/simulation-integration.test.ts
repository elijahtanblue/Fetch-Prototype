/**
 * Integration tests for end-to-end simulated patient transfer scenario.
 *
 * Uses accessPercent-based tier system.
 */

import {
  simulateToggle,
  simulateVisit,
  simulateUpdate,
  evaluateAccessForClinic,
  type SimulationContext,
} from "@/domain/services/simulation";

interface ClinicState {
  id: string;
  name: string;
  optedIn: boolean;
  accessPercent: number;
  lastDecayAt: Date | null;
  lastContributionAt: Date | null;
}

function createStatefulMockPrisma() {
  const clinics: ClinicState[] = [
    { id: "cA", name: "Clinic A", optedIn: false, accessPercent: 0, lastDecayAt: null, lastContributionAt: null },
    { id: "cB", name: "Clinic B", optedIn: false, accessPercent: 0, lastDecayAt: null, lastContributionAt: null },
  ];
  const episodes: Array<{ id: string; patientId: string; clinicId: string }> = [];
  const updates: Array<{ id: string; episodeId: string; clinicId: string }> = [];
  let idCounter = 0;

  return {
    clinic: {
      findUnique: jest.fn(async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
        const c = clinics.find((c) => c.id === where.id);
        if (!c) return null;
        if (select) {
          const result: Record<string, unknown> = {};
          for (const key of Object.keys(select)) {
            result[key] = (c as Record<string, unknown>)[key];
          }
          return result;
        }
        return { ...c };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const c = clinics.find((c) => c.id === where.id)!;
        Object.assign(c, data);
        return { ...c };
      }),
    },
    episode: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        idCounter++;
        const ep = { id: `ep-${idCounter}`, ...data };
        episodes.push(ep as { id: string; patientId: string; clinicId: string });
        return ep;
      }),
    },
    clinicalUpdate: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        idCounter++;
        const cu = { id: `cu-${idCounter}`, createdAt: new Date(), ...data };
        updates.push(cu as { id: string; episodeId: string; clinicId: string });
        return cu;
      }),
      findMany: jest.fn(async ({ where }: { where: { episode: { patientId: string }; clinicId: { not: string } } }) => {
        const patientId = where.episode.patientId;
        const excludeClinicId = where.clinicId.not;
        const matching = updates.filter((u) => {
          const ep = episodes.find((e) => e.id === u.episodeId);
          return ep && ep.patientId === patientId && u.clinicId !== excludeClinicId;
        });
        return matching.map((u) => ({
          ...u,
          episode: { reason: "Test", startDate: new Date() },
          clinic: { name: clinics.find((c) => c.id === u.clinicId)?.name ?? "Unknown" },
        }));
      }),
    },
    patient: {
      findUnique: jest.fn(async () => ({ consentStatus: "SHARE" })),
    },
    simulationEvent: {
      create: jest.fn(async () => ({})),
    },
  };
}

describe("Simulation Integration - Patient Transfer with Tiers", () => {
  let mockPrisma: ReturnType<typeof createStatefulMockPrisma>;
  let ctx: SimulationContext;

  beforeEach(() => {
    mockPrisma = createStatefulMockPrisma();
    ctx = { prisma: mockPrisma as unknown as SimulationContext["prisma"], now: new Date("2026-02-23T12:00:00Z") };
  });

  test("full patient transfer: both clinics earn points and can access", async () => {
    // Clinic A opts in
    await simulateToggle(ctx, { clinicId: "cA", userId: "uA" });

    // Clinic A creates visit + 12 updates to reach full tier (12 * 6 = 72%)
    const visitA = await simulateVisit(ctx, {
      clinicId: "cA", userId: "uA", patientId: "p1", reason: "Back pain",
    });
    for (let i = 0; i < 12; i++) {
      await simulateUpdate(ctx, {
        clinicId: "cA", userId: "uA", episodeId: visitA.data.episodeId as string,
        painRegion: "Lower back", diagnosis: "Herniation",
        treatmentModalities: "Manual therapy",
      });
    }

    // Clinic B opts in and contributes similarly
    await simulateToggle(ctx, { clinicId: "cB", userId: "uB" });
    const visitB = await simulateVisit(ctx, {
      clinicId: "cB", userId: "uB", patientId: "p1", reason: "Follow-up",
    });
    for (let i = 0; i < 12; i++) {
      await simulateUpdate(ctx, {
        clinicId: "cB", userId: "uB", episodeId: visitB.data.episodeId as string,
        painRegion: "Upper back", diagnosis: "Muscle strain",
        treatmentModalities: "Exercise prescription",
      });
    }

    // Both clinics can access
    const accessA = await evaluateAccessForClinic(ctx, { clinicId: "cA", patientId: "p1" });
    expect(accessA.allowed).toBe(true);
    expect(accessA.tier).toBe("full");

    const accessB = await evaluateAccessForClinic(ctx, { clinicId: "cB", patientId: "p1" });
    expect(accessB.allowed).toBe(true);
    expect(accessB.tier).toBe("full");
  });

  test("toggle opt-out denies access for that clinic", async () => {
    // Setup: both clinics opted in and contributing
    await simulateToggle(ctx, { clinicId: "cA", userId: "uA" });
    await simulateToggle(ctx, { clinicId: "cB", userId: "uB" });

    const visitA = await simulateVisit(ctx, { clinicId: "cA", userId: "uA", patientId: "p1", reason: "Pain" });
    for (let i = 0; i < 12; i++) {
      await simulateUpdate(ctx, {
        clinicId: "cA", userId: "uA", episodeId: visitA.data.episodeId as string,
        painRegion: "Back", diagnosis: "Sprain", treatmentModalities: "Ice",
      });
    }

    const visitB = await simulateVisit(ctx, { clinicId: "cB", userId: "uB", patientId: "p1", reason: "Check" });
    for (let i = 0; i < 12; i++) {
      await simulateUpdate(ctx, {
        clinicId: "cB", userId: "uB", episodeId: visitB.data.episodeId as string,
        painRegion: "Neck", diagnosis: "Strain", treatmentModalities: "Heat",
      });
    }

    // Toggle B opt-out
    await simulateToggle(ctx, { clinicId: "cB", userId: "uB" });

    // B denied (OPTED_OUT) even with high accessPercent
    const accessB = await evaluateAccessForClinic(ctx, { clinicId: "cB", patientId: "p1" });
    expect(accessB.allowed).toBe(false);
    expect(accessB.reasonCode).toBe("OPTED_OUT");

    // A still allowed
    const accessA = await evaluateAccessForClinic(ctx, { clinicId: "cA", patientId: "p1" });
    expect(accessA.allowed).toBe(true);
  });

  test("clinic with full access but no cross-clinic data gets NO_SNAPSHOT", async () => {
    // Opt-in sets accessPercent=100 (full tier)
    await simulateToggle(ctx, { clinicId: "cA", userId: "uA" });

    // Clinic A contributes its own data, but no OTHER clinic has contributed for this patient
    const visit = await simulateVisit(ctx, { clinicId: "cA", userId: "uA", patientId: "p1", reason: "Test" });
    await simulateUpdate(ctx, {
      clinicId: "cA", userId: "uA", episodeId: visit.data.episodeId as string,
      painRegion: "Back", diagnosis: "Test", treatmentModalities: "Test",
    });

    const access = await evaluateAccessForClinic(ctx, { clinicId: "cA", patientId: "p1" });
    expect(access.allowed).toBe(false);
    expect(access.reasonCode).toBe("NO_SNAPSHOT");
    expect(access.tier).toBe("full");
  });
});
