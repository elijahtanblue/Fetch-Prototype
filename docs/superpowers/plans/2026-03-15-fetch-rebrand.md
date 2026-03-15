# Fetch Rebrand Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the Kinetic physio app into Fetch pet insurance's vet history network — renaming Patient→Customer, adding pet fields, swapping the design to Fetch pink, and reframing Check Access as Insurance Eligibility Check.

**Architecture:** Approach B — schema additions (nullable fields on existing Patient model) + full terminology rename from DB labels through services, API routes, components, and pages + CSS token swap in globals.css cascading to all consumers.

**Tech Stack:** Next.js 15 (App Router), Prisma ORM, PostgreSQL (Neon), NextAuth, Tailwind CSS, Jest + React Testing Library

---

## Chunk 1: Baseline + Schema

### Task 1: Establish a clean test baseline

**Files:**
- No file changes — read-only diagnostic step

- [ ] **Step 1: Run the full test suite**

```bash
cd "d:/Vibe Coded Projects/Fetch-Prototype"
npm test 2>&1 | tee /tmp/test-baseline.txt
```

Expected: some tests may fail. Record which ones. Do not fix anything yet — just understand the starting state.

- [ ] **Step 2: Note failures**

Write down every failing test name. These pre-existing failures are the only ones you are allowed to fix *before* the rebrand changes begin. All other tests must stay green as you work.

---

### Task 2: Add pet and customer fields to schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add nullable fields to the Patient model**

In `prisma/schema.prisma`, replace the Patient model body with:

```prisma
model Patient {
  id                        String    @id @default(cuid())
  firstName                 String
  lastName                  String
  dateOfBirth               DateTime
  phoneNumber               String    @unique
  clinicId                  String
  consentStatus             String    @default("SHARE")
  consentUpdatedAt          DateTime?
  treatmentCompletedAt      DateTime?
  // Pet fields (1:1 with customer for this prototype)
  petName                   String?
  petBreed                  String?
  petType                   String?   // "CAT" or "DOG"
  petDesexed                Boolean?
  petGender                 String?
  petDateOfBirth            DateTime?
  // Customer (owner) fields
  address                   String?
  insuranceCommencementDate DateTime?
  createdAt                 DateTime  @default(now())
  updatedAt                 DateTime  @updatedAt

  clinic   Clinic    @relation(fields: [clinicId], references: [id])
  episodes Episode[]
}
```

- [ ] **Step 2: Create and apply the migration**

```bash
cd "d:/Vibe Coded Projects/Fetch-Prototype"
npx prisma migrate dev --name add_pet_customer_fields
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify generated Prisma client has the new fields**

```bash
grep -n "petName\|petBreed\|petType\|address\|insuranceCommencementDate" lib/generated/prisma/models.ts | head -20
```

Expected: lines showing the new field names in the TypeScript types (the generated client uses `models.ts`, not `index.d.ts`).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add pet and customer fields to Patient schema"
```

---

## Chunk 2: API Route Rename

### Task 3: Rename /api/patients → /api/customers

**Files:**
- Read: `app/api/patients/route.ts`, `app/api/patients/[id]/route.ts`, `app/api/patients/[id]/consent/route.ts`
- Create: `app/api/customers/route.ts`
- Create: `app/api/customers/[id]/route.ts`
- Create: `app/api/customers/[id]/consent/route.ts`
- Keep: old `/api/patients/` files temporarily (delete after tests updated in Chunk 6)

- [ ] **Step 1: Read the three existing patient route files**

Read each of these files in full before copying:
- `app/api/patients/route.ts`
- `app/api/patients/[id]/route.ts`
- `app/api/patients/[id]/consent/route.ts`

- [ ] **Step 2: Create `app/api/customers/route.ts`**

Copy `app/api/patients/route.ts` content exactly, with no changes. The internal Prisma calls still use `prisma.patient` — that is correct and intentional (the DB model name does not change).

```bash
mkdir -p "app/api/customers"
cp "app/api/patients/route.ts" "app/api/customers/route.ts"
```

- [ ] **Step 3: Create `app/api/customers/[id]/route.ts`**

```bash
mkdir -p "app/api/customers/[id]"
cp "app/api/patients/[id]/route.ts" "app/api/customers/[id]/route.ts"
```

