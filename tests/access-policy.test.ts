/**
 * Pure unit tests for domain/policy/access.ts
 *
 * Covers all reason codes and boundary date conditions.
 * The policy module is pure (no Prisma) — no mocking needed.
 */

import { evaluateAccess, AccessInput } from "@/domain/policy/access";

const NOW = new Date("2026-02-22T12:00:00Z");

function makeInput(overrides: Partial<AccessInput> = {}): AccessInput {
  return {
    optedIn: true,
    lastContributionAt: new Date("2026-02-20T12:00:00Z"), // 2 days ago
    now: NOW,
    hasSnapshot: true,
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
      makeInput({
        optedIn: false,
        lastContributionAt: null,
        hasSnapshot: false,
      })
    );
    expect(result.reasonCode).toBe("OPTED_OUT");
  });

  // --- INACTIVE_CONTRIBUTOR ---
  test("denies with INACTIVE_CONTRIBUTOR when lastContributionAt is null", () => {
    const result = evaluateAccess(makeInput({ lastContributionAt: null }));
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
  });

  test("denies with INACTIVE_CONTRIBUTOR when contribution is 31 days old", () => {
    const thirtyOneDaysAgo = new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000);
    const result = evaluateAccess(
      makeInput({ lastContributionAt: thirtyOneDaysAgo })
    );
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
  });

  test("allows when contribution is exactly 30 days old (boundary)", () => {
    const thirtyDaysAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    const result = evaluateAccess(
      makeInput({ lastContributionAt: thirtyDaysAgo })
    );
    expect(result.allowed).toBe(true);
  });

  test("allows when contribution is 29 days old", () => {
    const twentyNineDaysAgo = new Date(
      NOW.getTime() - 29 * 24 * 60 * 60 * 1000
    );
    const result = evaluateAccess(
      makeInput({ lastContributionAt: twentyNineDaysAgo })
    );
    expect(result.allowed).toBe(true);
  });

  test("denies with INACTIVE_CONTRIBUTOR when contribution is 60 days old", () => {
    const sixtyDaysAgo = new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000);
    const result = evaluateAccess(
      makeInput({ lastContributionAt: sixtyDaysAgo })
    );
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
  });

  // --- NO_SNAPSHOT ---
  test("denies with NO_SNAPSHOT when hasSnapshot is false", () => {
    const result = evaluateAccess(makeInput({ hasSnapshot: false }));
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("NO_SNAPSHOT");
    expect(result.explanation).toBeDefined();
  });

  // --- ALLOWED ---
  test("allows when all conditions are met", () => {
    const result = evaluateAccess(makeInput());
    expect(result.allowed).toBe(true);
    expect(result.reasonCode).toBeUndefined();
    expect(result.explanation).toBeUndefined();
  });

  test("allows when contribution is today", () => {
    const result = evaluateAccess(
      makeInput({ lastContributionAt: new Date(NOW) })
    );
    expect(result.allowed).toBe(true);
  });

  // --- Determinism ---
  test("same inputs always produce same output (deterministic)", () => {
    const input = makeInput();
    const result1 = evaluateAccess(input);
    const result2 = evaluateAccess(input);
    const result3 = evaluateAccess(input);
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });

  // --- Priority order ---
  test("INACTIVE_CONTRIBUTOR takes priority over NO_SNAPSHOT", () => {
    const result = evaluateAccess(
      makeInput({ lastContributionAt: null, hasSnapshot: false })
    );
    expect(result.reasonCode).toBe("INACTIVE_CONTRIBUTOR");
  });
});
