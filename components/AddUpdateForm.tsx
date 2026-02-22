"use client";

import { useState } from "react";

interface AddUpdateFormProps {
  episodeId: string;
  onCreated: () => void;
}

export default function AddUpdateForm({
  episodeId,
  onCreated,
}: AddUpdateFormProps) {
  const [open, setOpen] = useState(false);
  const [painRegion, setPainRegion] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatmentModalities, setTreatmentModalities] = useState("");
  const [redFlags, setRedFlags] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeId,
          painRegion,
          diagnosis,
          treatmentModalities,
          redFlags,
          notes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add update");
        return;
      }

      onCreated();
      setOpen(false);
      setPainRegion("");
      setDiagnosis("");
      setTreatmentModalities("");
      setRedFlags(false);
      setNotes("");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--kinetic-gold)] hover:underline font-medium"
      >
        + Add Update
      </button>
    );
  }

  return (
    <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-3">
      <h4 className="text-xs font-semibold text-[var(--kinetic-dark)] mb-2">
        Add Clinical Update
      </h4>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label
            htmlFor={`painRegion-${episodeId}`}
            className="block text-xs font-medium text-[var(--kinetic-gray)] mb-0.5"
          >
            Pain Region
          </label>
          <input
            id={`painRegion-${episodeId}`}
            type="text"
            value={painRegion}
            onChange={(e) => setPainRegion(e.target.value)}
            required
            placeholder="e.g. Lower back, L4-L5"
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kinetic-gold)]"
          />
        </div>

        <div>
          <label
            htmlFor={`diagnosis-${episodeId}`}
            className="block text-xs font-medium text-[var(--kinetic-gray)] mb-0.5"
          >
            Diagnosis
          </label>
          <input
            id={`diagnosis-${episodeId}`}
            type="text"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            required
            placeholder="e.g. Lumbar disc herniation"
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kinetic-gold)]"
          />
        </div>

        <div>
          <label
            htmlFor={`treatmentModalities-${episodeId}`}
            className="block text-xs font-medium text-[var(--kinetic-gray)] mb-0.5"
          >
            Treatment Modalities
          </label>
          <input
            id={`treatmentModalities-${episodeId}`}
            type="text"
            value={treatmentModalities}
            onChange={(e) => setTreatmentModalities(e.target.value)}
            required
            placeholder="e.g. Manual therapy, exercise prescription"
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kinetic-gold)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id={`redFlags-${episodeId}`}
            type="checkbox"
            checked={redFlags}
            onChange={(e) => setRedFlags(e.target.checked)}
            className="rounded border-gray-300 text-[var(--kinetic-gold)] focus:ring-[var(--kinetic-gold)]"
          />
          <label
            htmlFor={`redFlags-${episodeId}`}
            className="text-xs font-medium text-[var(--kinetic-gray)]"
          >
            Red Flags Present
          </label>
        </div>

        <div>
          <label
            htmlFor={`notes-${episodeId}`}
            className="block text-xs font-medium text-[var(--kinetic-gray)] mb-0.5"
          >
            Notes (optional)
          </label>
          <textarea
            id={`notes-${episodeId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Additional clinical notes..."
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kinetic-gold)]"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-2 py-1 bg-[var(--kinetic-gold)] text-white text-xs font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Update"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-2 py-1 text-xs text-[var(--kinetic-gray)] hover:text-[var(--kinetic-dark)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
