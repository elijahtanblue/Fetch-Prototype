"use client";

import { useState } from "react";

interface ClinicOption {
  id: string;
  name: string;
}

interface ClinicalUpdateRow {
  diagnosis: string;
  painRegion: string;
  treatmentModalities: string;
  redFlags: boolean;
  dateOfVisit: string | null;
}

interface EpisodeRow {
  startDate: string;
  reason: string;
  clinic: { name: string };
  clinicalUpdates: ClinicalUpdateRow[];
}

interface PatientRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: string | null;
  insuranceCommencementDate: string | null;
  petName: string | null;
  petBreed: string | null;
  petType: string | null;
  petGender: string | null;
  petDesexed: boolean | null;
  petDateOfBirth: string | null;
  episodes: EpisodeRow[];
}

interface RecordsTableProps {
  patients: PatientRow[];
  clinics: ClinicOption[];
}

export default function RecordsTable({ patients, clinics }: RecordsTableProps) {
  const [customerFilter, setCustomerFilter] = useState("");
  const [petFilter, setPetFilter] = useState("");
  const [clinicFilter, setClinicFilter] = useState("");

  const filtered = patients.filter((p) => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const petName = (p.petName ?? "").toLowerCase();
    const lastClinic = p.episodes[0]?.clinic.name ?? "";

    if (customerFilter && !fullName.includes(customerFilter.toLowerCase()))
      return false;
    if (petFilter && !petName.includes(petFilter.toLowerCase())) return false;
    if (clinicFilter && lastClinic !== clinicFilter) return false;
    return true;
  });

  function fmt(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-AU");
  }

  const headers = [
    "Customer",
    "Owner DOB",
    "Pet",
    "Breed",
    "Type",
    "Gender",
    "Desexed",
    "Pet DOB",
    "Insurance Start",
    "Last Clinic",
    "Visit Date",
    "Reason",
    "Diagnosis",
    "Red Flags",
  ];

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[160px]">
          <label
            htmlFor="customer-filter"
            className="block text-xs font-medium text-[var(--fetch-gray)] mb-1"
          >
            Customer name
          </label>
          <input
            id="customer-filter"
            type="text"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            placeholder="e.g. Smith"
            data-testid="customer-filter"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)]"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label
            htmlFor="pet-filter"
            className="block text-xs font-medium text-[var(--fetch-gray)] mb-1"
          >
            Pet name
          </label>
          <input
            id="pet-filter"
            type="text"
            value={petFilter}
            onChange={(e) => setPetFilter(e.target.value)}
            placeholder="e.g. Buddy"
            data-testid="pet-filter"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)]"
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label
            htmlFor="clinic-filter"
            className="block text-xs font-medium text-[var(--fetch-gray)] mb-1"
          >
            Vet clinic
          </label>
          <select
            id="clinic-filter"
            value={clinicFilter}
            onChange={(e) => setClinicFilter(e.target.value)}
            data-testid="clinic-filter"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)]"
          >
            <option value="">All clinics</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm" data-testid="records-table">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-xs font-medium text-[var(--fetch-gray)] uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={14}
                  className="px-4 py-8 text-center text-[var(--fetch-gray)] text-sm"
                >
                  No records match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const ep = p.episodes[0];
                const cu = ep?.clinicalUpdates[0];
                return (
                  <tr
                    key={p.id}
                    className="border-b border-gray-50 last:border-b-0"
                  >
                    <td className="px-3 py-3 font-medium text-[var(--fetch-dark)] whitespace-nowrap">
                      {p.firstName} {p.lastName}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-gray)] whitespace-nowrap">
                      {fmt(p.dateOfBirth)}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-dark)] whitespace-nowrap">
                      {p.petName ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-gray)]">
                      {p.petBreed ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-gray)]">
                      {p.petType ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-gray)]">
                      {p.petGender ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-gray)]">
                      {p.petDesexed == null ? "—" : p.petDesexed ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-gray)] whitespace-nowrap">
                      {fmt(p.petDateOfBirth)}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-gray)] whitespace-nowrap">
                      {fmt(p.insuranceCommencementDate)}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-dark)] whitespace-nowrap">
                      {ep?.clinic.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-gray)] whitespace-nowrap">
                      {fmt(ep?.startDate ?? null)}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-gray)]">
                      {ep?.reason ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-[var(--fetch-gray)]">
                      {cu?.diagnosis ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-center text-[var(--fetch-gray)]">
                      {cu?.redFlags ? "✓" : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
