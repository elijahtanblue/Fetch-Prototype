"use client";

import { useState } from "react";
import CreateEpisodeForm from "./CreateEpisodeForm";
import AddUpdateForm from "./AddUpdateForm";
import PatientSnapshot from "./PatientSnapshot";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface ClinicalUpdate {
  id: string;
  painRegion: string;
  diagnosis: string;
  treatmentModalities: string;
  redFlags: boolean;
  notes: string;
  updateType?: string;
  precautions?: string | null;
  responsePattern?: string | null;
  suggestedNextSteps?: string | null;
  notesSummary?: string | null;
  createdAt: string;
}

interface Episode {
  id: string;
  patientId: string;
  reason: string;
  startDate: string;
  createdAt: string;
  patient: { firstName: string; lastName: string };
  clinicalUpdates: ClinicalUpdate[];
}

interface EpisodesSectionProps {
  initialEpisodes: Episode[];
  patients: Patient[];
}

export default function EpisodesSection({
  initialEpisodes,
  patients,
}: EpisodesSectionProps) {
  const [episodes, setEpisodes] = useState<Episode[]>(initialEpisodes);

  function handleEpisodeCreated(episode: { id: string; reason: string; startDate: string }) {
    // Find the patient to display name — refresh from server for full data
    refreshEpisodes();
    void episode; // used indirectly via refresh
  }

  async function refreshEpisodes() {
    const res = await fetch("/api/episodes");
    if (res.ok) {
      const data = await res.json();
      setEpisodes(data);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">
          Episodes
        </h2>
        <CreateEpisodeForm patients={patients} onCreated={handleEpisodeCreated} />
      </div>

      {episodes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-6 text-center">
          <p className="text-sm text-[var(--kinetic-gray)]">
            No episodes yet. Create one to start contributing updates.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {episodes.map((episode) => (
            <div
              key={episode.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--kinetic-dark)]">
                    {episode.patient.firstName} {episode.patient.lastName}
                  </p>
                  <p className="text-xs text-[var(--kinetic-gray)] mt-0.5">
                    {episode.reason}
                  </p>
                  <p className="text-xs text-[var(--kinetic-gray)]">
                    Started: {new Date(episode.startDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-[var(--kinetic-gray)]">
                  {episode.clinicalUpdates.length} update{episode.clinicalUpdates.length !== 1 ? "s" : ""}
                </span>
              </div>

              {episode.clinicalUpdates.length > 0 && (
                <div className="mt-3 space-y-2">
                  {episode.clinicalUpdates.map((update) => (
                    <div
                      key={update.id}
                      className="bg-gray-50 rounded p-2 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[var(--kinetic-dark)]">
                          {update.painRegion}
                        </span>
                        <span className="text-[var(--kinetic-gray)]">|</span>
                        <span className="text-[var(--kinetic-gray)]">
                          {update.diagnosis}
                        </span>
                        {update.redFlags && (
                          <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-medium">
                            Red Flag
                          </span>
                        )}
                        {update.updateType === "QUICK_HANDOFF" && (
                          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-medium">
                            Quick
                          </span>
                        )}
                      </div>
                      {update.treatmentModalities && (
                        <p className="text-[var(--kinetic-gray)] mt-1">
                          Treatment: {update.treatmentModalities}
                        </p>
                      )}
                      {update.updateType !== "QUICK_HANDOFF" && update.precautions && (
                        <p className="text-[var(--kinetic-gray)] mt-0.5">
                          Precautions: {update.precautions}
                        </p>
                      )}
                      {update.updateType !== "QUICK_HANDOFF" && update.responsePattern && (
                        <p className="text-[var(--kinetic-gray)] mt-0.5">
                          Response: {update.responsePattern}
                        </p>
                      )}
                      {update.updateType !== "QUICK_HANDOFF" && update.suggestedNextSteps && (
                        <p className="text-[var(--kinetic-gray)] mt-0.5">
                          Next Steps: {update.suggestedNextSteps}
                        </p>
                      )}
                      {update.notesSummary && (
                        <p className="text-[var(--kinetic-gray)] mt-0.5 italic">
                          Summary: {update.notesSummary}
                        </p>
                      )}
                      {update.notes && !update.notesSummary && (
                        <p className="text-[var(--kinetic-gray)] mt-0.5 italic">
                          {update.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <AddUpdateForm
                episodeId={episode.id}
                onCreated={refreshEpisodes}
              />

              <PatientSnapshot
                patientId={episode.patientId}
                patientName={`${episode.patient.firstName} ${episode.patient.lastName}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
