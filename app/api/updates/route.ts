import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  await prisma.clinic.update({
    where: { id: clinicId },
    data: { lastContributionAt: new Date() },
  });

  await prisma.simulationEvent.create({
    data: {
      type: "CLINICAL_UPDATE",
      clinicId,
      userId,
      metadata: JSON.stringify({
        clinicalUpdateId: clinicalUpdate.id,
        episodeId,
      }),
    },
  });

  return NextResponse.json(clinicalUpdate, { status: 201 });
}
