import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { simulateUpdate } from "@/domain/services/simulation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as unknown as Record<string, unknown>;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.clinicId || !body.episodeId || !body.painRegion || !body.diagnosis || !body.treatmentModalities) {
    return NextResponse.json(
      { error: "clinicId, episodeId, painRegion, diagnosis, and treatmentModalities are required" },
      { status: 400 }
    );
  }

  const clinicUser = await prisma.user.findFirst({ where: { clinicId: body.clinicId } });
  const userId = clinicUser?.id ?? (user.id as string);

  const result = await simulateUpdate({ prisma }, {
    clinicId: body.clinicId,
    userId,
    episodeId: body.episodeId,
    painRegion: body.painRegion,
    diagnosis: body.diagnosis,
    treatmentModalities: body.treatmentModalities,
    redFlags: body.redFlags,
    notes: body.notes,
  });
  return NextResponse.json(result);
}
