# Fetch Rebrand & Pet Insurance Redesign

**Date:** 2026-03-15
**Approach:** B — Schema additions + full rename + Fetch design system

---

## Problem Statement

Fetch Pet Insurance currently verifies a pet's vet history by manually calling vet clinics.
This prototype centralises vet records so Fetch can retrieve history programmatically when
a customer applies for insurance — eliminating the manual verification step.

---

## Terminology Rename Map

| Current         | New                        |
|-----------------|----------------------------|
| Patient         | Customer                   |
| Clinician       | Vet                        |
| Clinic          | Vet Clinic                 |
| Episode         | Visit                      |
| Clinical Update | Vet Update                 |
| Check Access    | Insurance Eligibility Check |
| "Kinetic"       | "Fetch"                    |
| "Shared Pet History" | "Vet History Network" |

Rename applies across: Prisma schema, services, API routes, components, and page copy.
Test logic is unchanged; only display strings in tests are updated.

---

## Schema Changes

Add the following nullable fields to the existing `Patient` model (renamed concept: Customer).
All fields nullable so existing seed data does not break.

**Pet fields (1:1 with Customer for this prototype):**
```prisma
petName       String?
petBreed      String?
petType       String?   // "CAT" or "DOG"
petDesexed    Boolean?
petGender     String?
petDateOfBirth DateTime?
```

**Customer (owner) fields:**
```prisma
address                    String?
insuranceCommencementDate  DateTime?
```

No new models. No new relations. One migration.

---

## Component Renames

Note: `PatientManagement.tsx` currently exports `PetManagement` and `PatientSnapshot.tsx`
currently exports `PetSnapshot` — export names already drifted from file names. As part of
the rename, align exported identifier, file name, and test describe-block names:

| Current file / export              | New file / export                          |
|------------------------------------|--------------------------------------------|
| `CreatePatientForm.tsx` / `CreatePatientForm` | `CreateCustomerForm.tsx` / `CreateCustomerForm` |
| `PatientManagement.tsx` / `PetManagement`     | `CustomerManagement.tsx` / `CustomerManagement` |
| `PatientSnapshot.tsx` / `PetSnapshot`         | `CustomerSnapshot.tsx` / `CustomerSnapshot`     |

Other components updated in-place (labels/props only):
- `AddUpdateForm.tsx` → "Add Vet Update" copy
- `CreateEpisodeForm.tsx` → "Add Visit" copy
- `EpisodesSection.tsx` → "Visits" heading
- `Navbar.tsx` → "Fetch" branding, pink theme
- `SimulationPanel.tsx` → rename labels only

---

## API Route Renames

| Current                         | New                              |
|---------------------------------|----------------------------------|
| `/api/patients`                 | `/api/customers`                 |
| `/api/patients/[id]`            | `/api/customers/[id]`            |
| `/api/patients/[id]/consent`    | `/api/customers/[id]/consent`    |

Old paths kept as 301 redirects for Vercel compatibility (optional — not required for demo).

---

## Page Changes

### Login (`/login`)
- Replace "Kinetic" logo with "Fetch" wordmark + paw icon
- Add cat + dog mascot SVG illustration below the card
- Background: `#FDF2F8` (soft pink wash)
- Button: Fetch pink (`#EC4899`), pill shape

### Dashboard (`/dashboard`)
- "Patients" tab → "Customers" tab
- "Add Patient" → "Add Customer"
- Patient table columns updated: add "Pet Name", "Pet Type" columns
- Empty state: include cat/dog mascot illustration

### Check Access → Insurance Eligibility Check (`/check-access`)
**File: `app/(routes)/check-access/page.tsx`**
- Page title: "Insurance Eligibility Check"
- Input: customer name or pet name search
- Output: pet's vet history — which vet clinics visited, visit dates, diagnoses, treatments
- Existing snapshot/access-level logic and `/api/simulation/*` API calls unchanged under the hood
- `SimulationPanel.tsx`: labels and heading copy updated only — no logic or API call changes
- The page copy changes from "simulation" framing to "eligibility lookup" framing; the
  underlying mechanics are identical

---

## Design System

The single source of truth for colour tokens is `app/globals.css`. All component files
reference CSS variables — changing them in `globals.css` cascades everywhere automatically.

**`globals.css` variable renames:**

| Old variable           | New variable          | Old value  | New value  |
|------------------------|-----------------------|------------|------------|
| `--kinetic-gold`       | `--fetch-pink`        | `#D4A843`  | `#EC4899`  |
| `--kinetic-gold-hover` | `--fetch-pink-hover`  | *(undefined — existing bug)* | `#DB2777` |
| `--kinetic-gold-light` | `--fetch-pink-light`  | (existing) | `#FCE7F3`  |
| `--kinetic-bg`         | `--fetch-bg`          | `#f5f5f0`  | `#FDF2F8`  |
| `--kinetic-dark`       | `--fetch-dark`        | (existing) | unchanged  |
| `--kinetic-gray`       | `--fetch-gray`        | (existing) | unchanged  |

After renaming variables in `globals.css`, do a global find-and-replace of each old variable
name across all component and page files. No per-file colour changes required beyond that.

Mascots: inline SVG cat + dog pair (pink/purple palette matching Fetch website) used on:
- Login page (below the sign-in card)
- Dashboard empty state

---

## Testing

1. Run existing test suite before any changes; fix all failures first.
2. After changes: update test strings referencing "patient"/"clinician" to "customer"/"vet".
3. No new test infrastructure — keep existing tests green.

**Affected test files — module import paths AND strings must be updated:**

| File | What changes |
|------|-------------|
| `tests/patient-api.test.ts` → `tests/customer-api.test.ts` | Import path: `/api/patients` → `/api/customers`; label strings |
| `tests/patient-ui.test.tsx` → `tests/customer-ui.test.tsx` | Import paths: `@/components/PatientManagement`, `@/components/CreatePatientForm` → new names; label strings |
| `tests/snapshot-ui.test.tsx` | Import path: `@/components/PatientSnapshot` → `@/components/CustomerSnapshot`; label strings |
| `tests/consent-endpoint.test.ts` | Import path: `/api/patients/[id]/consent/route` → `/api/customers/[id]/consent/route` |
| `tests/terminology.test.tsx` | Label strings only |
| `tests/dashboard.test.tsx` | Label strings only |
| `tests/simulation-page.test.tsx` | Label strings only (mock clinic names, heading text) |

---

## Scope Clarifications

**`User.role = "clinician"` database value:** The `Clinician → Vet` rename is **UI copy only**
for this prototype. The `role` field in the `User` model stays `"clinician"` in the database,
seed files, and all auth/role-check logic. Only display labels in components change.

**`/api/snapshots/[patientId]/`:** The `patientId` path parameter name is not renamed — it is
an internal API detail, not user-facing. No changes to this route.

**`/api/simulation/*` routes:** Not renamed. Labels on the consuming pages change; API contracts
and internal logic do not.

## Out of Scope

- Multi-pet per customer (future milestone)
- Customer-facing login (vets only for this demo)
- Fetch API integration (this is the data-entry side only)
- Payment / policy management
- Removing diagnosis/treatment modality fields (kept as-is per user instruction)
- Simulation engine logic changes (labels only)
