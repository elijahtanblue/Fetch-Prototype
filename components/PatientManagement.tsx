"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PetRow {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  treatmentCompletedAt: string | null;
  episodeCount: number;
}

interface PetManagementProps {
  patients: PetRow[];
}

export default function PetManagement({ patients: initialPets }: PetManagementProps) {
  const router = useRouter();
  const [patients, setPets] = useState(initialPets);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleDelete(id: string) {
    setError("");
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to remove patient");
      setConfirmDeleteId(null);
      return;
    }
    setPets((prev) => prev.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
    router.refresh();
  }

  async function handleTreatmentDate(id: string, date: string | null) {
    setError("");
    const res = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treatmentCompletedAt: date }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to update");
      return;
    }
    setPets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, treatmentCompletedAt: date } : p))
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-6" data-testid="patient-management">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-[var(--kinetic-dark)]">
          Pet Management
        </h2>
      </div>
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-700 text-xs" data-testid="patient-mgmt-error">
          {error}
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 text-left">
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
              Pet
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
              Phone
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
              Treatment Completed
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--kinetic-gray)] uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id} className="border-b border-gray-50 last:border-b-0">
              <td className="px-4 py-3 text-sm text-[var(--kinetic-dark)]">
                {patient.firstName} {patient.lastName}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--kinetic-gray)]">
                {patient.phoneNumber}
              </td>
              <td className="px-4 py-3">
                <input
                  type="date"
                  value={patient.treatmentCompletedAt ? patient.treatmentCompletedAt.slice(0, 10) : ""}
                  onChange={(e) =>
                    handleTreatmentDate(patient.id, e.target.value || null)
                  }
                  data-testid={`treatment-date-${patient.id}`}
                  className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[var(--kinetic-gold)]"
                />
                {patient.treatmentCompletedAt && (
                  <button
                    onClick={() => handleTreatmentDate(patient.id, null)}
                    className="ml-1 text-xs text-red-500 hover:text-red-700"
                    data-testid={`clear-treatment-date-${patient.id}`}
                  >
                    Clear
                  </button>
                )}
              </td>
              <td className="px-4 py-3">
                {confirmDeleteId === patient.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Confirm?</span>
                    <button
                      onClick={() => handleDelete(patient.id)}
                      data-testid={`confirm-delete-${patient.id}`}
                      className="text-xs text-red-600 font-medium hover:text-red-800"
                    >
                      Yes, Remove
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-[var(--kinetic-gray)] hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(patient.id)}
                    disabled={patient.episodeCount > 0}
                    title={patient.episodeCount > 0 ? "Cannot remove pet with existing visits" : "Remove pet"}
                    data-testid={`remove-patient-${patient.id}`}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
