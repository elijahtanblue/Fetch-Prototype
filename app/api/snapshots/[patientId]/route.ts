import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  evaluateAccess,
  applyDecay,
  filterSnapshotByTier,
  type SnapshotEntry,
} from "@/domain/policy/access";
import { getSharedUpdatesForPatient } from "@/domain/services/snapshot";

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

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { optedIn: true, accessPercent: true, lastDecayAt: true },
  });

  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  // Apply time decay on-request
  const now = new Date();
  const decayed = applyDecay(clinic.accessPercent, clinic.lastDecayAt, now);

  // Persist decay if it changed, and log to ledger
  const decayDelta = decayed.accessPercent - clinic.accessPercent;
  if (
    decayed.accessPercent !== clinic.accessPercent ||
    decayed.lastDecayAt !== clinic.lastDecayAt
  ) {
    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        accessPercent: decayed.accessPercent,
        lastDecayAt: decayed.lastDecayAt,
      },
    });

    if (decayDelta !== 0) {
      await prisma.accessEvent.create({
        data: {
          clinicId,
          delta: decayDelta,
          reasonCode: "DECAY",
        },
      });
    }
  }

  // Fetch snapshot data (respects patient consent)
  const { updates: sharedUpdates, consentOptedOut } = await getSharedUpdatesForPatient(
    prisma,
    patientId,
    clinicId
  );

  // If patient opted out, return early with consent message
  if (consentOptedOut) {
    return NextResponse.json({
      accessDecision: "denied",
      reasonCode: "PATIENT_OPTED_OUT",
      consentOptedOut: true,
      explanation: "This patient has opted out of sharing their history with other clinics.",
    });
  }

  const hasSnapshot = sharedUpdates.length > 0;

  // Route through canonical policy module
  const decision = evaluateAccess({
    optedIn: clinic.optedIn,
    accessPercent: decayed.accessPercent,
    hasSnapshot,
  });

  if (!decision.allowed) {
    return NextResponse.json({
      accessDecision: "denied",
      tier: decision.tier,
      accessPercent: decision.accessPercent,
      reasonCode: decision.reasonCode,
      explanation: decision.explanation,
    });
  }

  // Filter snapshot fields based on tier (server-enforced)
  const filteredSnapshot = filterSnapshotByTier(
    sharedUpdates as SnapshotEntry[],
    decision.tier!
  );

  return NextResponse.json({
    accessDecision: "allowed",
    tier: decision.tier,
    accessPercent: decision.accessPercent,
    snapshot: filteredSnapshot,
  });
}
