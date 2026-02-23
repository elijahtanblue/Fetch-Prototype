import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  POINTS_PER_UPDATE,
  ANTI_SPAM_CAP,
  ANTI_SPAM_WINDOW_DAYS,
  addPoints,
  applyDecay,
} from "@/domain/policy/access";

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

  const { episodeId, painRegion, diagnosis, treatmentModalities, redFlags, notes } = body as {
    episodeId?: string;
    painRegion?: string;
    diagnosis?: string;
    treatmentModalities?: string;
    redFlags?: boolean;
    notes?: string;
  };

  if (!episodeId || !painRegion || !diagnosis || !treatmentModalities) {
    return NextResponse.json(
      { error: "Missing required fields: episodeId, painRegion, diagnosis, treatmentModalities" },
      { status: 400 }
    );
  }

  const episode = await prisma.episode.findUnique({ where: { id: episodeId } });

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  const clinicId = user.clinicId as string;
  const userId = user.id as string;

  const clinicalUpdate = await prisma.clinicalUpdate.create({
    data: {
      episodeId,
      clinicId,
      userId,
      painRegion,
      diagnosis,
      treatmentModalities,
      redFlags: redFlags ?? false,
      notes: notes ?? "",
    },
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
      id: { not: clinicalUpdate.id }, // exclude current update
    },
  });

  const earnedPoints = recentUpdatesForPatient < ANTI_SPAM_CAP;
  const newPercent = earnedPoints
    ? addPoints(decayed.accessPercent, POINTS_PER_UPDATE)
    : decayed.accessPercent;

  await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      lastContributionAt: now,
      accessPercent: newPercent,
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
        pointsEarned: earnedPoints ? POINTS_PER_UPDATE : 0,
        newAccessPercent: newPercent,
      }),
    },
  });

  return NextResponse.json(
    { ...clinicalUpdate, pointsEarned: earnedPoints ? POINTS_PER_UPDATE : 0 },
    { status: 201 }
  );
}
