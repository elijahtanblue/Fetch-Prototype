import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { simulateVisit } from "@/domain/services/simulation";

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
  if (!body.clinicId || !body.patientId || !body.reason) {
    return NextResponse.json(
      { error: "clinicId, patientId, and reason are required" },
      { status: 400 }
    );
  }

  const clinicUser = await prisma.user.findFirst({ where: { clinicId: body.clinicId } });
  const userId = clinicUser?.id ?? (user.id as string);

  const result = await simulateVisit({ prisma }, {
    clinicId: body.clinicId,
    userId,
    patientId: body.patientId,
    reason: body.reason,
  });
  return NextResponse.json(result);
}