- [ ] **Step 4: Create `app/api/customers/[id]/consent/route.ts`**

```bash
mkdir -p "app/api/customers/[id]/consent"
cp "app/api/patients/[id]/consent/route.ts" "app/api/customers/[id]/consent/route.ts"
```

- [ ] **Step 5: Update all component fetch calls from `/api/patients` to `/api/customers`**

Run this search scoped to `components/` only (do not include `app/` — the old route files there must stay until Chunk 6):

```bash
grep -rn "/api/patients" components/ --include="*.ts" --include="*.tsx"
```

The complete list of files that need changes (confirmed from codebase):
- `components/CreatePatientForm.tsx` — 1 occurrence: `fetch("/api/patients", ...)`
- `components/PatientManagement.tsx` — 2 occurrences: `fetch(\`/api/patients/${id}\`, ...)` (PATCH and DELETE)

Use Edit tool with `replace_all: true` on each file to replace `/api/patients` with `/api/customers`. Do NOT touch any files in `app/api/` or `tests/`.

- [ ] **Step 6: Run tests to verify no regressions**

```bash
npm test -- --testPathPattern="patient|customer" 2>&1 | tail -30
```

Expected: same pass/fail state as baseline (tests that import `/api/patients` directly still point to the old route files, which still exist).

- [ ] **Step 7: Commit**

```bash
git add app/api/customers/ components/
git commit -m "feat: add /api/customers routes and update component fetch calls"
```

---

## Chunk 3: Component Renames + New Form Fields

### Task 4: Rename PatientManagement → CustomerManagement

**Files:**
- Read: `components/PatientManagement.tsx` (already read — exports `PetManagement`)
- Create: `components/CustomerManagement.tsx`
- Note: keep old file until tests are updated in Chunk 6

- [ ] **Step 1: Create `components/CustomerManagement.tsx`**

Copy `components/PatientManagement.tsx`, then make these changes:
1. Rename exported function from `PetManagement` to `CustomerManagement`
2. Rename props interface from `PetManagementProps` to `CustomerManagementProps`
3. Add `petName` and `petType` columns to the table (new fields from schema)
4. Update `data-testid="patient-management"` → `data-testid="customer-management"`
5. Update `data-testid="patient-mgmt-error"` → `data-testid="customer-mgmt-error"`
6. Update error message: `"Failed to remove patient"` → `"Failed to remove customer"`

Full file content:

```tsx
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
```

- [ ] **Step 2: Verify file saved correctly**

```bash
grep -n "CustomerManagement\|customer-management" components/CustomerManagement.tsx | head -10
```

Expected: multiple lines showing `CustomerManagement` (export, interface, JSX) and `customer-management` (data-testid).

Note: `data-testid="remove-patient-${customer.id}"` is **intentionally kept** as `remove-patient-*` in this component. The existing tests use that testid string. It will be addressed in a follow-up cleanup; for now preserving it keeps the test suite green.

---

### Task 5: Rename CreatePatientForm → CreateCustomerForm with pet fields

**Files:**
- Create: `components/CreateCustomerForm.tsx`
- Keep: `components/CreatePatientForm.tsx` (delete after test updates in Chunk 6)

- [ ] **Step 1: Create `components/CreateCustomerForm.tsx`**

