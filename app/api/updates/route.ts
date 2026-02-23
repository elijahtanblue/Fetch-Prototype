import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  POINTS_PER_UPDATE,
  POINTS_PER_QUICK_HANDOFF,
  ANTI_SPAM_CAP,
  ANTI_SPAM_WINDOW_DAYS,
  applyDecay,
} from "@/domain/policy/access";
import { awardPoints, REASON_CODES } from "@/domain/services/points";
import { generateSummary } from "@/domain/services/summarizer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateType = (body.updateType as string) || "STRUCTURED";
  if (updateType !== "STRUCTURED" && updateType !== "QUICK_HANDOFF") {
    return NextResponse.json(
      { error: "Invalid updateType. Must be: STRUCTURED or QUICK_HANDOFF" },
      { status: 400 }
    );
  }

  const episodeId = body.episodeId as string | undefined;
  const painRegion = body.painRegion as string | undefined;
  const diagnosis = body.diagnosis as string | undefined;
  const treatmentModalities = body.treatmentModalities as string | undefined;
  const redFlags = body.redFlags as boolean | undefined;
  const notes = body.notes as string | undefined;

  if (updateType === "STRUCTURED") {
    if (!episodeId || !painRegion || !diagnosis || !treatmentModalities) {
      return NextResponse.json(
        { error: "Missing required fields: episodeId, painRegion, diagnosis, treatmentModalities" },
        { status: 400 }
      );
    }
  } else {
    if (!episodeId || !painRegion || !diagnosis) {
      return NextResponse.json(
        { error: "Missing required fields: episodeId, painRegion, diagnosis" },
        { status: 400 }
      );
    }
  }

  const episode = await prisma.episode.findUnique({ where: { id: episodeId } });

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  const clinicId = user.clinicId as string;
  const userId = user.id as string;

  // Build create data based on updateType
  const notesRawValue = body.notesRaw as string | undefined;
  const notesSummaryValue = notesRawValue ? generateSummary(notesRawValue) : undefined;

  const createData: Record<string, unknown> = {
    episodeId,
    clinicId,
    userId,
    updateType,
    painRegion,
    diagnosis,
    treatmentModalities: treatmentModalities ?? "",
    redFlags: redFlags ?? false,
    notes: updateType === "STRUCTURED" ? (notesSummaryValue ?? "") : (notes ?? ""),
  };

  if (updateType === "STRUCTURED") {
    createData.precautions = (body.precautions as string) || null;
    createData.responsePattern = (body.responsePattern as string) || null;
    createData.suggestedNextSteps = (body.suggestedNextSteps as string) || null;
    createData.notesRaw = notesRawValue || null;
    createData.notesSummary = notesSummaryValue || null;
  }

  const clinicalUpdate = await prisma.clinicalUpdate.create({
    data: createData as Parameters<typeof prisma.clinicalUpdate.create>[0]["data"],
  });

  // Apply decay before adding points
  const now = new Date();
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { accessPercent: true, lastDecayAt: true },
  });

  const decayed = applyDecay(
    clinic?.accessPercent ?? 0,
    clinic?.lastDecayAt ?? null,
    now
  );

  // Anti-spam check: count point-earning updates for this patient in last 7 days
  const spamWindowStart = new Date(
    now.getTime() - ANTI_SPAM_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const recentUpdatesForPatient = await prisma.clinicalUpdate.count({
    where: {
      clinicId,
      episode: { patientId: episode.patientId },
      createdAt: { gte: spamWindowStart },
      id: { not: clinicalUpdate.id },
    },
  });

  const earnedPoints = recentUpdatesForPatient < ANTI_SPAM_CAP;
  const pointsForType = updateType === "STRUCTURED" ? POINTS_PER_UPDATE : POINTS_PER_QUICK_HANDOFF;
  const pointsDelta = earnedPoints ? pointsForType : 0;

  // Persist decay first
  if (decayed.accessPercent !== (clinic?.accessPercent ?? 0)) {
    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        accessPercent: decayed.accessPercent,
        lastDecayAt: decayed.lastDecayAt,
      },
    });
  }

  // Award points via ledger if earned
  let newPercent = decayed.accessPercent;
  if (earnedPoints) {
    const reasonCode = updateType === "STRUCTURED"
      ? REASON_CODES.STRUCTURED_UPDATE
      : REASON_CODES.QUICK_HANDOFF;
    const result = await awardPoints(prisma, {
      clinicId,
      delta: pointsForType,
      reasonCode,
      patientId: episode.patientId,
      episodeId,
      updateId: clinicalUpdate.id,
    });
    newPercent = result.newAccessPercent;
  }

  // Update timestamps
  await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      lastContributionAt: now,
      lastDecayAt: now,
    },
  });

  await prisma.simulationEvent.create({
    data: {
      type: "CLINICAL_UPDATE",
      clinicId,
      userId,
      metadata: JSON.stringify({
        clinicalUpdateId: clinicalUpdate.id,
        episodeId,
        updateType,
        pointsEarned: pointsDelta,
        newAccessPercent: newPercent,
      }),
    },
  });

  return NextResponse.json(
    { ...clinicalUpdate, pointsEarned: pointsDelta },
    { status: 201 }
  );
}
