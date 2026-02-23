import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SimulationPanel from "@/components/SimulationPanel";

export const dynamic = "force-dynamic";

export default async function SimulationPage() {
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
        <h1 className="text-2xl font-bold text-[var(--kinetic-dark)]">
          Simulation Console
        </h1>
        <p className="text-sm text-[var(--kinetic-gray)] mt-1">
          Simulate patient transfer scenarios across clinics. Toggle opt-in, create visits, add clinical updates, and check access decisions.
        </p>
      </div>

      <SimulationPanel clinics={clinics} patients={patients} />
    </div>
  );
}
