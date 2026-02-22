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

  const { patientId, reason, startDate } = body as {
    patientId?: string;
    reason?: string;
    startDate?: string;
  };

  if (!patientId || !reason || !startDate) {
    return NextResponse.json(
      { error: "Missing required fields: patientId, reason, startDate" },
      { status: 400 }
    );
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const episode = await prisma.episode.create({
    data: {
      patientId,
      clinicId: user.clinicId as string,
      userId: user.id as string,
      reason,
      startDate: new Date(startDate),
    },
  });

  await prisma.simulationEvent.create({
    data: {
      type: "VISIT",
      clinicId: user.clinicId as string,
      userId: user.id as string,
      metadata: JSON.stringify({
        episodeId: episode.id,
        patientId,
      }),
    },
  });

  return NextResponse.json(episode, { status: 201 });
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as unknown as Record<string, unknown>;

  const episodes = await prisma.episode.findMany({
    where: { clinicId: user.clinicId as string },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      clinicalUpdates: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(episodes);
}
