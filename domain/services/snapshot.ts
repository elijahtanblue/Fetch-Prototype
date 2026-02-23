/**
 * Snapshot query service.
 *
 * Extracts the "shared updates from other clinics" query pattern
 * so it can be reused by both the snapshot endpoint and simulation.
 *
 * Respects patient consent: if patient has opted out (consentStatus = "OPT_OUT"),
 * no shared updates are returned to other clinics. The patient's own clinic
 * (excludeClinicId) is already excluded, so this only blocks external viewers.
 *
 * PRIVACY: notesRaw is NEVER included in SharedUpdate. This is the firewall
 * ensuring raw clinical notes never leave the documenting clinic.
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
  updateType: string;
  precautions: string | null;
  responsePattern: string | null;
  suggestedNextSteps: string | null;
  notesSummary: string | null;
  createdAt: Date;
  // notesRaw is intentionally NEVER included
}

export interface SharedUpdatesResult {
  updates: SharedUpdate[];
  consentOptedOut: boolean;
}

export async function getSharedUpdatesForPatient(
  prisma: PrismaClient,
  patientId: string,
  excludeClinicId: string
): Promise<SharedUpdatesResult> {
  // Check patient consent
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { consentStatus: true },
  });

  if (patient?.consentStatus === "OPT_OUT") {
    return { updates: [], consentOptedOut: true };
  }

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

  return {
    updates: updates.map((u) => ({
      id: u.id,
      clinicName: u.clinic.name,
      episodeReason: u.episode.reason,
      episodeStartDate: u.episode.startDate,
      painRegion: u.painRegion,
      diagnosis: u.diagnosis,
      treatmentModalities: u.treatmentModalities,
      redFlags: u.redFlags,
      notes: u.notes,
      updateType: u.updateType ?? "STRUCTURED",
      precautions: u.precautions ?? null,
      responsePattern: u.responsePattern ?? null,
      suggestedNextSteps: u.suggestedNextSteps ?? null,
      notesSummary: u.notesSummary ?? null,
      createdAt: u.createdAt,
    })),
    consentOptedOut: false,
  };
}
