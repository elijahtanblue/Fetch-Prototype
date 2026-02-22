"use client";

import { useState } from "react";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface CreateEpisodeFormProps {
  patients: Patient[];
  onCreated: (episode: { id: string; reason: string; startDate: string }) => void;
}

export default function CreateEpisodeForm({
  patients,
  onCreated,
}: CreateEpisodeFormProps) {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, reason, startDate }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create episode");
        return;
      }

      const episode = await res.json();
      onCreated(episode);
      setOpen(false);
      setPatientId("");
      setReason("");
      setStartDate(new Date().toISOString().split("T")[0]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--kinetic-gold)] text-white text-sm font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors"
      >
        + Create Episode
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-[var(--kinetic-dark)] mb-3">
        Create New Episode
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="patientId"
            className="block text-xs font-medium text-[var(--kinetic-gray)] mb-1"
          >
            Patient
          </label>
          <select
            id="patientId"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kinetic-gold)]"
          >
            <option value="">Select a patient</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="reason"
            className="block text-xs font-medium text-[var(--kinetic-gray)] mb-1"
          >
            Reason for Visit
          </label>
          <input
            id="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="e.g. Lower back pain assessment"
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kinetic-gold)]"
          />
        </div>

        <div>
          <label
            htmlFor="startDate"
            className="block text-xs font-medium text-[var(--kinetic-gray)] mb-1"
          >
            Start Date
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kinetic-gold)]"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 bg-[var(--kinetic-gold)] text-white text-sm font-medium rounded-md hover:bg-[var(--kinetic-gold-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Episode"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-sm text-[var(--kinetic-gray)] hover:text-[var(--kinetic-dark)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
