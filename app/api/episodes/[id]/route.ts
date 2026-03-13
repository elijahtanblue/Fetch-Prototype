import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/episodes/[id] — Remove a pet visit and its clinical updates.
 * Clinicians can delete episodes at their own clinic; admins can delete any.
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

  const episode = await prisma.episode.findUnique({
    where: { id },
    include: { _count: { select: { clinicalUpdates: true } } },
  });

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  // Clinicians can only delete episodes at their own clinic
  if (user.role !== "admin" && episode.clinicId !== user.clinicId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cascade: delete clinical updates first, then episode
  await prisma.clinicalUpdate.deleteMany({ where: { episodeId: id } });
  await prisma.episode.delete({ where: { id } });

  return NextResponse.json({ success: true, id });
}
