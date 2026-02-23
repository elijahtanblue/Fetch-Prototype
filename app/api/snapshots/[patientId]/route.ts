import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluateAccess } from "@/domain/policy/access";
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

  // Fetch clinic data for policy evaluation
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { optedIn: true, lastContributionAt: true },
  });

  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  // Fetch snapshot data via shared service
  const sharedUpdates = await getSharedUpdatesForPatient(
    prisma,
    patientId,
    clinicId
  );

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

  return NextResponse.json({
    accessDecision: "allowed",
    snapshot: sharedUpdates,
  });
}
