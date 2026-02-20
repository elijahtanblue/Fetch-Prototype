import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const clinics = await prisma.clinic.findMany({
    select: {
      id: true,
      name: true,
      optedIn: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clinics);
}
