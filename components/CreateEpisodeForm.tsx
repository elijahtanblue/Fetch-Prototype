"use client";

import { useState } from "react";

interface Pet {
  id: string;
  firstName: string;
  lastName: string;
}

interface CreateEpisodeFormProps {
  patients: Pet[];
  onCreated: (episode: { id: string; reason: string; startDate: string }) => void;
}

export default function CreateEpisodeForm({
  patients,
  onCreated,
}: CreateEpisodeFormProps) {
  const [open, setOpen] = useState(false);
  const [patientId, setPetId] = useState("");
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
        setError(data.error || "Failed to add pet visit");
        return;
      }

      const episode = await res.json();
      onCreated(episode);
      setOpen(false);
      setPetId("");
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fetch-pink)] text-white text-sm font-medium rounded-md hover:bg-[var(--fetch-pink-hover)] transition-colors"
      >
        + Add Pet Visit
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-[var(--fetch-dark)] mb-3">
        Add New Pet Visit
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="patientId"
            className="block text-xs font-medium text-[var(--fetch-gray)] mb-1"
          >
            Pet
          </label>
          <select
            id="patientId"
            value={patientId}
            onChange={(e) => setPetId(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)]"
          >
            <option value="">Select a pet</option>
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
            className="block text-xs font-medium text-[var(--fetch-gray)] mb-1"
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
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)]"
          />
        </div>

        <div>
          <label
            htmlFor="startDate"
            className="block text-xs font-medium text-[var(--fetch-gray)] mb-1"
          >
            Start Date
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)]"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-1.5 bg-[var(--fetch-pink)] text-white text-sm font-medium rounded-md hover:bg-[var(--fetch-pink-hover)] transition-colors disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Visit"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-sm text-[var(--fetch-gray)] hover:text-[var(--fetch-dark)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
