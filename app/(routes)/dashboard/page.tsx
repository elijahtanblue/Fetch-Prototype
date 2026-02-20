import { prisma } from "@/lib/db";

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
  const clinics = await getClinics();

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
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      clinic.optedIn
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {clinic.optedIn ? "Opted In" : "Not Opted In"}
                  </span>
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
