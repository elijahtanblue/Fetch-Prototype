/**
 * Integration tests for end-to-end simulated patient transfer scenario.
 *
 * Walks through:
 * 1. Clinic A opts in, creates visit, adds update
 * 2. Clinic B opts in, creates visit, adds update
 * 3. Both clinics can access each other's data
 * 4. Toggle B off → B denied, A still allowed
 */

import {
  simulateToggle,
  simulateVisit,
  simulateUpdate,
  evaluateAccessForClinic,
  type SimulationContext,
} from "@/domain/services/simulation";

// In-memory state tracker for mock Prisma
interface ClinicState {
  id: string;
  name: string;
  optedIn: boolean;
  lastContributionAt: Date | null;
}

interface EpisodeState {
  id: string;
  patientId: string;
  clinicId: string;
  userId: string;
  reason: string;
  startDate: Date;
}

interface UpdateState {
  id: string;
  episodeId: string;
  clinicId: string;
  userId: string;
  painRegion: string;
  diagnosis: string;
  treatmentModalities: string;
  redFlags: boolean;
  notes: string;
  createdAt: Date;
}

function createStatefulMockPrisma() {
  const clinics: ClinicState[] = [
    { id: "cA", name: "Clinic A", optedIn: false, lastContributionAt: null },
    { id: "cB", name: "Clinic B", optedIn: false, lastContributionAt: null },
  ];
  const episodes: EpisodeState[] = [];
  const updates: UpdateState[] = [];
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
        const ep = { id: `ep-${idCounter}`, ...data } as unknown as EpisodeState;
        episodes.push(ep);
        return ep;
      }),
    },
    clinicalUpdate: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        idCounter++;
        const cu = { id: `cu-${idCounter}`, createdAt: new Date(), ...data } as unknown as UpdateState;
        updates.push(cu);
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
    simulationEvent: {
      create: jest.fn(async () => ({})),
    },
  };
}

describe("Simulation Integration - Patient Transfer Scenario", () => {
  let mockPrisma: ReturnType<typeof createStatefulMockPrisma>;
  let ctx: SimulationContext;

  beforeEach(() => {
    mockPrisma = createStatefulMockPrisma();
    ctx = { prisma: mockPrisma as unknown as SimulationContext["prisma"], now: new Date("2026-02-23T12:00:00Z") };
  });

  test("full patient transfer: both clinics can access after contributing", async () => {
    // Step 1: Clinic A opts in
    const toggleA = await simulateToggle(ctx, { clinicId: "cA", userId: "uA" });
    expect(toggleA.data.optedIn).toBe(true);

    // Step 2: Clinic A creates visit for patient P
    const visitA = await simulateVisit(ctx, {
      clinicId: "cA", userId: "uA", patientId: "p1", reason: "Back pain",
    });
    expect(visitA.success).toBe(true);

    // Step 3: Clinic A adds clinical update
    const updateA = await simulateUpdate(ctx, {
      clinicId: "cA", userId: "uA", episodeId: visitA.data.episodeId as string,
      painRegion: "Lower back", diagnosis: "Herniation",
      treatmentModalities: "Manual therapy",
    });
    expect(updateA.success).toBe(true);

    // Step 4: Clinic B opts in
    const toggleB = await simulateToggle(ctx, { clinicId: "cB", userId: "uB" });
    expect(toggleB.data.optedIn).toBe(true);

    // Step 5: Clinic B creates visit for same patient
    const visitB = await simulateVisit(ctx, {
      clinicId: "cB", userId: "uB", patientId: "p1", reason: "Follow-up",
    });
    expect(visitB.success).toBe(true);

    // Step 6: Clinic B adds clinical update
    const updateB = await simulateUpdate(ctx, {
      clinicId: "cB", userId: "uB", episodeId: visitB.data.episodeId as string,
      painRegion: "Upper back", diagnosis: "Muscle strain",
      treatmentModalities: "Exercise prescription",
    });
    expect(updateB.success).toBe(true);

    // Step 7: Clinic A can access patient P (sees Clinic B's data)
    const accessA = await evaluateAccessForClinic(ctx, { clinicId: "cA", patientId: "p1" });
    expect(accessA.allowed).toBe(true);

    // Step 8: Clinic B can access patient P (sees Clinic A's data)
    const accessB = await evaluateAccessForClinic(ctx, { clinicId: "cB", patientId: "p1" });
    expect(accessB.allowed).toBe(true);
  });

  test("toggle opt-out denies access for that clinic", async () => {
    // Setup: both clinics opt in and contribute
    await simulateToggle(ctx, { clinicId: "cA", userId: "uA" });
    await simulateToggle(ctx, { clinicId: "cB", userId: "uB" });

    const visitA = await simulateVisit(ctx, { clinicId: "cA", userId: "uA", patientId: "p1", reason: "Pain" });
    await simulateUpdate(ctx, {
      clinicId: "cA", userId: "uA", episodeId: visitA.data.episodeId as string,
      painRegion: "Back", diagnosis: "Sprain", treatmentModalities: "Ice",
    });

    const visitB = await simulateVisit(ctx, { clinicId: "cB", userId: "uB", patientId: "p1", reason: "Check" });
    await simulateUpdate(ctx, {
      clinicId: "cB", userId: "uB", episodeId: visitB.data.episodeId as string,
      painRegion: "Neck", diagnosis: "Strain", treatmentModalities: "Heat",
    });

    // Toggle Clinic B opt-out
    const toggleOff = await simulateToggle(ctx, { clinicId: "cB", userId: "uB" });
    expect(toggleOff.data.optedIn).toBe(false);

    // Clinic B denied (OPTED_OUT)
    const accessB = await evaluateAccessForClinic(ctx, { clinicId: "cB", patientId: "p1" });
    expect(accessB.allowed).toBe(false);
    expect(accessB.reasonCode).toBe("OPTED_OUT");

    // Clinic A still allowed (B's data still exists as snapshot)
    const accessA = await evaluateAccessForClinic(ctx, { clinicId: "cA", patientId: "p1" });
    expect(accessA.allowed).toBe(true);
  });

  test("clinic without contribution gets INACTIVE_CONTRIBUTOR", async () => {
    await simulateToggle(ctx, { clinicId: "cA", userId: "uA" });

    // Clinic A is opted in but has not contributed
    const access = await evaluateAccessForClinic(ctx, { clinicId: "cA", patientId: "p1" });
    expect(access.allowed).toBe(false);
    expect(access.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
  });

  test("clinic with no shared data gets NO_SNAPSHOT", async () => {
    await simulateToggle(ctx, { clinicId: "cA", userId: "uA" });
    const visit = await simulateVisit(ctx, { clinicId: "cA", userId: "uA", patientId: "p1", reason: "Test" });
    await simulateUpdate(ctx, {
      clinicId: "cA", userId: "uA", episodeId: visit.data.episodeId as string,
      painRegion: "Back", diagnosis: "Test", treatmentModalities: "Test",
    });

    // Clinic A contributed but no other clinic has contributed for this patient
    const access = await evaluateAccessForClinic(ctx, { clinicId: "cA", patientId: "p1" });
    expect(access.allowed).toBe(false);
    expect(access.reasonCode).toBe("NO_SNAPSHOT");
  });
});
