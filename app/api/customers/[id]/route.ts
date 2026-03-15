import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/customers/[id] — Remove a customer (guarded by FK constraints).
 * Vets can delete customers at their own clinic; admins can delete any.
 * Only allows deletion if the patient has no episodes (no clinical data loss).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;
  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: { _count: { select: { episodes: true } } },
  });

  if (!patient) {
    return NextResponse.json({ error: "Pet not found" }, { status: 404 });
  }

  // Clinicians can only delete patients at their own clinic
  if (user.role !== "admin" && patient.clinicId !== user.clinicId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (patient._count.episodes > 0) {
    return NextResponse.json(
      { error: "Cannot remove pet with existing visits. Remove visits first." },
      { status: 409 }
    );
  }

  await prisma.patient.delete({ where: { id } });

  return NextResponse.json({ success: true, id });
}

/**
 * PATCH /api/customers/[id] — Update customer fields (treatmentCompletedAt).
 * Vets can update customers at their own clinic; admins can update any.
 */
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

  const patient = await prisma.patient.findUnique({ where: { id } });

  if (!patient) {
    return NextResponse.json({ error: "Pet not found" }, { status: 404 });
  }

  // Clinicians can only update patients at their own clinic
  if (user.role !== "admin" && patient.clinicId !== user.clinicId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if ("treatmentCompletedAt" in body) {
    updateData.treatmentCompletedAt = body.treatmentCompletedAt
      ? new Date(body.treatmentCompletedAt as string)
      : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.patient.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}
