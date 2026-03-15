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
    select: { id: true, firstName: true, lastName: true, petName: true },
    orderBy: { lastName: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--fetch-dark)]">
          Insurance Eligibility Check
        </h1>
        <p className="text-sm text-[var(--fetch-gray)] mt-1">
          Look up a customer&apos;s vet history to verify pet records before processing an insurance application.
        </p>
      </div>

      {/* Pet name search — lets Fetch staff filter by pet name */}
      <div className="mb-4">
        <label htmlFor="pet-search" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">
          Search by customer or pet name
        </label>
        <input
          id="pet-search"
          type="text"
          placeholder="e.g. Smith or Buddy"
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)]"
          data-testid="pet-search-input"
        />
      </div>

      <SimulationPanel clinics={clinics} patients={patients} />
    </div>
  );
}
