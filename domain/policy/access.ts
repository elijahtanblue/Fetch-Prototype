/**
 * Canonical access decision module.
 *
 * ALL access decisions must route through this module.
 * No Prisma imports allowed — receives plain data via parameters.
 *
 * Policy contract:
 *   Input:  AccessInput  { optedIn, accessPercent, hasSnapshot }
 *   Output: AccessDecision { allowed, tier?, accessPercent?, reasonCode?, explanation? }
 *
 * Rules (evaluated in order):
 *   1. Clinic must be opted in          → OPTED_OUT
 *   2. accessPercent determines tier     → INACTIVE (0-19%)
 *   3. Snapshot data must exist          → NO_SNAPSHOT
 *   4. Otherwise                         → allowed with tier
 *
 * Tiers:
 *   Full (70-100):    All snapshot fields, full history
 *   Limited (40-69):  Core fields, notes truncated, most recent only
 *   Minimal (20-39):  "History exists" indicator + region only
 *   Inactive (0-19):  No shared access
 *
 * Deterministic: same inputs always produce same output.
 */

export type ReasonCode = "OPTED_OUT" | "INACTIVE_CONTRIBUTOR" | "NO_SNAPSHOT";

export type AccessTier = "full" | "limited" | "minimal" | "inactive";

export interface AccessInput {
  optedIn: boolean;
  accessPercent: number;
  hasSnapshot: boolean;
}

export interface AccessDecision {
  allowed: boolean;
  tier?: AccessTier;
  accessPercent?: number;
  reasonCode?: ReasonCode;
  explanation?: string;
}

// --- Tier thresholds ---

export const TIER_THRESHOLDS = {
  full: { min: 70, max: 100 },
  limited: { min: 40, max: 69 },
  minimal: { min: 20, max: 39 },
  inactive: { min: 0, max: 19 },
} as const;

export const TIER_OVERRIDE_VALUES: Record<AccessTier, number> = {
  full: 100,
  limited: 69,
  minimal: 39,
  inactive: 19,
};

export const POINTS_PER_UPDATE = 6;
export const POINTS_PER_QUICK_HANDOFF = 2;
export const MAX_ACCESS_PERCENT = 100;
export const ANTI_SPAM_CAP = 3;
export const ANTI_SPAM_WINDOW_DAYS = 7;
export const NOTES_TRUNCATE_LENGTH = 100;

// --- Pure functions ---

export function determineTier(accessPercent: number): AccessTier {
  const clamped = Math.max(0, Math.min(100, Math.floor(accessPercent)));
  if (clamped >= TIER_THRESHOLDS.full.min) return "full";
  if (clamped >= TIER_THRESHOLDS.limited.min) return "limited";
  if (clamped >= TIER_THRESHOLDS.minimal.min) return "minimal";
  return "inactive";
}

