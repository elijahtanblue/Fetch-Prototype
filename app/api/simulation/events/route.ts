import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as unknown as Record<string, unknown>;
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const events = await prisma.simulationEvent.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      clinic: { select: { name: true } },
      user: { select: { name: true } },
    },
  });

  return NextResponse.json(events);
}
