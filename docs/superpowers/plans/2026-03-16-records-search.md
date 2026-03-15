# Vet Records Search Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/records` page with three client-side filters (customer name, pet name, vet clinic) that shows each customer's most recent vet visit including diagnosis and identifiable pet/owner data.

**Architecture:** Server component fetches all qualifying patients (those with ≥1 episode) and all clinics in a single `Promise.all`, serialises DateTime fields, then passes the data to a client component (`RecordsTable`) that handles filter state and table rendering entirely in-browser. The Navbar gains a "Records" link visible to all authenticated users.

**Tech Stack:** Next.js 15 App Router, Prisma ORM, React Testing Library, Tailwind CSS (`--fetch-*` CSS tokens)

---

## Chunk 1: RecordsTable Component

### Task 1: RecordsTable component + tests

**Files:**
- Create: `components/RecordsTable.tsx`
- Create: `tests/records-table.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/records-table.test.tsx`:

```tsx
/**
 * RecordsTable filter behavior tests
 *
 * Verifies that the three client-side filters (customer name, pet name,
 * vet clinic) correctly narrow the rendered rows, compose together, and
 * show the empty state when nothing matches.
 */
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RecordsTable from "@/components/RecordsTable";

const mockClinics = [
  { id: "c1", name: "City Vet Clinic" },
  { id: "c2", name: "Harbour Vet" },
];

const mockPatients = [
  {
    id: "p1",
    firstName: "John",
    lastName: "Smith",
    dateOfBirth: "1985-03-15T00:00:00.000Z",
    address: null,
    insuranceCommencementDate: null,
    petName: "Buddy",
    petBreed: "Golden Retriever",
    petType: "DOG",
    petGender: "Male",
    petDesexed: true,
    petDateOfBirth: "2020-06-01T00:00:00.000Z",
    episodes: [
      {
        startDate: "2026-01-15T00:00:00.000Z",
        reason: "Annual checkup",
        clinic: { name: "City Vet Clinic" },
        clinicalUpdates: [
          {
            diagnosis: "Healthy",
            painRegion: "None",
            treatmentModalities: "Vaccination",
            redFlags: false,
            dateOfVisit: "2026-01-15T00:00:00.000Z",
          },
        ],
      },
    ],
  },
  {
    id: "p2",
    firstName: "Winston",
    lastName: "Liang",
    dateOfBirth: "1990-07-20T00:00:00.000Z",
    address: null,
    insuranceCommencementDate: null,
    petName: "Mochi",
    petBreed: "British Shorthair",
    petType: "CAT",
    petGender: "Female",
    petDesexed: true,
    petDateOfBirth: "2021-03-15T00:00:00.000Z",
    episodes: [
      {
        startDate: "2026-02-10T00:00:00.000Z",
        reason: "Dental cleaning",
        clinic: { name: "Harbour Vet" },
        clinicalUpdates: [
          {
            diagnosis: "Dental disease",
            painRegion: "Mouth",
            treatmentModalities: "Cleaning",
            redFlags: false,
            dateOfVisit: "2026-02-10T00:00:00.000Z",
          },
        ],
      },
    ],
  },
];

describe("RecordsTable", () => {
  it("renders all patients with no filters applied", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("Winston Liang")).toBeInTheDocument();
  });

  it("filters by customer name (case-insensitive)", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    fireEvent.change(screen.getByTestId("customer-filter"), {
      target: { value: "john" },
    });
    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.queryByText("Winston Liang")).not.toBeInTheDocument();
  });

  it("filters by pet name (case-insensitive)", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    fireEvent.change(screen.getByTestId("pet-filter"), {
      target: { value: "mochi" },
    });
    expect(screen.getByText("Winston Liang")).toBeInTheDocument();
    expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
  });

  it("filters by vet clinic dropdown", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    fireEvent.change(screen.getByTestId("clinic-filter"), {
      target: { value: "Harbour Vet" },
    });
    expect(screen.getByText("Winston Liang")).toBeInTheDocument();
    expect(screen.queryByText("John Smith")).not.toBeInTheDocument();
  });

  it("shows empty state when no records match filters", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    fireEvent.change(screen.getByTestId("customer-filter"), {
      target: { value: "zzznomatch" },
    });
    expect(
      screen.getByText("No records match your filters.")
    ).toBeInTheDocument();
  });

  it("shows diagnosis from most recent clinical update", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByText("Dental disease")).toBeInTheDocument();
  });

  it("all three filters compose — only shows rows satisfying all active filters", () => {
    render(<RecordsTable patients={mockPatients} clinics={mockClinics} />);
    fireEvent.change(screen.getByTestId("customer-filter"), {
      target: { value: "john" },
    });
    fireEvent.change(screen.getByTestId("clinic-filter"), {
      target: { value: "Harbour Vet" },
    });
    // John is at City Vet Clinic, not Harbour Vet — so no rows match
    expect(
      screen.getByText("No records match your filters.")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "d:/Vibe Coded Projects/Fetch-Prototype" && npm test -- --testPathPattern="records-table" 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '@/components/RecordsTable'`

