import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import ClinicOptInToggle from "@/components/ClinicOptInToggle";
import EpisodesSection from "@/components/EpisodesSection";

export const dynamic = "force-dynamic";

async function getClinics() {
  return prisma.clinic.findMany({
    select: {
      id: true,
      name: true,
      optedIn: true,
    },
    orderBy: { name: "asc" },
  });
}

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as unknown as Record<string, unknown>;
  const clinicId = user?.clinicId as string;
  const isAdmin = user?.role === "admin";

  const [clinics, patients, episodes] = await Promise.all([
    getClinics(),
    prisma.patient.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.episode.findMany({
      where: { clinicId },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        clinicalUpdates: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Serialize dates for client component
  const serializedEpisodes = episodes.map((ep) => ({
    ...ep,
    startDate: ep.startDate.toISOString(),
    createdAt: ep.createdAt.toISOString(),
    clinicalUpdates: ep.clinicalUpdates.map((cu) => ({
      ...cu,
      createdAt: cu.createdAt.toISOString(),
    })),
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--kinetic-dark)]">
          Shared Patient History
        </h1>
        <p className="text-sm text-[var(--kinetic-gray)] mt-1">
          Access shared patient history by contributing updates.
        </p>
      </div>

      {/* Contribute Banner */}
      <div className="bg-[var(--kinetic-gold-light)] border border-[var(--kinetic-gold)] rounded-lg p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="font-medium text-[var(--kinetic-dark)] text-sm">
            Contribute Updates to Unlock Patient History
          </p>
          <p className="text-xs text-[var(--kinetic-gray)] mt-0.5">
            Privileges earned through sharing structured patient summaries.
          </p>
        </div>
      </div>

      {/* Episodes Section */}
      <div className="mb-6">
        <EpisodesSection
          initialEpisodes={serializedEpisodes}
          patients={patients}
        />
      </div>

      {/* Clinics Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">
            Clinics
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
                Clinic Name
              </th>
              <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
                Opt-in Status
              </th>
            </tr>
          </thead>
          <tbody>
            {clinics.map((clinic) => (
              <tr
                key={clinic.id}
                className="border-b border-gray-50 last:border-b-0"
              >
                <td className="px-4 py-3 text-sm text-[var(--kinetic-dark)]">
                  {clinic.name}
                </td>
                <td className="px-4 py-3">
                  {isAdmin || clinic.id === clinicId ? (
                    <ClinicOptInToggle
                      clinicId={clinic.id}
                      initialOptedIn={clinic.optedIn}
                    />
                  ) : (
                    <span
                      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium w-24 ${
                        clinic.optedIn
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {clinic.optedIn ? "Opted In" : "Not Opted In"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {clinics.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-6 text-sm text-center text-[var(--kinetic-gray)]"
                >
                  No clinics found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