export function applyDecay(
  accessPercent: number,
  lastDecayAt: Date | null,
  now: Date
): { accessPercent: number; lastDecayAt: Date } {
  if (!lastDecayAt) {
    return { accessPercent, lastDecayAt: now };
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor(
    (now.getTime() - lastDecayAt.getTime()) / msPerDay
  );
  if (daysElapsed <= 0) {
    return { accessPercent, lastDecayAt };
  }
  return {
    accessPercent: Math.max(0, accessPercent - daysElapsed),
    lastDecayAt: now,
  };
}

export function addPoints(
  currentPercent: number,
  points: number
): number {
  return Math.min(MAX_ACCESS_PERCENT, Math.max(0, currentPercent + points));
}

export interface SnapshotEntry {
  id: string;
  clinicName: string;
  episodeReason: string;
  episodeStartDate: Date | string;
  painRegion: string;
  diagnosis: string;
  treatmentModalities: string;
  redFlags: boolean;
  notes: string;
  updateType?: string;
  precautions?: string | null;
  responsePattern?: string | null;
  suggestedNextSteps?: string | null;
  notesSummary?: string | null;
  createdAt: Date | string;
}

export interface FilteredSnapshotEntry {
  id: string;
  clinicName?: string;
  episodeReason?: string;
  episodeStartDate?: Date | string;
  painRegion?: string;
  diagnosis?: string;
  treatmentModalities?: string;
  redFlags?: boolean;
  notes?: string;
  updateType?: string;
  precautions?: string | null;
  responsePattern?: string | null;
  suggestedNextSteps?: string | null;
  notesSummary?: string | null;
  createdAt?: Date | string;
  historyExists?: boolean;
  snapshotLocked?: boolean;
}

export function filterSnapshotByTier(
  snapshot: SnapshotEntry[],
  tier: AccessTier
): FilteredSnapshotEntry[] {
  if (tier === "inactive") return [];

  if (tier === "minimal") {
    return snapshot.length > 0
      ? [{ id: snapshot[0].id, painRegion: snapshot[0].painRegion, historyExists: true, snapshotLocked: true }]
      : [];
  }

  if (tier === "limited") {
    const recent = snapshot[0];
    if (!recent) return [];
    const truncateStr = (s: string | null | undefined): string | null => {
      if (!s) return null;
      return s.length > NOTES_TRUNCATE_LENGTH
        ? s.slice(0, NOTES_TRUNCATE_LENGTH) + "..."
        : s;
    };
    return [{
      id: recent.id,
      clinicName: recent.clinicName,
      episodeReason: recent.episodeReason,
      episodeStartDate: recent.episodeStartDate,
      painRegion: recent.painRegion,
      diagnosis: recent.diagnosis,
      treatmentModalities: recent.treatmentModalities,
      updateType: recent.updateType,
      notes: recent.notes.length > NOTES_TRUNCATE_LENGTH
        ? recent.notes.slice(0, NOTES_TRUNCATE_LENGTH) + "..."
        : recent.notes,
      notesSummary: truncateStr(recent.notesSummary),
      createdAt: recent.createdAt,
    }];
  }

  // Full access
  return snapshot.map((s) => ({ ...s }));
}

// --- Tier Capabilities ---

export interface TierCapabilities {
  canViewSnapshot: boolean;
  canViewDiagnosis: boolean;
  canViewNotes: boolean;
  canViewFullHistory: boolean;
  snapshotLimited: boolean;
}

export function getTierCapabilities(tier: AccessTier): TierCapabilities {
  switch (tier) {
    case "full":
      return {
        canViewSnapshot: true,
        canViewDiagnosis: true,
        canViewNotes: true,
        canViewFullHistory: true,
        snapshotLimited: false,
      };
    case "limited":
      return {
        canViewSnapshot: true,
        canViewDiagnosis: true,
        canViewNotes: true,
        canViewFullHistory: false,
        snapshotLimited: true,
      };
    case "minimal":
      return {
        canViewSnapshot: true,
        canViewDiagnosis: false,
        canViewNotes: false,
        canViewFullHistory: false,
        snapshotLimited: true,
      };
    case "inactive":
      return {
        canViewSnapshot: false,
        canViewDiagnosis: false,
        canViewNotes: false,
        canViewFullHistory: false,
        snapshotLimited: true,
      };
  }
}

export function evaluateAccess(input: AccessInput): AccessDecision {
  if (!input.optedIn) {
    return {
      allowed: false,
      reasonCode: "OPTED_OUT",
      explanation:
        "Your clinic has not opted in to the shared patient history network. An admin must enable opt-in to access shared records.",
    };
  }

  const tier = determineTier(input.accessPercent);

  if (tier === "inactive") {
    return {
      allowed: false,
      tier,
      accessPercent: input.accessPercent,
      reasonCode: "INACTIVE_CONTRIBUTOR",
      explanation:
        "Your clinic's access level is too low to view shared records. Submit clinical updates to increase your access percentage.",
    };
  }

  if (!input.hasSnapshot) {
    return {
      allowed: false,
      tier,
      accessPercent: input.accessPercent,
      reasonCode: "NO_SNAPSHOT",
      explanation:
        "No shared patient history is available for this patient yet. Records will appear once other clinics contribute updates.",
    };
  }

  return {
    allowed: true,
    tier,
    accessPercent: input.accessPercent,
  };
}
