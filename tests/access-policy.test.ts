/**
 * Pure unit tests for domain/policy/access.ts
 *
 * Covers all reason codes, tier determination, decay, field filtering.
 * The policy module is pure (no Prisma) — no mocking needed.
 */

import {
  evaluateAccess,
  determineTier,
  applyDecay,
  addPoints,
  filterSnapshotByTier,
  type AccessInput,
  type SnapshotEntry,
  POINTS_PER_UPDATE,
  MAX_ACCESS_PERCENT,
  NOTES_TRUNCATE_LENGTH,
} from "@/domain/policy/access";

function makeInput(overrides: Partial<AccessInput> = {}): AccessInput {
  return {
    optedIn: true,
    accessPercent: 80, // Full tier
    hasSnapshot: true,
    ...overrides,
  };
}

const NOW = new Date("2026-02-22T12:00:00Z");

function makeSnapshot(overrides: Partial<SnapshotEntry> = {}): SnapshotEntry {
  return {
    id: "s1",
    clinicName: "Other Clinic",
    episodeReason: "Back pain",
    episodeStartDate: "2026-02-15",
    painRegion: "Lower back",
    diagnosis: "Disc herniation",
    treatmentModalities: "Manual therapy",
    redFlags: false,
    notes: "Patient improving steadily",
    createdAt: "2026-02-20",
    ...overrides,
  };
}

