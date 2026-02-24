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
  dateOfVisit?: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteEpisodeConfirmId, setDeleteEpisodeConfirmId] = useState<string | null>(null);

  function handleEpisodeCreated(episode: { id: string; reason: string; startDate: string }) {
    refreshEpisodes();
    void episode;
  }

  async function refreshEpisodes() {
    const res = await fetch("/api/episodes");
    if (res.ok) {
      const data = await res.json();
      setEpisodes(data);
    }
  }

  async function handleDeleteEpisode(episodeId: string) {
    const res = await fetch(`/api/episodes/${episodeId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteEpisodeConfirmId(null);
      setEpisodes((prev) => prev.filter((ep) => ep.id !== episodeId));
    }
  }

  async function handleDeleteUpdate(updateId: string) {
    const res = await fetch(`/api/updates/${updateId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteConfirmId(null);
      refreshEpisodes();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">
          Patient Visits
        </h2>
        <CreateEpisodeForm patients={patients} onCreated={handleEpisodeCreated} />
      </div>

      {episodes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-6 text-center">
          <p className="text-sm text-[var(--kinetic-gray)]">
            No patient visits yet. Add one to start contributing updates.
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
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--kinetic-gray)]">
                    {episode.clinicalUpdates.length} update{episode.clinicalUpdates.length !== 1 ? "s" : ""}
                  </span>
                  {deleteEpisodeConfirmId === episode.id ? (
                    <span className="flex items-center gap-1">
                      <span className="text-xs text-red-600">Remove visit?</span>
                      <button
                        onClick={() => handleDeleteEpisode(episode.id)}
                        data-testid={`confirm-delete-episode-${episode.id}`}
                        className="text-xs text-red-600 font-medium hover:text-red-800"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeleteEpisodeConfirmId(null)}
                        className="text-xs text-[var(--kinetic-gray)]"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setDeleteEpisodeConfirmId(episode.id)}
                      data-testid={`delete-episode-${episode.id}`}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {episode.clinicalUpdates.length > 0 && (
                <div className="mt-3 space-y-2">
                  {episode.clinicalUpdates.map((update) => (
                    <div
                      key={update.id}
                      className="bg-gray-50 rounded p-2 text-xs"
                      data-testid={`update-card-${update.id}`}
                    >
                      {editingId === update.id ? (
                        <EditUpdateInline
                          update={update}
                          onSaved={() => { setEditingId(null); refreshEpisodes(); }}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[var(--kinetic-dark)]">
                              {update.painRegion}
                            </span>
                            <span className="text-[var(--kinetic-gray)]">|</span>
                            <span className="text-[var(--kinetic-gray)]">
                              {update.diagnosis}
                            </span>
                            {update.redFlags && (
                              <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-medium" data-testid={`red-flag-${update.id}`}>
                                {"\u{1F6A9}"} Red Flag
                              </span>
                            )}
                            {update.updateType === "QUICK_HANDOFF" && (
                              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-medium">
                                Quick
                              </span>
                            )}
                            {update.dateOfVisit && (
                              <span className="text-[var(--kinetic-gray)]" data-testid={`visit-date-${update.id}`}>
                                Visit: {new Date(update.dateOfVisit).toLocaleDateString()}
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
                          <div className="flex items-center gap-2 mt-1.5">
                            <button
                              onClick={() => setEditingId(update.id)}
                              data-testid={`edit-update-${update.id}`}
                              className="text-xs text-[var(--kinetic-gold)] hover:underline"
                            >
                              Edit
                            </button>
                            {deleteConfirmId === update.id ? (
                              <span className="flex items-center gap-1">
                                <span className="text-xs text-red-600">Delete?</span>
                                <button
                                  onClick={() => handleDeleteUpdate(update.id)}
                                  data-testid={`confirm-delete-update-${update.id}`}
                                  className="text-xs text-red-600 font-medium hover:text-red-800"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-xs text-[var(--kinetic-gray)]"
                                >
                                  No
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(update.id)}
                                data-testid={`delete-update-${update.id}`}
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </>
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

// Inline edit form for updates
function EditUpdateInline({
  update,
  onSaved,
  onCancel,
}: {
  update: ClinicalUpdate;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [painRegion, setPainRegion] = useState(update.painRegion);
  const [diagnosis, setDiagnosis] = useState(update.diagnosis);
  const [treatmentModalities, setTreatmentModalities] = useState(update.treatmentModalities);
  const [dateOfVisit, setDateOfVisit] = useState(
    update.dateOfVisit ? update.dateOfVisit.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/updates/${update.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          painRegion,
          diagnosis,
          treatmentModalities,
          dateOfVisit: dateOfVisit || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full border border-gray-300 rounded px-2 py-1 text-xs";

  return (
    <form onSubmit={handleSave} className="space-y-2" data-testid={`edit-form-${update.id}`}>
      <input
        type="text"
        value={painRegion}
        onChange={(e) => setPainRegion(e.target.value)}
        placeholder="Pain Region"
        required
        className={inputClass}
        aria-label="Pain Region"
      />
      <input
        type="text"
        value={diagnosis}
        onChange={(e) => setDiagnosis(e.target.value)}
        placeholder="Diagnosis"
        required
        className={inputClass}
        aria-label="Diagnosis"
      />
      <input
        type="text"
        value={treatmentModalities}
        onChange={(e) => setTreatmentModalities(e.target.value)}
        placeholder="Treatment Modalities"
        className={inputClass}
        aria-label="Treatment Modalities"
      />
      <input
        type="date"
        value={dateOfVisit}
        onChange={(e) => setDateOfVisit(e.target.value)}
        className={inputClass}
        aria-label="Date of Visit"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-2 py-1 bg-[var(--kinetic-gold)] text-white text-xs rounded hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1 text-xs text-[var(--kinetic-gray)] hover:text-[var(--kinetic-dark)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
