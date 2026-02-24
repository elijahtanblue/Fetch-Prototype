/**
 * Simulation orchestrator service.
 *
 * Coordinates toggle/visit/update actions for admin-driven simulation.
 * Delegates all access decisions to domain/policy/access.ts.
 * Accepts PrismaClient via dependency injection for testability.
 */

import type { PrismaClient } from "@/lib/generated/prisma/client";
import {
  evaluateAccess,
  applyDecay,
  POINTS_PER_UPDATE,
  POINTS_PER_QUICK_HANDOFF,
  ANTI_SPAM_CAP,
  ANTI_SPAM_WINDOW_DAYS,
  type AccessDecision,
} from "@/domain/policy/access";
import { getSharedUpdatesForPatient } from "@/domain/services/snapshot";
import { generateSummary } from "@/domain/services/summarizer";
import { awardPoints, REASON_CODES } from "@/domain/services/points";

// --- Types ---

export interface SimulationContext {
  prisma: PrismaClient;
  now?: Date;
}

export interface SimulationResult {
  action: string;
  success: boolean;
  data: Record<string, unknown>;
  accessDecision?: AccessDecision;
}

export interface SimulateToggleInput {
  clinicId: string;
  userId: string;
}

export interface SimulateVisitInput {
  clinicId: string;
  userId: string;
  patientId: string;
  reason: string;
}

export interface SimulateUpdateInput {
  clinicId: string;
  userId: string;
  episodeId: string;
  painRegion: string;
  diagnosis: string;
  treatmentModalities: string;
  redFlags?: boolean;
  notes?: string;
  updateType?: string;
  precautions?: string;
  responsePattern?: string;
  suggestedNextSteps?: string;
  notesRaw?: string;
}

export interface SimulateAccessCheckInput {
  clinicId: string;
  patientId: string;
}

export interface ReplayInput {
  viewerClinicId: string;
  patientId: string;
}

// --- Functions ---

export async function simulateToggle(
  ctx: SimulationContext,
  input: SimulateToggleInput
): Promise<SimulationResult> {
  const clinic = await ctx.prisma.clinic.findUnique({
    where: { id: input.clinicId },
  });

  if (!clinic) {
    return { action: "TOGGLE_OPT_IN", success: false, data: { error: "Clinic not found" } };
  }

  const turningOn = !clinic.optedIn;
  const now = ctx.now ?? new Date();
  const updated = await ctx.prisma.clinic.update({
    where: { id: input.clinicId },
    data: {
      optedIn: turningOn,
      ...(turningOn ? { accessPercent: 100, lastDecayAt: now } : {}),
    },
  });

  await ctx.prisma.simulationEvent.create({
    data: {
      type: "TOGGLE_OPT_IN",
      clinicId: input.clinicId,
      userId: input.userId,
      metadata: JSON.stringify({
        previousStatus: clinic.optedIn,
        newStatus: updated.optedIn,
      }),
    },
  });

  return {
    action: "TOGGLE_OPT_IN",
    success: true,
    data: { id: updated.id, name: updated.name, optedIn: updated.optedIn },
  };
}

export async function simulateVisit(
  ctx: SimulationContext,
  input: SimulateVisitInput
): Promise<SimulationResult> {
  const now = ctx.now ?? new Date();

  const episode = await ctx.prisma.episode.create({
    data: {
      patientId: input.patientId,
      clinicId: input.clinicId,
      userId: input.userId,
      reason: input.reason,
      startDate: now,
    },
  });

  await ctx.prisma.simulationEvent.create({
    data: {
      type: "VISIT",
      clinicId: input.clinicId,
      userId: input.userId,
      metadata: JSON.stringify({
        episodeId: episode.id,
        patientId: input.patientId,
      }),
    },
  });

  return {
    action: "VISIT",
    success: true,
    data: { episodeId: episode.id, patientId: input.patientId, reason: input.reason },
  };
}

