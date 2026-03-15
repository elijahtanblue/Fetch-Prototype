# Vet Records Search Page

**Date:** 2026-03-16

---

## Purpose

A read-only search dashboard at `/records` for Fetch staff to verify that a customer is currently visiting one of the vet clinics covered under Fetch's insurance policy. Staff search by customer name, pet name, or vet clinic and see the customer's most recent visit details including diagnosis and identifiable pet/owner data.

---

## Access

Visible to all authenticated users (no admin restriction) — easier for demo purposes.

---

## Route & Files

| Action | Path |
|--------|------|
| Create | `app/(routes)/records/page.tsx` |
| Create | `components/RecordsTable.tsx` |
| Modify | `components/Navbar.tsx` |

---

## Data Fetching

Server component at `app/(routes)/records/page.tsx` fetches at load time:

1. **All clinics** — `id`, `name` (for the dropdown)
2. **All patients who have at least one episode** — using Prisma `where: { episodes: { some: {} } }` to exclude customers with no visits
3. For each patient, include their **most recent episode** (orderBy `startDate desc`, take 1) with:
   - `clinic.name`
   - `clinicalUpdates` (orderBy `createdAt desc`, take 1) for diagnosis fields

No new API routes. All data serialised and passed as props to the client component.

### Prisma query shape

```ts
const patients = await prisma.patient.findMany({
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
});
```

---

## Filters (client-side)

Three inputs in `RecordsTable.tsx`, all filter the already-loaded dataset — no server round-trips:

| Filter | Type | Matches on |
|--------|------|-----------|
| Customer name | Text input | `firstName + " " + lastName` (case-insensitive) |
| Pet name | Text input | `petName` (case-insensitive) |
| Vet clinic | Dropdown | `episodes[0].clinic.name` exact match |

All three filters compose — a customer must satisfy every active filter to appear.

---

## Results Table

One row per customer. Only customers with at least one visit are shown (enforced at query level).

### Columns

| Column | Source field |
|--------|-------------|
| Customer | `firstName lastName` |
| Owner DOB | `dateOfBirth` |
| Pet | `petName` |
| Breed | `petBreed` |
| Type | `petType` (CAT / DOG) |
| Gender | `petGender` |
| Desexed | `petDesexed` (Yes / No) |
| Pet DOB | `petDateOfBirth` |
| Insurance Start | `insuranceCommencementDate` |
| Last Clinic | `episodes[0].clinic.name` |
| Visit Date | `episodes[0].startDate` |
| Reason | `episodes[0].reason` |
| Diagnosis | `episodes[0].clinicalUpdates[0].diagnosis` |
| Red Flags | `episodes[0].clinicalUpdates[0].redFlags` (✓ / —) |

Nullable fields display `—` when not set.

---

## Navbar

Add a "Records" link between "Dashboard" and "Check Access":

```tsx
{ href: "/records", label: "Records" }
```

Visible to all authenticated users (no role check).

---

## Out of Scope

- Full visit history (most recent only)
- Export / CSV download
- Pagination (3 demo records)
- Edit / write operations (read-only page)
- Cross-clinic visit comparison
