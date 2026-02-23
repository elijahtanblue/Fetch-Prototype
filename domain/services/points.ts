/**
 * Points ledger service.
 *
 * Centralizes all accessPercent mutations. Every point change
 * creates an AccessEvent row for audit trail, then updates
 * clinic.accessPercent (clamped to 0-100).
 */

import type { PrismaClient } from "@/lib/generated/prisma/client";
import { addPoints } from "@/domain/policy/access";

export interface AwardPointsInput {
  clinicId: string;
  delta: number;
  reasonCode: string;
  patientId?: string;
  episodeId?: string;
  updateId?: string;
}

/**
 * Award (or deduct) points for a clinic.
 * Creates an AccessEvent ledger row and updates clinic.accessPercent.
 * Returns the new accessPercent after clamping.
 */
export async function awardPoints(
  prisma: PrismaClient,
  input: AwardPointsInput
): Promise<{ newAccessPercent: number }> {
  // Get current accessPercent
  const clinic = await prisma.clinic.findUnique({
    where: { id: input.clinicId },
    select: { accessPercent: true },
  });

  const currentPercent = clinic?.accessPercent ?? 0;
  const newAccessPercent = addPoints(currentPercent, input.delta);

  // Create ledger event
  await prisma.accessEvent.create({
    data: {
      clinicId: input.clinicId,
      delta: input.delta,
      reasonCode: input.reasonCode,
      patientId: input.patientId ?? null,
      episodeId: input.episodeId ?? null,
      updateId: input.updateId ?? null,
    },
  });

  // Update clinic accessPercent
  await prisma.clinic.update({
    where: { id: input.clinicId },
    data: { accessPercent: newAccessPercent },
  });

  return { newAccessPercent };
}

// Reason codes
export const REASON_CODES = {
  STRUCTURED_UPDATE: "STRUCTURED_UPDATE",
  QUICK_HANDOFF: "QUICK_HANDOFF",
  OPT_IN_BONUS: "OPT_IN_BONUS",
  ADMIN_OVERRIDE: "ADMIN_OVERRIDE",
  DECAY: "DECAY",
} as const;