export async function simulateUpdate(
  ctx: SimulationContext,
  input: SimulateUpdateInput
): Promise<SimulationResult> {
  const now = ctx.now ?? new Date();

  const effectiveType = input.updateType ?? "STRUCTURED";

  const notesRawValue = input.notesRaw ?? null;
  const notesSummaryValue = notesRawValue ? generateSummary(notesRawValue) : null;

  const update = await ctx.prisma.clinicalUpdate.create({
    data: {
      episodeId: input.episodeId,
      clinicId: input.clinicId,
      userId: input.userId,
      updateType: effectiveType,
      painRegion: input.painRegion,
      diagnosis: input.diagnosis,
      treatmentModalities: input.treatmentModalities,
      redFlags: input.redFlags ?? false,
      notes: notesSummaryValue ?? input.notes ?? "",
      notesRaw: notesRawValue,
      notesSummary: notesSummaryValue,
      ...(effectiveType === "STRUCTURED" ? {
        precautions: input.precautions ?? null,
        responsePattern: input.responsePattern ?? null,
        suggestedNextSteps: input.suggestedNextSteps ?? null,
      } : {}),
    },
  });

  // Apply decay first
  const pointsForType = effectiveType === "STRUCTURED" ? POINTS_PER_UPDATE : POINTS_PER_QUICK_HANDOFF;
  const clinic = await ctx.prisma.clinic.findUnique({
    where: { id: input.clinicId },
    select: { accessPercent: true, lastDecayAt: true },
  });

  const decayed = applyDecay(
    clinic?.accessPercent ?? 0,
    clinic?.lastDecayAt ?? null,
    now
  );

  // Persist decay
  if (decayed.accessPercent !== (clinic?.accessPercent ?? 0)) {
    await ctx.prisma.clinic.update({
      where: { id: input.clinicId },
      data: {
        accessPercent: decayed.accessPercent,
        lastDecayAt: decayed.lastDecayAt,
      },
    });
  }

  // Anti-spam: count point-earning updates for this patient's episodes in last 7 days
  const episode = await ctx.prisma.episode.findUnique({
    where: { id: input.episodeId },
    select: { patientId: true },
  });
  const spamWindowStart = new Date(
    now.getTime() - ANTI_SPAM_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const recentUpdatesForPatient = await ctx.prisma.clinicalUpdate.count({
    where: {
      clinicId: input.clinicId,
      episode: { patientId: episode?.patientId },
      createdAt: { gte: spamWindowStart },
      id: { not: update.id },
    },
  });

  const earnedPoints = recentUpdatesForPatient < ANTI_SPAM_CAP;
  const pointsDelta = earnedPoints ? pointsForType : 0;

  // Award points via ledger if earned
  let newPercent = decayed.accessPercent;
  if (earnedPoints) {
    const reasonCode = effectiveType === "STRUCTURED"
      ? REASON_CODES.STRUCTURED_UPDATE
      : REASON_CODES.QUICK_HANDOFF;
    const result = await awardPoints(ctx.prisma, {
      clinicId: input.clinicId,
      delta: pointsForType,
      reasonCode,
      patientId: episode?.patientId,
      episodeId: input.episodeId,
      updateId: update.id,
    });
    newPercent = result.newAccessPercent;
  }

  // Update timestamps
  await ctx.prisma.clinic.update({
    where: { id: input.clinicId },
    data: {
      lastContributionAt: now,
      lastDecayAt: now,
    },
  });

  await ctx.prisma.simulationEvent.create({
    data: {
      type: "CLINICAL_UPDATE",
      clinicId: input.clinicId,
      userId: input.userId,
      metadata: JSON.stringify({
        updateId: update.id,
        episodeId: input.episodeId,
        updateType: effectiveType,
        pointsEarned: pointsDelta,
        newAccessPercent: newPercent,
      }),
    },
  });

  return {
    action: "CLINICAL_UPDATE",
    success: true,
    data: {
      updateId: update.id,
      episodeId: input.episodeId,
      painRegion: input.painRegion,
      diagnosis: input.diagnosis,
      accessPercent: newPercent,
    },
  };
}

export async function evaluateAccessForClinic(
  ctx: SimulationContext,
  input: SimulateAccessCheckInput
): Promise<AccessDecision> {
  const now = ctx.now ?? new Date();

  const clinic = await ctx.prisma.clinic.findUnique({
    where: { id: input.clinicId },
    select: { optedIn: true, accessPercent: true, lastDecayAt: true },
  });

  if (!clinic) {
    return { allowed: false, reasonCode: "OPTED_OUT", explanation: "Clinic not found" };
  }

  // Apply decay and persist if changed
  const decayed = applyDecay(clinic.accessPercent, clinic.lastDecayAt, now);

  if (
    decayed.accessPercent !== clinic.accessPercent ||
    decayed.lastDecayAt !== clinic.lastDecayAt
  ) {
    await ctx.prisma.clinic.update({
      where: { id: input.clinicId },
      data: {
        accessPercent: decayed.accessPercent,
        lastDecayAt: decayed.lastDecayAt,
      },
    });

    const decayDelta = decayed.accessPercent - clinic.accessPercent;
    if (decayDelta !== 0) {
      await ctx.prisma.accessEvent.create({
        data: {
          clinicId: input.clinicId,
          delta: decayDelta,
          reasonCode: "DECAY",
        },
      });
    }
  }

  const { updates: sharedUpdates } = await getSharedUpdatesForPatient(
    ctx.prisma,
    input.patientId,
    input.clinicId
  );

  return evaluateAccess({
    optedIn: clinic.optedIn,
    accessPercent: decayed.accessPercent,
    hasSnapshot: sharedUpdates.length > 0,
  });
}

export async function replayEvents(
  ctx: SimulationContext,
  events: Array<{ type: string; clinicId: string; userId: string; metadata: string }>,
  input: ReplayInput
): Promise<SimulationResult[]> {
  const results: SimulationResult[] = [];

  for (const event of events) {
    const meta = JSON.parse(event.metadata);

    switch (event.type) {
      case "TOGGLE_OPT_IN":
        await simulateToggle(ctx, {
          clinicId: event.clinicId,
          userId: event.userId,
        });
        break;
      case "VISIT":
        await simulateVisit(ctx, {
          clinicId: event.clinicId,
          userId: event.userId,
          patientId: meta.patientId,
          reason: meta.reason ?? "Simulated visit",
        });
        break;
      case "CLINICAL_UPDATE":
        await simulateUpdate(ctx, {
          clinicId: event.clinicId,
          userId: event.userId,
          episodeId: meta.episodeId,
          painRegion: meta.painRegion ?? "N/A",
          diagnosis: meta.diagnosis ?? "N/A",
          treatmentModalities: meta.treatmentModalities ?? "N/A",
          redFlags: meta.redFlags ?? false,
          notes: meta.notes ?? "",
        });
        break;
    }

    const accessDecision = await evaluateAccessForClinic(ctx, {
      clinicId: input.viewerClinicId,
      patientId: input.patientId,
    });

    results.push({
      action: event.type,
      success: true,
      data: { clinicId: event.clinicId, metadata: meta },
      accessDecision,
    });
  }

  return results;
}
