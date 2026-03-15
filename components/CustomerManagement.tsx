"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  treatmentCompletedAt: string | null;
  episodeCount: number;
  petName: string | null;
  petType: string | null;
}

interface CustomerManagementProps {
  patients: CustomerRow[];
}

export default function CustomerManagement({ patients: initialCustomers }: CustomerManagementProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleDelete(id: string) {
    setError("");
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to remove customer");
      setConfirmDeleteId(null);
      return;
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id));
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
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, treatmentCompletedAt: date } : c))
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mt-6" data-testid="customer-management">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-[var(--fetch-dark)]">
          Customer Management
        </h2>
      </div>
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-700 text-xs" data-testid="customer-mgmt-error">
          {error}
        </div>
      )}
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 text-left">
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--fetch-gray)] uppercase tracking-wide">
              Customer
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--fetch-gray)] uppercase tracking-wide">
              Pet
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--fetch-gray)] uppercase tracking-wide">
              Type
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--fetch-gray)] uppercase tracking-wide">
              Phone
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--fetch-gray)] uppercase tracking-wide">
              Treatment Completed
            </th>
            <th className="px-4 py-2.5 text-xs font-medium text-[var(--fetch-gray)] uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className="border-b border-gray-50 last:border-b-0">
              <td className="px-4 py-3 text-sm text-[var(--fetch-dark)]">
                {customer.firstName} {customer.lastName}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--fetch-dark)]">
                {customer.petName ?? "—"}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--fetch-gray)]">
                {customer.petType ? (
                  <span className="inline-flex items-center gap-1">
                    {customer.petType === "CAT" ? "🐱" : "🐶"} {customer.petType}
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--fetch-gray)]">
                {customer.phoneNumber}
              </td>
              <td className="px-4 py-3">
                <input
                  type="date"
                  value={customer.treatmentCompletedAt ? customer.treatmentCompletedAt.slice(0, 10) : ""}
                  onChange={(e) =>
                    handleTreatmentDate(customer.id, e.target.value || null)
                  }
                  data-testid={`treatment-date-${customer.id}`}
                  className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]"
                />
                {customer.treatmentCompletedAt && (
                  <button
                    onClick={() => handleTreatmentDate(customer.id, null)}
                    className="ml-1 text-xs text-red-500 hover:text-red-700"
                    data-testid={`clear-treatment-date-${customer.id}`}
                  >
                    Clear
                  </button>
                )}
              </td>
              <td className="px-4 py-3">
                {confirmDeleteId === customer.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Confirm?</span>
                    <button
                      onClick={() => handleDelete(customer.id)}
                      data-testid={`confirm-delete-${customer.id}`}
                      className="text-xs text-red-600 font-medium hover:text-red-800"
                    >
                      Yes, Remove
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs text-[var(--fetch-gray)] hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(customer.id)}
                    disabled={customer.episodeCount > 0}
                    title={customer.episodeCount > 0 ? "Cannot remove customer with existing visits" : "Remove customer"}
                    data-testid={`remove-patient-${customer.id}`}
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
