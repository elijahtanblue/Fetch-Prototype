/**
 * Canonical access decision module.
 *
 * ALL access decisions must route through this module.
 * No Prisma imports allowed — receives plain data via parameters.
 *
 * Policy contract:
 *   Input:  AccessInput  { optedIn, lastContributionAt, now, hasSnapshot }
 *   Output: AccessDecision { allowed, reasonCode?, explanation? }
 *
 * Rules (evaluated in order):
 *   1. Clinic must be opted in          → OPTED_OUT
 *   2. Must have contributed within 30d → INACTIVE_CONTRIBUTOR
 *   3. Snapshot data must exist          → NO_SNAPSHOT
 *   4. Otherwise                         → allowed
 *
 * Deterministic: same inputs always produce same output.
 */

export type ReasonCode = "OPTED_OUT" | "INACTIVE_CONTRIBUTOR" | "NO_SNAPSHOT";

export interface AccessInput {
  optedIn: boolean;
  lastContributionAt: Date | null;
  now: Date;
  hasSnapshot: boolean;
}

export interface AccessDecision {
  allowed: boolean;
  reasonCode?: ReasonCode;
  explanation?: string;
}

const CONTRIBUTION_WINDOW_DAYS = 30;

export function evaluateAccess(input: AccessInput): AccessDecision {
  if (!input.optedIn) {
    return {
      allowed: false,
      reasonCode: "OPTED_OUT",
      explanation:
        "Your clinic has not opted in to the shared patient history network. An admin must enable opt-in to access shared records.",
    };
  }

  if (!input.lastContributionAt) {
    return {
      allowed: false,
      reasonCode: "INACTIVE_CONTRIBUTOR",
      explanation:
        "Your clinic has not contributed any clinical updates yet. Submit a clinical update to unlock access to shared patient history.",
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceContribution = Math.floor(
    (input.now.getTime() - input.lastContributionAt.getTime()) / msPerDay
  );

  if (daysSinceContribution > CONTRIBUTION_WINDOW_DAYS) {
    return {
      allowed: false,
      reasonCode: "INACTIVE_CONTRIBUTOR",
      explanation: `Your clinic's last contribution was ${daysSinceContribution} days ago. Contribute a clinical update within the 30-day window to restore access.`,
    };
  }

  if (!input.hasSnapshot) {
    return {
      allowed: false,
      reasonCode: "NO_SNAPSHOT",
      explanation:
        "No shared patient history is available for this patient yet. Records will appear once other clinics contribute updates.",
    };
  }

  return { allowed: true };
}
