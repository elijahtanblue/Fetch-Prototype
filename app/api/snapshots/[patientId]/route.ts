import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluateAccess } from "@/domain/policy/access";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;
  const clinicId = user.clinicId as string;
  const { patientId } = await params;

  // Fetch clinic data for policy evaluation
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { optedIn: true, lastContributionAt: true },
  });

  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  // Fetch snapshot data: clinical updates from OTHER clinics for this patient
  const sharedUpdates = await prisma.clinicalUpdate.findMany({
    where: {
      episode: { patientId },
      clinicId: { not: clinicId },
    },
    include: {
      episode: {
        select: { reason: true, startDate: true },
      },
      clinic: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const hasSnapshot = sharedUpdates.length > 0;

  // Route ALL access decisions through the canonical policy module
  const decision = evaluateAccess({
    optedIn: clinic.optedIn,
    lastContributionAt: clinic.lastContributionAt,
    now: new Date(),
    hasSnapshot,
  });

  if (!decision.allowed) {
    return NextResponse.json({
      accessDecision: "denied",
      reasonCode: decision.reasonCode,
      explanation: decision.explanation,
    });
  }

  // Build snapshot from shared clinical updates
  const snapshot = sharedUpdates.map((update) => ({
    id: update.id,
    clinicName: update.clinic.name,
    episodeReason: update.episode.reason,
    episodeStartDate: update.episode.startDate,
    painRegion: update.painRegion,
    diagnosis: update.diagnosis,
    treatmentModalities: update.treatmentModalities,
    redFlags: update.redFlags,
    notes: update.notes,
    createdAt: update.createdAt,
  }));

  return NextResponse.json({
    accessDecision: "allowed",
    snapshot,
  });
}