- [ ] **Step 3: Implement RecordsTable.tsx**

Create `components/RecordsTable.tsx`:

```tsx
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "d:/Vibe Coded Projects/Fetch-Prototype" && npm test -- --testPathPattern="records-table" 2>&1 | tail -20
```

Expected: PASS — 7 tests passing

- [ ] **Step 5: Commit**

```bash
cd "d:/Vibe Coded Projects/Fetch-Prototype" && git add components/RecordsTable.tsx tests/records-table.test.tsx && git commit -m "feat: add RecordsTable component with customer/pet/clinic filters"
```

---

## Chunk 2: Records Page + Navbar

### Task 2: Records server page + Navbar link

**Files:**
- Create: `app/(routes)/records/page.tsx`
- Modify: `components/Navbar.tsx` (line 9 — add Records link)

- [ ] **Step 1: Create the records page**

Create `app/(routes)/records/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import RecordsTable from "@/components/RecordsTable";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [clinics, rawPatients] = await Promise.all([
    prisma.clinic.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.patient.findMany({
      where: { episodes: { some: {} } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        address: true,
        insuranceCommencementDate: true,
        petName: true,
        petBreed: true,
        petType: true,
        petGender: true,
        petDesexed: true,
        petDateOfBirth: true,
        episodes: {
          orderBy: { startDate: "desc" },
          take: 1,
          select: {
            startDate: true,
            reason: true,
            clinic: { select: { name: true } },
            clinicalUpdates: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                diagnosis: true,
                painRegion: true,
                treatmentModalities: true,
                redFlags: true,
                dateOfVisit: true,
              },
            },
          },
        },
      },
      orderBy: { lastName: "asc" },
    }),
  ]);

  // Serialise DateTime fields — Next.js cannot pass Date objects to client components
  const patients = rawPatients.map((p) => ({
    ...p,
    dateOfBirth: p.dateOfBirth.toISOString(),
    insuranceCommencementDate: p.insuranceCommencementDate?.toISOString() ?? null,
    petDateOfBirth: p.petDateOfBirth?.toISOString() ?? null,
    episodes: p.episodes.map((ep) => ({
      ...ep,
      startDate: ep.startDate.toISOString(),
      clinicalUpdates: ep.clinicalUpdates.map((cu) => ({
        ...cu,
        dateOfVisit: cu.dateOfVisit?.toISOString() ?? null,
      })),
    })),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--fetch-dark)]">
          Vet Records
        </h1>
        <p className="text-sm text-[var(--fetch-gray)] mt-1">
          Verify that customers are currently visiting a vet clinic covered under Fetch&apos;s insurance policy.
        </p>
      </div>
      <RecordsTable patients={patients} clinics={clinics} />
    </div>
  );
}
```

- [ ] **Step 2: Add Records link to Navbar**

In `components/Navbar.tsx`, update the `allNavLinks` array (currently lines 7–10):

```tsx
const allNavLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/records", label: "Records" },
  { href: "/check-access", label: "Check Access", adminOnly: true },
];
```

Note: no `adminOnly` property on the Records entry — omitting it means `!link.adminOnly || isAdmin` evaluates to `true` for all users, matching the desired behaviour.

- [ ] **Step 3: Run the full test suite**

```bash
cd "d:/Vibe Coded Projects/Fetch-Prototype" && npm test 2>&1 | grep -E "PASS|FAIL|Tests:" | tail -20
```

Expected: all tests pass (358 + 7 new = 365 total).

- [ ] **Step 4: Commit**

```bash
cd "d:/Vibe Coded Projects/Fetch-Prototype" && git add "app/(routes)/records/page.tsx" components/Navbar.tsx && git commit -m "feat: add Vet Records search page and navbar link"
```
