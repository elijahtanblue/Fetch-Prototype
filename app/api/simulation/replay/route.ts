import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { replayEvents } from "@/domain/services/simulation";

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
  if (!body.viewerClinicId || !body.patientId) {
    return NextResponse.json(
      { error: "viewerClinicId and patientId are required" },
      { status: 400 }
    );
  }

  const events = await prisma.simulationEvent.findMany({
    orderBy: { createdAt: "asc" },
  });

  const results = await replayEvents(
    { prisma },
    events,
    { viewerClinicId: body.viewerClinicId, patientId: body.patientId }
  );

  return NextResponse.json(results);
}
