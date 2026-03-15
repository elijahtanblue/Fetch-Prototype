import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import RecordsTable from "@/components/RecordsTable";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [clinics, rawPatients] = await Promise.all([
    prisma.clinic.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.patient.findMany({
      where: { episodes: { some: {} } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        address: true,
        insuranceCommencementDate: true,
        petName: true,
        petBreed: true,
        petType: true,
        petGender: true,
        petDesexed: true,
        petDateOfBirth: true,
        episodes: {
          orderBy: { startDate: "desc" },
          take: 1,
          select: {
            startDate: true,
            reason: true,
            clinic: { select: { name: true } },
            clinicalUpdates: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                diagnosis: true,
                painRegion: true,
                treatmentModalities: true,
                redFlags: true,
                dateOfVisit: true,
              },
            },
          },
        },
      },
      orderBy: { lastName: "asc" },
    }),
  ]);

  // Serialise DateTime fields — Next.js cannot pass Date objects to client components
  const patients = rawPatients.map((p) => ({
    ...p,
    dateOfBirth: p.dateOfBirth.toISOString(),
    insuranceCommencementDate: p.insuranceCommencementDate?.toISOString() ?? null,
    petDateOfBirth: p.petDateOfBirth?.toISOString() ?? null,
    episodes: p.episodes.map((ep) => ({
      ...ep,
      startDate: ep.startDate.toISOString(),
      clinicalUpdates: ep.clinicalUpdates.map((cu) => ({
        ...cu,
        dateOfVisit: cu.dateOfVisit?.toISOString() ?? null,
      })),
    })),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--fetch-dark)]">
          Vet Records
        </h1>
        <p className="text-sm text-[var(--fetch-gray)] mt-1">
          Verify that customers are currently visiting a vet clinic covered under Fetch&apos;s insurance policy.
        </p>
      </div>
      <RecordsTable patients={patients} clinics={clinics} />
    </div>
  );
}
