import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { evaluateAccessForClinic } from "@/domain/services/simulation";

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
  if (!body.clinicId || !body.patientId) {
    return NextResponse.json(
      { error: "clinicId and patientId are required" },
      { status: 400 }
    );
  }

  const decision = await evaluateAccessForClinic({ prisma }, {
    clinicId: body.clinicId,
    patientId: body.patientId,
  });
  return NextResponse.json(decision);
}
