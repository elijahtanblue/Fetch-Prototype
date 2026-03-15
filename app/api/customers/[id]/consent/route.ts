import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_CONSENT_VALUES = ["SHARE", "OPT_OUT"] as const;

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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const consentStatus = body.consentStatus as string | undefined;
  if (!consentStatus || !VALID_CONSENT_VALUES.includes(consentStatus as typeof VALID_CONSENT_VALUES[number])) {
    return NextResponse.json(
      { error: "Invalid consentStatus. Must be: SHARE or OPT_OUT" },
      { status: 400 }
    );
  }

  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) {
    return NextResponse.json({ error: "Pet not found" }, { status: 404 });
  }

  // Clinicians can only update consent for patients at their own clinic
  if (user.role !== "admin" && patient.clinicId !== user.clinicId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.patient.update({
    where: { id },
    data: {
      consentStatus,
      consentUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({
    id: updated.id,
    firstName: updated.firstName,
    lastName: updated.lastName,
    consentStatus: updated.consentStatus,
    consentUpdatedAt: updated.consentUpdatedAt,
  });
}
