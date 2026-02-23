import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  TIER_OVERRIDE_VALUES,
  determineTier,
  type AccessTier,
} from "@/domain/policy/access";
import { awardPoints, REASON_CODES } from "@/domain/services/points";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;

  const { id } = await params;

  // Clinicians can only toggle their own clinic; admins can toggle any
  if (user.role !== "admin" && user.clinicId !== id) {
    return NextResponse.json(
      { error: "Forbidden: you can only toggle your own clinic" },
      { status: 403 }
    );
  }

  const clinic = await prisma.clinic.findUnique({ where: { id } });

  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  const turningOn = !clinic.optedIn;
  const updatedClinic = await prisma.clinic.update({
    where: { id },
    data: {
      optedIn: turningOn,
      ...(turningOn ? { accessPercent: 100, lastDecayAt: new Date() } : {}),
    },
  });

  // Create AccessEvent ledger entry for opt-in bonus
  if (turningOn) {
    const delta = 100 - clinic.accessPercent;
    if (delta > 0) {
      await awardPoints(prisma, {
        clinicId: id,
        delta,
        reasonCode: REASON_CODES.OPT_IN_BONUS,
      });
    }
  }

  await prisma.simulationEvent.create({
    data: {
      type: "TOGGLE_OPT_IN",
      clinicId: id,
      userId: user.id as string,
      metadata: JSON.stringify({
        previousStatus: clinic.optedIn,
        newStatus: updatedClinic.optedIn,
      }),
    },
  });

  return NextResponse.json({
    id: updatedClinic.id,
    name: updatedClinic.name,
    optedIn: updatedClinic.optedIn,
  });
}

// Admin-only: set clinic access tier
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tier = body.tier as string | undefined;
  if (!tier || !["full", "limited", "minimal", "inactive"].includes(tier)) {
    return NextResponse.json(
      { error: "Invalid tier. Must be: full, limited, minimal, or inactive" },
      { status: 400 }
    );
  }

  const clinic = await prisma.clinic.findUnique({ where: { id } });
  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  const newPercent = TIER_OVERRIDE_VALUES[tier as AccessTier];
  const delta = newPercent - clinic.accessPercent;

  const updatedClinic = await prisma.clinic.update({
    where: { id },
    data: {
      accessPercent: newPercent,
      lastDecayAt: new Date(),
    },
  });

  // Log admin override in ledger
  await awardPoints(prisma, {
    clinicId: id,
    delta,
    reasonCode: REASON_CODES.ADMIN_OVERRIDE,
  });

  return NextResponse.json({
    id: updatedClinic.id,
    name: updatedClinic.name,
    accessPercent: updatedClinic.accessPercent,
    tier: determineTier(updatedClinic.accessPercent),
  });
}
