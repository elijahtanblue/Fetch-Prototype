import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSummary } from "@/domain/services/summarizer";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/updates/[id] — Edit a clinical update.
 * Only the clinician who created it (same clinic) can edit.
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

  const existing = await prisma.clinicalUpdate.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  // Only the creating clinic can edit
  if (existing.clinicId !== (user.clinicId as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  // Editable fields
  const editableStrings = ["painRegion", "diagnosis", "treatmentModalities", "precautions", "responsePattern", "suggestedNextSteps"];
  for (const field of editableStrings) {
    if (field in body) {
      updateData[field] = body[field] ?? null;
    }
  }

  if ("redFlags" in body) {
    updateData.redFlags = Boolean(body.redFlags);
  }

  if ("notesRaw" in body) {
    const newNotesRaw = body.notesRaw as string | null;
    updateData.notesRaw = newNotesRaw || null;
    const newSummary = newNotesRaw ? generateSummary(newNotesRaw) : null;
    updateData.notesSummary = newSummary;
    updateData.notes = newSummary ?? "";
  }

  if ("dateOfVisit" in body) {
    updateData.dateOfVisit = body.dateOfVisit ? new Date(body.dateOfVisit as string) : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.clinicalUpdate.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/updates/[id] — Delete a clinical update.
 * Only the creating clinic can delete. Admins can also delete.
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

  const existing = await prisma.clinicalUpdate.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  // Only creating clinic or admin can delete
  if (existing.clinicId !== (user.clinicId as string) && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.clinicalUpdate.delete({ where: { id } });

  return NextResponse.json({ success: true, id });
}