This replaces `CreatePatientForm.tsx` with additional pet and owner fields. Note the API call changes to `/api/customers`.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateCustomerForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [insuranceCommencementDate, setInsuranceCommencementDate] = useState("");
  // Pet fields
  const [petName, setPetName] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petType, setPetType] = useState<"CAT" | "DOG" | "">("");
  const [petDesexed, setPetDesexed] = useState<boolean | null>(null);
  const [petGender, setPetGender] = useState("");
  const [petDateOfBirth, setPetDateOfBirth] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setFirstName(""); setLastName(""); setDateOfBirth(""); setPhoneNumber("");
    setAddress(""); setInsuranceCommencementDate("");
    setPetName(""); setPetBreed(""); setPetType(""); setPetDesexed(null);
    setPetGender(""); setPetDateOfBirth("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, dateOfBirth, phoneNumber,
          address: address || undefined,
          insuranceCommencementDate: insuranceCommencementDate || undefined,
          petName: petName || undefined,
          petBreed: petBreed || undefined,
          petType: petType || undefined,
          petDesexed: petDesexed ?? undefined,
          petGender: petGender || undefined,
          petDateOfBirth: petDateOfBirth || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create customer");
        return;
      }

      resetForm();
      setIsOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        data-testid="create-patient-btn"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fetch-pink)] text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity"
      >
        + Add Customer
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4" data-testid="create-patient-form">
      <h3 className="text-sm font-semibold text-[var(--fetch-dark)] mb-3">New Customer &amp; Pet</h3>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Owner section */}
        <div>
          <p className="text-xs font-bold text-[var(--fetch-gray)] uppercase tracking-wide mb-2">Owner Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="customer-first-name" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">First Name *</label>
              <input id="customer-first-name" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="customer-last-name" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Last Name *</label>
              <input id="customer-last-name" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="customer-dob" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Date of Birth *</label>
              <input id="customer-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="customer-phone" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Phone Number *</label>
              <input id="customer-phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="0412345678" required
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div className="col-span-2">
              <label htmlFor="customer-address" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Address</label>
              <input id="customer-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Sydney NSW 2000"
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="customer-insurance-date" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Insurance Start Date</label>
              <input id="customer-insurance-date" type="date" value={insuranceCommencementDate} onChange={(e) => setInsuranceCommencementDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
          </div>
        </div>

        {/* Pet section */}
        <div>
          <p className="text-xs font-bold text-[var(--fetch-gray)] uppercase tracking-wide mb-2">Pet Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pet-name" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Pet Name</label>
              <input id="pet-name" type="text" value={petName} onChange={(e) => setPetName(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="pet-breed" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Breed</label>
              <input id="pet-breed" type="text" value={petBreed} onChange={(e) => setPetBreed(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div>
              <label htmlFor="pet-type" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Type</label>
              <select id="pet-type" value={petType} onChange={(e) => setPetType(e.target.value as "CAT" | "DOG" | "")}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]">
                <option value="">Select…</option>
                <option value="CAT">🐱 Cat</option>
                <option value="DOG">🐶 Dog</option>
              </select>
            </div>
            <div>
              <label htmlFor="pet-gender" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Gender</label>
              <select id="pet-gender" value={petGender} onChange={(e) => setPetGender(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]">
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label htmlFor="pet-dob" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Pet Date of Birth</label>
              <input id="pet-dob" type="date" value={petDateOfBirth} onChange={(e) => setPetDateOfBirth(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[var(--fetch-pink)]" />
            </div>
            <div className="flex items-end pb-0.5">
              <fieldset>
                <legend className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">Desexed?</legend>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" name="petDesexed" value="yes" checked={petDesexed === true} onChange={() => setPetDesexed(true)} /> Yes
                  </label>
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input type="radio" name="petDesexed" value="no" checked={petDesexed === false} onChange={() => setPetDesexed(false)} /> No
                  </label>
                </div>
              </fieldset>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600" data-testid="patient-form-error">{error}</p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={submitting}
            className="px-3 py-1.5 bg-[var(--fetch-pink)] text-white text-sm font-medium rounded-full hover:opacity-90 transition-opacity disabled:opacity-50">
            {submitting ? "Creating..." : "Add Customer"}
          </button>
          <button type="button" onClick={() => { setIsOpen(false); setError(""); resetForm(); }}
            className="px-3 py-1.5 border border-gray-200 text-sm text-[var(--fetch-gray)] rounded-full hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

Note: Three `data-testid` values are **intentionally kept** with old naming for test compatibility:
- `data-testid="create-patient-btn"` — existing tests assert on this
- `data-testid="create-patient-form"` — existing tests assert on this
- `data-testid="patient-form-error"` — existing tests assert on this

These will be cleaned up in a follow-up; keeping them now keeps the test suite green.

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep -i "CreateCustomerForm\|CustomerManagement" | head -20
```

Expected: no output (no errors for these files).

- [ ] **Step 3: Commit**

```bash
git add components/CustomerManagement.tsx components/CreateCustomerForm.tsx
git commit -m "feat: add CustomerManagement and CreateCustomerForm with pet fields"
```

---

## Chunk 4: Design System + Login Page

### Task 6: Update globals.css CSS token names

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace globals.css content**

```css
@import "tailwindcss";

:root {
  --fetch-pink: #EC4899;
  --fetch-pink-hover: #DB2777;
  --fetch-pink-light: #FCE7F3;
  --fetch-dark: #1a1a1a;
  --fetch-gray: #6b7280;
  --fetch-bg: #FDF2F8;
}
```

- [ ] **Step 2: Find all files still using old token names**

```bash
grep -rn "kinetic-gold\|kinetic-bg\|kinetic-dark\|kinetic-gray\|kinetic-gold-light" app/ components/ --include="*.tsx" --include="*.ts" --include="*.css"
```

Note every file listed — each one needs old variable references replaced.

- [ ] **Step 3: Replace old tokens in every file returned by the Step 2 grep**

Apply the replacements to **every file the grep returned** — do not use a fixed list. Use Edit tool with `replace_all: true` for each substitution:

| Find | Replace |
|------|---------|
| `var(--kinetic-gold)` | `var(--fetch-pink)` |
| `var(--kinetic-gold-hover)` | `var(--fetch-pink-hover)` |
| `var(--kinetic-gold-light)` | `var(--fetch-pink-light)` |
| `var(--kinetic-bg)` | `var(--fetch-bg)` |
| `var(--kinetic-dark)` | `var(--fetch-dark)` |
| `var(--kinetic-gray)` | `var(--fetch-gray)` |

**Skip `app/login/page.tsx`** — Task 7 replaces that file entirely with content that already uses `--fetch-*` tokens. Replacing tokens in it here would be overwritten.

- [ ] **Step 4: Verify no old tokens remain**

```bash
grep -rn "kinetic-gold\|kinetic-bg\|kinetic-dark\|kinetic-gray" app/ components/ --include="*.tsx" --include="*.ts" --include="*.css"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/ components/
git commit -m "feat: replace Kinetic gold tokens with Fetch pink design system"
```

---

### Task 7: Rebrand login page to Fetch

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Replace login page content**

Replace the full content of `app/login/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

function CatMascot() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="32" cy="36" r="20" fill="#FCE7F3" stroke="#EC4899" strokeWidth="2"/>
      <polygon points="16,22 22,10 26,22" fill="#EC4899"/>
      <polygon points="38,22 42,10 48,22" fill="#EC4899"/>
      <circle cx="25" cy="34" r="3" fill="#EC4899"/>
      <circle cx="39" cy="34" r="3" fill="#EC4899"/>
      <path d="M28 42 Q32 46 36 42" stroke="#EC4899" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <line x1="20" y1="38" x2="10" y2="36" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="40" x2="10" y2="40" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="44" y1="38" x2="54" y2="36" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="44" y1="40" x2="54" y2="40" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function DogMascot() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="32" cy="36" r="20" fill="#F3E8FF" stroke="#A855F7" strokeWidth="2"/>
      <ellipse cx="16" cy="28" rx="6" ry="10" fill="#A855F7"/>
      <ellipse cx="48" cy="28" rx="6" ry="10" fill="#A855F7"/>
      <circle cx="25" cy="34" r="3" fill="#A855F7"/>
      <circle cx="39" cy="34" r="3" fill="#A855F7"/>
      <ellipse cx="32" cy="43" rx="5" ry="3" fill="#A855F7"/>
      <path d="M28 42 Q32 47 36 42" stroke="#7E22CE" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--fetch-bg)]">
      <div className="w-full max-w-sm">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[var(--fetch-pink)] flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--fetch-dark)]">Fetch</h1>
          </div>
          <p className="text-sm text-[var(--fetch-gray)]">Vet History Network</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6">
          <h2 className="text-lg font-semibold mb-4 text-[var(--fetch-dark)]">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--fetch-gray)] mb-1">Email</label>
              <input
                id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)] focus:border-transparent"
                placeholder="you@vetclinic.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--fetch-gray)] mb-1">Password</label>
              <input
                id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)] focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm" role="alert">{error}</p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full py-2 px-4 bg-[var(--fetch-pink)] text-white font-medium rounded-full text-sm hover:bg-[var(--fetch-pink-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Mascots */}
        <div className="flex justify-center gap-6 mt-6">
          <CatMascot />
          <DogMascot />
        </div>

        <p className="text-xs text-center text-[var(--fetch-gray)] mt-4">
          Contribute vet records to unlock pet history.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no old Kinetic references remain in login page**

