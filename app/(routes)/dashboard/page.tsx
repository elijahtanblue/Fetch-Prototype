import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { determineTier } from "@/domain/policy/access";
import ClinicOptInToggle from "@/components/ClinicOptInToggle";
import ConsentToggle from "@/components/ConsentToggle";
import EpisodesSection from "@/components/EpisodesSection";
import CreatePatientForm from "@/components/CreatePatientForm";
import PatientManagement from "@/components/PatientManagement";

export const dynamic = "force-dynamic";

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  full: { bg: "bg-green-100", text: "text-green-800", label: "Full Access" },
  limited: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Limited" },
  minimal: { bg: "bg-orange-100", text: "text-orange-800", label: "Minimal" },
  inactive: { bg: "bg-red-100", text: "text-red-800", label: "Inactive" },
};

async function getClinics() {
  return prisma.clinic.findMany({
    select: {
      id: true,
      name: true,
      optedIn: true,
      accessPercent: true,
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        consentStatus: true,
        treatmentCompletedAt: true,
        _count: { select: { episodes: true } },
      },
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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--kinetic-dark)]">
            Shared Patient History
          </h1>
          <p className="text-sm text-[var(--kinetic-gray)] mt-1">
            Access shared patient history by contributing updates.
          </p>
        </div>
        <CreatePatientForm />
      </div>

      {/* Access Progress Bar */}
      {(() => {
        const myClinic = clinics.find((c) => c.id === clinicId);
        if (!myClinic) return null;
        const tier = determineTier(myClinic.accessPercent);
        const style = TIER_STYLES[tier];
        const barColor = tier === "full" ? "bg-green-500" : tier === "limited" ? "bg-yellow-500" : tier === "minimal" ? "bg-orange-500" : "bg-red-400";
        return (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6" data-testid="access-progress-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">Your Access Level</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`} data-testid="tier-label">
                  {style.label}
                </span>
              </div>
              <span className="text-sm font-medium text-[var(--kinetic-dark)]" data-testid="access-percent">{myClinic.accessPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5" data-testid="progress-bar">
              <div className={`${barColor} h-2.5 rounded-full transition-all`} style={{ width: `${myClinic.accessPercent}%` }}></div>
            </div>
            <p className="text-xs text-[var(--kinetic-gray)] mt-2">
              Access decays 1% per day. Earn points by contributing clinical updates.
            </p>
          </div>
        );
      })()}

      {/* Patient Visits Section */}
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
              <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
                Access Tier
              </th>
            </tr>
          </thead>
          <tbody>
            {clinics.map((clinic) => {
              const tier = determineTier(clinic.accessPercent);
              const style = TIER_STYLES[tier];
              return (
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
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {clinic.accessPercent}%
                    </span>
                  </td>
                </tr>
              );
            })}
            {clinics.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-sm text-center text-[var(--kinetic-gray)]"
                >
                  No clinics found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Patient Management (admin only) */}
      {isAdmin && (
        <PatientManagement
          patients={patients.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            phoneNumber: p.phoneNumber,
            treatmentCompletedAt: p.treatmentCompletedAt?.toISOString() ?? null,
            episodeCount: p._count.episodes,
          }))}
        />
      )}

      {/* Patient Consent (admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-6">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">
              Patient Consent
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
                  Patient Name
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
                  Sharing Status
                </th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} className="border-b border-gray-50 last:border-b-0">
                  <td className="px-4 py-3 text-sm text-[var(--kinetic-dark)]">
                    {patient.firstName} {patient.lastName}
                  </td>
                  <td className="px-4 py-3">
                    <ConsentToggle
                      patientId={patient.id}
                      patientName={`${patient.firstName} ${patient.lastName}`}
                      initialConsent={patient.consentStatus}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
