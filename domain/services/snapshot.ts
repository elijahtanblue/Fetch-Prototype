/**
 * Snapshot query service.
 *
 * Extracts the "shared updates from other clinics" query pattern
 * so it can be reused by both the snapshot endpoint and simulation.
 */

import type { PrismaClient } from "@/lib/generated/prisma/client";

export interface SharedUpdate {
  id: string;
  clinicName: string;
  episodeReason: string;
  episodeStartDate: Date;
  painRegion: string;
  diagnosis: string;
  treatmentModalities: string;
  redFlags: boolean;
  notes: string;
  createdAt: Date;
}

export async function getSharedUpdatesForPatient(
  prisma: PrismaClient,
  patientId: string,
  excludeClinicId: string
): Promise<SharedUpdate[]> {
  const updates = await prisma.clinicalUpdate.findMany({
    where: {
      episode: { patientId },
      clinicId: { not: excludeClinicId },
    },
    include: {
      episode: {
        select: { reason: true, startDate: true },
      },
      clinic: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return updates.map((u) => ({
    id: u.id,
    clinicName: u.clinic.name,
    episodeReason: u.episode.reason,
    episodeStartDate: u.episode.startDate,
    painRegion: u.painRegion,
    diagnosis: u.diagnosis,
    treatmentModalities: u.treatmentModalities,
    redFlags: u.redFlags,
    notes: u.notes,
    createdAt: u.createdAt,
  }));
}
