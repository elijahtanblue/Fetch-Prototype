import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SimulationPanel from "@/components/SimulationPanel";

export const dynamic = "force-dynamic";

export default async function CheckAccessPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as unknown as Record<string, unknown>;

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const clinics = await prisma.clinic.findMany({
    select: { id: true, name: true, optedIn: true },
    orderBy: { name: "asc" },
  });

  const patients = await prisma.patient.findMany({
    select: { id: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--fetch-dark)]">
          Check Access Console
        </h1>
        <p className="text-sm text-[var(--fetch-gray)] mt-1">
          Check access decisions across clinics, review event history, and replay access audit timelines.
        </p>
      </div>

      <SimulationPanel clinics={clinics} patients={patients} />
    </div>
  );
}