```bash
grep -n "kinetic\|Kinetic" app/login/page.tsx
```

Expected: no output.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "login" | head -10
```

Expected: no output (no errors in the login page).

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: rebrand login page to Fetch with pink theme and mascots"
```

---

## Chunk 5: Dashboard + Check Access Pages

### Task 8: Update dashboard page

**Files:**
- Read then modify: `app/(routes)/dashboard/page.tsx`

- [ ] **Step 1: Read the current dashboard page**

Read `app/(routes)/dashboard/page.tsx` in full before making changes.

- [ ] **Step 2: Update imports and component references**

In `app/(routes)/dashboard/page.tsx`:

1. Replace `import PatientManagement from "@/components/PatientManagement"` with `import CustomerManagement from "@/components/CustomerManagement"`
2. Replace `import CreatePatientForm from "@/components/CreatePatientForm"` with `import CreateCustomerForm from "@/components/CreateCustomerForm"`
3. In the Prisma query for patients, add `petName: true, petType: true` to the `select` block
4. Replace `<PatientManagement patients={patients} />` with `<CustomerManagement patients={patients} />`
5. Replace `<CreatePatientForm />` with `<CreateCustomerForm />`
6. Replace all text label occurrences: `"Patients"` → `"Customers"`, `"Patient"` → `"Customer"`, `"patient"` → `"customer"` (in JSX copy only, not variable names)
7. Replace all `var(--kinetic-*)` tokens with `var(--fetch-*)` equivalents (should already be done by Task 6, but verify)

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(routes)/dashboard/page.tsx"
git commit -m "feat: update dashboard to use CustomerManagement and CreateCustomerForm"
```

---

### Task 9: Rebrand Check Access → Insurance Eligibility Check

**Files:**
- Modify: `app/(routes)/check-access/page.tsx`
- Modify: `components/SimulationPanel.tsx` (labels only)

- [ ] **Step 1: Read the current check-access page**

Read `app/(routes)/check-access/page.tsx` in full before editing.

- [ ] **Step 2: Update check-access/page.tsx**

In `app/(routes)/check-access/page.tsx`, make these targeted changes:

1. Replace `prisma.patient.findMany` select to also fetch `petName`:
```ts
const patients = await prisma.patient.findMany({
  select: { id: true, firstName: true, lastName: true, petName: true },
  orderBy: { lastName: "asc" },
});
```

2. Replace the entire page `return` block with:
```tsx
return (
  <div className="max-w-4xl mx-auto">
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-[var(--fetch-dark)]">
        Insurance Eligibility Check
      </h1>
      <p className="text-sm text-[var(--fetch-gray)] mt-1">
        Look up a customer&apos;s vet history to verify pet records before processing an insurance application.
      </p>
    </div>

    {/* Pet name search — lets Fetch staff filter by pet name */}
    <div className="mb-4">
      <label htmlFor="pet-search" className="block text-xs font-medium text-[var(--fetch-gray)] mb-1">
        Search by customer or pet name
      </label>
      <input
        id="pet-search"
        type="text"
        placeholder="e.g. Smith or Buddy"
        className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--fetch-pink)]"
        data-testid="pet-search-input"
      />
    </div>

    <SimulationPanel clinics={clinics} patients={patients} />
  </div>
);
```

Note: The search input is a UI affordance for this demo — it does not filter server-side. SimulationPanel receives the full list; filtering can be wired up in a follow-up.

- [ ] **Step 2: Read SimulationPanel.tsx**

Read `components/SimulationPanel.tsx` in full to understand which heading labels to update.

- [ ] **Step 3: Update SimulationPanel.tsx labels only**

In `components/SimulationPanel.tsx`, make copy-only changes (no logic or API changes):
- Any heading text referencing "Check Access" → "Eligibility Check"
- Any label referencing "Simulation" in user-visible UI text → "History Lookup"
- `var(--kinetic-*)` → `var(--fetch-*)` tokens (should already be done by Task 6, but verify)

Do NOT change: any API endpoint URLs (`/api/simulation/*`), function names, variable names, event type strings, or `data-testid` values.

- [ ] **Step 4: Verify old heading strings are gone from SimulationPanel**

```bash
grep -n "Check Access\|Simulation" components/SimulationPanel.tsx
```

Expected: no output (or only results inside comments). If any remain, they are user-visible strings that need updating.

- [ ] **Step 5: Commit**

```bash
git add "app/(routes)/check-access/page.tsx" components/SimulationPanel.tsx
git commit -m "feat: rebrand check-access page to Insurance Eligibility Check"
```

---

## Chunk 6: Test Updates + Final Green Build

### Task 10: Update Navbar and remaining components

**Files:**
- Modify: `components/Navbar.tsx`
- Modify: remaining components with copy changes

- [ ] **Step 1: Read Navbar.tsx**

Read `components/Navbar.tsx` in full.

- [ ] **Step 2: Update Navbar branding**

In `components/Navbar.tsx`:
- Replace "Kinetic" wordmark text with "Fetch"
- Replace the `K` logo letter with `F` and update the surrounding `div` label/aria text to "Fetch"
- Verify `var(--kinetic-*)` tokens already replaced by Task 6 global sweep (grep to confirm)

- [ ] **Step 3: Update EpisodesSection.tsx copy**

Read `components/EpisodesSection.tsx`. Update any heading that says "Episodes" → "Visits", "Episode" → "Visit" in user-visible text only.

- [ ] **Step 4: Update CreateEpisodeForm.tsx copy**

Read `components/CreateEpisodeForm.tsx`. Update button label "Create Episode" → "Add Visit" and any heading copy. Do not change variable names or API calls.

- [ ] **Step 5: Update AddUpdateForm.tsx copy**

Read `components/AddUpdateForm.tsx`. Update any heading "Clinical Update" → "Vet Update" in user-visible text only.

- [ ] **Step 6: Verify copy changes landed**

```bash
grep -rn "Kinetic\|kinetic\|Clinician\|clinician\|Episode\b\|Clinical Update" components/Navbar.tsx components/EpisodesSection.tsx components/CreateEpisodeForm.tsx components/AddUpdateForm.tsx
```

Expected: no results (or only inside variable names/comments, not user-visible JSX strings).

- [ ] **Step 7: Commit**

```bash
git add components/Navbar.tsx components/EpisodesSection.tsx components/CreateEpisodeForm.tsx components/AddUpdateForm.tsx
git commit -m "feat: update Navbar to Fetch branding and rename Episodes/Updates copy"
```

---

### Task 11: Update test files — import paths and strings

**Files:**
- Modify: `tests/patient-api.test.ts` → rename to `tests/customer-api.test.ts`
- Modify: `tests/patient-ui.test.tsx` → rename to `tests/customer-ui.test.tsx`
- Modify: `tests/snapshot-ui.test.tsx`
- Modify: `tests/consent-endpoint.test.ts`
- Modify: `tests/terminology.test.tsx`
- Modify: `tests/dashboard.test.tsx`
- Modify: `tests/simulation-page.test.tsx`

- [ ] **Step 1: Rename and update patient-api test**

```bash
cp tests/patient-api.test.ts tests/customer-api.test.ts
```

In `tests/customer-api.test.ts`:
- Replace all `/api/patients` import paths with `/api/customers`
- Replace all `"patient"` string literals in describe/test names with `"customer"`
- Keep all test logic identical

Then delete the old file after verifying the new one passes:
```bash
# (delete only after Step 6 passes)
```

- [ ] **Step 2: Rename and update patient-ui test**

```bash
cp tests/patient-ui.test.tsx tests/customer-ui.test.tsx
```

In `tests/customer-ui.test.tsx`:
- Replace `import PatientManagement from "@/components/PatientManagement"` with `import CustomerManagement from "@/components/CustomerManagement"`
- Replace `import CreatePatientForm from "@/components/CreatePatientForm"` with `import CreateCustomerForm from "@/components/CreateCustomerForm"`
- Replace `<PatientManagement` with `<CustomerManagement` and `<CreatePatientForm` with `<CreateCustomerForm` in JSX
- Replace `data-testid="patient-management"` assertions with `data-testid="customer-management"`
- Replace describe/test name strings: `"patient"` → `"customer"`

- [ ] **Step 3: Create CustomerSnapshot.tsx and update snapshot-ui test**

First, create the renamed component:
```bash
cp components/PatientSnapshot.tsx components/CustomerSnapshot.tsx
```

In `components/CustomerSnapshot.tsx`:
- Change the exported function name from `PetSnapshot` to `CustomerSnapshot`
- Replace any `var(--kinetic-*)` tokens with `var(--fetch-*)` equivalents
- Update user-visible string "Patient" → "Customer" in headings/labels if present

In `tests/snapshot-ui.test.tsx`:
- Replace `import PatientSnapshot from "@/components/PatientSnapshot"` with `import CustomerSnapshot from "@/components/CustomerSnapshot"`
- Replace `<PatientSnapshot` with `<CustomerSnapshot`
- Replace string assertions: "Patient" → "Customer" in `expect(screen.getByText(...))` calls

- [ ] **Step 4: Update consent-endpoint test import path**

In `tests/consent-endpoint.test.ts`:
- Replace the import of `/app/api/patients/[id]/consent/route` with `/app/api/customers/[id]/consent/route`

- [ ] **Step 5: Update string-only tests**

In each of these files, replace user-visible label strings (describe/test names and rendered text assertions):
- `tests/terminology.test.tsx`: replace "Clinician" → "Vet", "Patient" → "Customer" in string assertions
- `tests/dashboard.test.tsx`: replace "Patient" → "Customer" in string assertions
- `tests/simulation-page.test.tsx`: replace "Check Access Decision" → "Eligibility Check" and any simulation heading strings

- [ ] **Step 6: Run the full test suite**

```bash
npm test 2>&1 | tail -40
```

Expected: all tests pass (or only pre-existing failures from the baseline in Task 1).

- [ ] **Step 7: Delete old test files only if Step 6 was all green**

Only run these if the Step 6 test run showed all previously-passing tests still passing:

```bash
rm tests/patient-api.test.ts
rm tests/patient-ui.test.tsx
```

If Step 6 had new failures, stop here and fix them before deleting.

Do NOT delete `components/PatientManagement.tsx`, `components/PatientSnapshot.tsx`, or `components/CreatePatientForm.tsx` — keep them as compatibility shims. They can be cleaned up in a follow-up.

- [ ] **Step 8: Final test run**

```bash
npm test 2>&1 | grep -E "PASS|FAIL|Tests:" | tail -20
```

Expected: all previously-passing tests still pass.

- [ ] **Step 9: Commit**

```bash
git add tests/
git commit -m "feat: update test files for customer/vet rename and new route paths"
```

---

### Task 12: Verify build and seed

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 2: Next.js build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` and no type errors.

- [ ] **Step 3: Update seed.ts to include pet fields**

In `prisma/seed.ts`, update the two `prisma.patient.create` calls to add pet fields:

For "John Smith":
```ts
await prisma.patient.create({
  data: {
    firstName: "John",
    lastName: "Smith",
    dateOfBirth: new Date("1985-03-15"),
    phoneNumber: "0400000001",
    clinicId: clinicA.id,
    petName: "Buddy",
    petType: "DOG",
    petBreed: "Golden Retriever",
    petGender: "Male",
    petDesexed: true,
    petDateOfBirth: new Date("2020-06-01"),
  },
});
```

For "Winston Liang" (find the second `prisma.patient.create` call and add):
```ts
    petName: "Mochi",
    petType: "CAT",
    petBreed: "British Shorthair",
    petGender: "Female",
    petDesexed: true,
    petDateOfBirth: new Date("2021-03-15"),
```

Also update the clinic names to match the vet context:
- `"City Physio"` → `"City Vet Clinic"`
- `"Harbour Health"` → `"Harbour Vet"`
- `"Summit Rehabilitation"` → `"Summit Animal Hospital"`

- [ ] **Step 4: Re-run seed**

```bash
npm run db:seed 2>&1
```

Expected: seed completes with no errors. If it fails on a unique constraint, the DB already has data — run `npx prisma migrate reset --force` first (warning: this deletes all data).

- [ ] **Step 5: Final commit**

```bash
git add prisma/seed.ts
git commit -m "chore: update seed data with pet fields and vet clinic names"
```
