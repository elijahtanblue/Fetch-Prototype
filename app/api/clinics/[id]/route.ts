import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

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

  // Clinicians can only toggle their own clinic; admins can toggle any
  if (user.role !== "admin" && user.clinicId !== id) {
    return NextResponse.json(
      { error: "Forbidden: you can only toggle your own clinic" },
      { status: 403 }
    );
  }

  const clinic = await prisma.clinic.findUnique({ where: { id } });

  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  const updatedClinic = await prisma.clinic.update({
    where: { id },
    data: { optedIn: !clinic.optedIn },
  });

  await prisma.simulationEvent.create({
    data: {
      type: "TOGGLE_OPT_IN",
      clinicId: id,
      userId: user.id as string,
      metadata: JSON.stringify({
        previousStatus: clinic.optedIn,
        newStatus: updatedClinic.optedIn,
      }),
    },
  });

  return NextResponse.json({
    id: updatedClinic.id,
    name: updatedClinic.name,
    optedIn: updatedClinic.optedIn,
  });
}
