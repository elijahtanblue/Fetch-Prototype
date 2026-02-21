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

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
  }

  const { id } = await params;

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
