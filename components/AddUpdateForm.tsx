"use client";

import { useState } from "react";

interface AddUpdateFormProps {
  episodeId: string;
  onCreated: () => void;
}

type FormMode = "closed" | "chooser" | "structured" | "quickHandoff";

export default function AddUpdateForm({
  episodeId,
  onCreated,
}: AddUpdateFormProps) {
  const [mode, setMode] = useState<FormMode>("closed");

  // Shared fields
  const [painRegion, setPainRegion] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  // Structured-only fields
  const [treatmentModalities, setTreatmentModalities] = useState("");
  const [redFlags, setRedFlags] = useState(false);
  const [precautions, setPrecautions] = useState("");
  const [responsePattern, setResponsePattern] = useState("");
  const [suggestedNextSteps, setSuggestedNextSteps] = useState("");
  const [notesRaw, setNotesRaw] = useState("");

  // (notes state removed — QH now uses notesRaw like STRUCTURED)

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setPainRegion("");
    setDiagnosis("");
    setTreatmentModalities("");
    setRedFlags(false);
    setPrecautions("");
    setResponsePattern("");
    setSuggestedNextSteps("");
    setNotesRaw("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const isStructured = mode === "structured";
    const payload: Record<string, unknown> = {
      episodeId,
      updateType: isStructured ? "STRUCTURED" : "QUICK_HANDOFF",
      painRegion,
      diagnosis,
    };

    if (isStructured) {
      payload.treatmentModalities = treatmentModalities;
      payload.redFlags = redFlags;
      if (precautions) payload.precautions = precautions;
      if (responsePattern) payload.responsePattern = responsePattern;
      if (suggestedNextSteps) payload.suggestedNextSteps = suggestedNextSteps;
      if (notesRaw) payload.notesRaw = notesRaw;
    } else {
      payload.treatmentModalities = treatmentModalities;
      if (notesRaw) payload.notesRaw = notesRaw;
    }

    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add update");
        return;
      }

      onCreated();
      setMode("closed");
      resetForm();
    } finally {
      setLoading(false);
    }
  }

  if (mode === "closed") {
    return (
      <button
        onClick={() => setMode("chooser")}
        className="text-xs text-[var(--kinetic-gold)] hover:underline font-medium"
      >
        + Add Update
      </button>
    );
  }

  if (mode === "chooser") {
    return (
      <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-3">
        <h4 className="text-xs font-semibold text-[var(--kinetic-dark)] mb-2">
          Choose Update Type
        </h4>
        <div className="space-y-2">
          <button
            onClick={() => setMode("structured")}
            data-testid="chooser-structured"
            className="w-full text-left p-2 rounded border border-gray-200 hover:border-[var(--kinetic-gold)] transition-colors"
          >
            <span className="text-sm font-medium text-[var(--kinetic-dark)]">
              Structured Continuity
            </span>
            <span className="ml-1 text-xs text-[var(--kinetic-gold)]">(Recommended)</span>
            <p className="text-xs text-[var(--kinetic-gray)] mt-0.5">
              Full clinical details, precautions, and treatment response
            </p>
          </button>
          <button
            onClick={() => setMode("quickHandoff")}
            data-testid="chooser-quick"
            className="w-full text-left p-2 rounded border border-gray-200 hover:border-[var(--kinetic-gold)] transition-colors"
          >
            <span className="text-sm font-medium text-[var(--kinetic-dark)]">
              Quick Handoff
            </span>
            <span className="ml-1 text-xs text-[var(--kinetic-gray)]">(~30s)</span>
            <p className="text-xs text-[var(--kinetic-gray)] mt-0.5">
              Region, diagnosis, treatment, and brief notes
            </p>
          </button>
        </div>
        <button
          onClick={() => { setMode("closed"); resetForm(); }}
          className="mt-2 text-xs text-[var(--kinetic-gray)] hover:text-[var(--kinetic-dark)]"
        >
          Cancel
        </button>
      </div>
    );
  }

  const isStructured = mode === "structured";
  const inputClass = "w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kinetic-gold)]";
  const labelClass = "block text-xs font-medium text-[var(--kinetic-gray)] mb-0.5";

  return (
    <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-3">
      <h4 className="text-xs font-semibold text-[var(--kinetic-dark)] mb-2">
        {isStructured ? "Structured Continuity Update" : "Quick Handoff"}
      </h4>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label htmlFor={`painRegion-${episodeId}`} className={labelClass}>
            Pain Region
          </label>
          <input
            id={`painRegion-${episodeId}`}
            type="text"
            value={painRegion}
            onChange={(e) => setPainRegion(e.target.value)}
            required
            placeholder="e.g. Lower back, L4-L5"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`diagnosis-${episodeId}`} className={labelClass}>
            Diagnosis
          </label>
          <input
            id={`diagnosis-${episodeId}`}
            type="text"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            required
            placeholder="e.g. Lumbar disc herniation"
            className={inputClass}
          />
        </div>

        {isStructured && (
          <>
            <div>
              <label htmlFor={`treatmentModalities-${episodeId}`} className={labelClass}>
                Treatment Modalities
              </label>
              <input
                id={`treatmentModalities-${episodeId}`}
                type="text"
                value={treatmentModalities}
                onChange={(e) => setTreatmentModalities(e.target.value)}
                required
                placeholder="e.g. Manual therapy, exercise prescription"
                className={inputClass}
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
              <label htmlFor={`redFlags-${episodeId}`} className="text-xs font-medium text-[var(--kinetic-gray)]">
                Red Flags Present
              </label>
            </div>

            <div>
              <label htmlFor={`precautions-${episodeId}`} className={labelClass}>
                Precautions (optional)
              </label>
              <textarea
                id={`precautions-${episodeId}`}
                value={precautions}
                onChange={(e) => setPrecautions(e.target.value)}
                rows={2}
                placeholder="e.g. Avoid heavy lifting, monitor for neurological changes"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={`responsePattern-${episodeId}`} className={labelClass}>
                Response Pattern (optional)
              </label>
              <textarea
                id={`responsePattern-${episodeId}`}
                value={responsePattern}
                onChange={(e) => setResponsePattern(e.target.value)}
                rows={2}
                placeholder="e.g. Pain reduces with extension exercises, aggravated by prolonged sitting"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={`suggestedNextSteps-${episodeId}`} className={labelClass}>
                Suggested Next Steps (optional)
              </label>
              <textarea
                id={`suggestedNextSteps-${episodeId}`}
                value={suggestedNextSteps}
                onChange={(e) => setSuggestedNextSteps(e.target.value)}
                rows={2}
                placeholder="e.g. Progress to lumbar stabilisation, reassess in 2 weeks"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={`notesRaw-${episodeId}`} className={labelClass}>
                Clinical Notes (optional)
              </label>
              <textarea
                id={`notesRaw-${episodeId}`}
                value={notesRaw}
                onChange={(e) => setNotesRaw(e.target.value)}
                rows={3}
                placeholder="Detailed clinical notes (a summary will be shared with other clinics)"
                className={inputClass}
              />
            </div>
          </>
        )}

        {!isStructured && (
          <>
            <div>
              <label htmlFor={`treatmentModalities-${episodeId}`} className={labelClass}>
                Treatment Modalities
              </label>
              <input
                id={`treatmentModalities-${episodeId}`}
                type="text"
                value={treatmentModalities}
                onChange={(e) => setTreatmentModalities(e.target.value)}
                required
                placeholder="e.g. Manual therapy, exercise prescription"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={`notesRaw-${episodeId}`} className={labelClass}>
                Clinical Notes (optional)
              </label>
              <textarea
                id={`notesRaw-${episodeId}`}
                value={notesRaw}
                onChange={(e) => setNotesRaw(e.target.value)}
                rows={2}
                placeholder="Brief clinical notes (a summary will be shared with other clinics)"
                className={inputClass}
              />
            </div>
          </>
        )}

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
            onClick={() => { setMode("closed"); resetForm(); }}
            className="px-2 py-1 text-xs text-[var(--kinetic-gray)] hover:text-[var(--kinetic-dark)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