describe("Access Policy - evaluateAccess", () => {
  // --- OPTED_OUT ---
  test("denies with OPTED_OUT when clinic is not opted in", () => {
    const result = evaluateAccess(makeInput({ optedIn: false }));
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("OPTED_OUT");
    expect(result.explanation).toBeDefined();
  });

  test("OPTED_OUT takes priority over other deny reasons", () => {
    const result = evaluateAccess(
      makeInput({ optedIn: false, accessPercent: 0, hasSnapshot: false })
    );
    expect(result.reasonCode).toBe("OPTED_OUT");
  });

  // --- INACTIVE_CONTRIBUTOR (tier inactive: 0-19%) ---
  test("denies with INACTIVE_CONTRIBUTOR when accessPercent is 0", () => {
    const result = evaluateAccess(makeInput({ accessPercent: 0 }));
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
  });

  test("denies with INACTIVE_CONTRIBUTOR when accessPercent is 19", () => {
    const result = evaluateAccess(makeInput({ accessPercent: 19 }));
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
    expect(result.tier).toBe("inactive");
  });

  test("allows when accessPercent is 20 (minimal tier boundary)", () => {
    const result = evaluateAccess(makeInput({ accessPercent: 20 }));
    expect(result.allowed).toBe(true);
    expect(result.tier).toBe("minimal");
  });

  // --- NO_SNAPSHOT ---
  test("denies with NO_SNAPSHOT when hasSnapshot is false", () => {
    const result = evaluateAccess(makeInput({ hasSnapshot: false }));
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("NO_SNAPSHOT");
    expect(result.explanation).toBeDefined();
  });

  // --- ALLOWED with tiers ---
  test("allows with full tier when accessPercent is 80", () => {
    const result = evaluateAccess(makeInput({ accessPercent: 80 }));
    expect(result.allowed).toBe(true);
    expect(result.tier).toBe("full");
    expect(result.accessPercent).toBe(80);
  });

  test("allows with limited tier when accessPercent is 50", () => {
    const result = evaluateAccess(makeInput({ accessPercent: 50 }));
    expect(result.allowed).toBe(true);
    expect(result.tier).toBe("limited");
  });

  test("allows with minimal tier when accessPercent is 25", () => {
    const result = evaluateAccess(makeInput({ accessPercent: 25 }));
    expect(result.allowed).toBe(true);
    expect(result.tier).toBe("minimal");
  });

  // --- Determinism ---
  test("same inputs always produce same output (deterministic)", () => {
    const input = makeInput();
    const result1 = evaluateAccess(input);
    const result2 = evaluateAccess(input);
    expect(result1).toEqual(result2);
  });

  // --- Priority order ---
  test("INACTIVE_CONTRIBUTOR takes priority over NO_SNAPSHOT", () => {
    const result = evaluateAccess(
      makeInput({ accessPercent: 5, hasSnapshot: false })
    );
    expect(result.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
  });
});

describe("determineTier", () => {
  test("returns full for 70-100", () => {
    expect(determineTier(70)).toBe("full");
    expect(determineTier(100)).toBe("full");
    expect(determineTier(85)).toBe("full");
  });

  test("returns limited for 40-69", () => {
    expect(determineTier(40)).toBe("limited");
    expect(determineTier(69)).toBe("limited");
    expect(determineTier(55)).toBe("limited");
  });

  test("returns minimal for 20-39", () => {
    expect(determineTier(20)).toBe("minimal");
    expect(determineTier(39)).toBe("minimal");
  });

  test("returns inactive for 0-19", () => {
    expect(determineTier(0)).toBe("inactive");
    expect(determineTier(19)).toBe("inactive");
  });

  test("clamps values above 100 to full", () => {
    expect(determineTier(150)).toBe("full");
  });

  test("clamps negative values to inactive", () => {
    expect(determineTier(-5)).toBe("inactive");
  });
});

describe("applyDecay", () => {
  test("returns same percent when lastDecayAt is null (first time)", () => {
    const result = applyDecay(80, null, NOW);
    expect(result.accessPercent).toBe(80);
    expect(result.lastDecayAt).toBe(NOW);
  });

  test("decays 1% per day elapsed", () => {
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
    const result = applyDecay(80, fiveDaysAgo, NOW);
    expect(result.accessPercent).toBe(75);
    expect(result.lastDecayAt).toBe(NOW);
  });

  test("does not decay below 0", () => {
    const hundredDaysAgo = new Date(NOW.getTime() - 100 * 24 * 60 * 60 * 1000);
    const result = applyDecay(50, hundredDaysAgo, NOW);
    expect(result.accessPercent).toBe(0);
  });

  test("does not decay when 0 days elapsed", () => {
    const result = applyDecay(80, NOW, NOW);
    expect(result.accessPercent).toBe(80);
  });

  test("does not decay when lastDecayAt is in the future", () => {
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const result = applyDecay(80, tomorrow, NOW);
    expect(result.accessPercent).toBe(80);
  });
});

describe("addPoints", () => {
  test("adds points to current percent", () => {
    expect(addPoints(50, POINTS_PER_UPDATE)).toBe(56);
  });

  test("caps at MAX_ACCESS_PERCENT", () => {
    expect(addPoints(97, POINTS_PER_UPDATE)).toBe(MAX_ACCESS_PERCENT);
  });

  test("does not go below 0", () => {
    expect(addPoints(3, -10)).toBe(0);
  });
});

describe("filterSnapshotByTier", () => {
  const snapshots: SnapshotEntry[] = [
    makeSnapshot({ id: "s1", notes: "First note" }),
    makeSnapshot({ id: "s2", notes: "Second note" }),
  ];

  test("full tier returns all entries with all fields", () => {
    const result = filterSnapshotByTier(snapshots, "full");
    expect(result).toHaveLength(2);
    expect(result[0].diagnosis).toBe("Disc herniation");
    expect(result[0].notes).toBe("First note");
    expect(result[0].redFlags).toBe(false);
  });

  test("limited tier returns only most recent entry", () => {
    const result = filterSnapshotByTier(snapshots, "limited");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
    expect(result[0].diagnosis).toBe("Disc herniation");
    expect(result[0].redFlags).toBeUndefined(); // filtered out for limited
  });

  test("limited tier truncates long notes", () => {
    const longNotes = "A".repeat(200);
    const result = filterSnapshotByTier(
      [makeSnapshot({ notes: longNotes })],
      "limited"
    );
    expect(result[0].notes!.length).toBeLessThanOrEqual(NOTES_TRUNCATE_LENGTH + 3);
    expect(result[0].notes!.endsWith("...")).toBe(true);
  });

  test("limited tier keeps short notes intact", () => {
    const result = filterSnapshotByTier(
      [makeSnapshot({ notes: "Short" })],
      "limited"
    );
    expect(result[0].notes).toBe("Short");
  });

  test("minimal tier returns single entry with painRegion and locked indicator", () => {
    const result = filterSnapshotByTier(snapshots, "minimal");
    expect(result).toHaveLength(1);
    expect(result[0].painRegion).toBe("Lower back");
    expect(result[0].historyExists).toBe(true);
    expect(result[0].snapshotLocked).toBe(true);
    expect(result[0].diagnosis).toBeUndefined();
    expect(result[0].clinicName).toBeUndefined();
  });

  test("inactive tier returns empty array", () => {
    const result = filterSnapshotByTier(snapshots, "inactive");
    expect(result).toHaveLength(0);
  });

  test("returns empty array for empty snapshot input", () => {
    expect(filterSnapshotByTier([], "full")).toHaveLength(0);
    expect(filterSnapshotByTier([], "limited")).toHaveLength(0);
    expect(filterSnapshotByTier([], "minimal")).toHaveLength(0);
  });
});

describe("Regression - clinic at 0% stays opted-in", () => {
  test("clinic with accessPercent=0 and optedIn=true returns INACTIVE_CONTRIBUTOR, not OPTED_OUT", () => {
    const result = evaluateAccess({
      optedIn: true,
      accessPercent: 0,
      hasSnapshot: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
    // Key: optedIn is not changed by the policy — it's still true in the input
    // The policy only reads optedIn, it never mutates it
  });

  test("evaluateAccess never returns a directive to change optedIn", () => {
    const result = evaluateAccess({
      optedIn: true,
      accessPercent: 0,
      hasSnapshot: true,
    });
    // AccessDecision does not have an optedIn field — policy never forces opt-out
    expect(result).not.toHaveProperty("optedIn");
  });
});
