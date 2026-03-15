# Vet Records Search Page

**Date:** 2026-03-16

---

## Purpose

A read-only search dashboard at `/records` for Fetch staff to verify that a customer is currently visiting one of the vet clinics covered under Fetch's insurance policy. Staff search by customer name, pet name, or vet clinic and see the customer's most recent visit details including diagnosis and identifiable pet/owner data.

---

## Access

Visible to all authenticated users (no admin restriction) — easier for demo purposes.
Unauthenticated users are redirected to `/login` (same pattern as all other protected pages).

---

## Route & Files

| Action | Path |
|--------|------|
| Create | `app/(routes)/records/page.tsx` |
| Create | `components/RecordsTable.tsx` |
| Modify | `components/Navbar.tsx` |

The page must include `export const dynamic = "force-dynamic"` at the top level (same as `dashboard/page.tsx` and `check-access/page.tsx`) to prevent Next.js from statically rendering the page at build time.

---

## Data Fetching

Server component at `app/(routes)/records/page.tsx` fetches two queries in parallel at load time:

1. **All clinics** — `id`, `name` (for the dropdown filter)
2. **All patients who have at least one episode** — using Prisma `where: { episodes: { some: {} } }` to exclude customers with no visits

Run both queries concurrently:
```ts
const [clinics, patients] = await Promise.all([
  prisma.clinic.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  prisma.patient.findMany({ ... }),
]);
```

No new API routes. All data serialised and passed as props to `RecordsTable`.

### Date serialisation (required)

Next.js will throw if `DateTime` Prisma values are passed directly to a client component. Convert all DateTime fields to ISO strings before passing as props. Fields that need serialisation:

| Field | Nullable? |
|-------|-----------|
| `patient.dateOfBirth` | No |
| `patient.insuranceCommencementDate` | Yes |
| `patient.petDateOfBirth` | Yes |
| `episode.startDate` | No |
| `clinicalUpdate.dateOfVisit` | Yes |

Pattern: `field?.toISOString() ?? null` for nullable fields, `field.toISOString()` for required ones.

### Prisma query shape

```ts
const [clinics, patients] = await Promise.all([
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
  }),
]);
```

---

## Filters (client-side)

Three inputs in `RecordsTable.tsx`, all filter the already-loaded dataset — no server round-trips:

| Filter | Type | Matches on |
|--------|------|-----------|
| Customer name | Text input | `firstName + " " + lastName` (case-insensitive) |
| Pet name | Text input | `petName` (case-insensitive) |
| Vet clinic | Dropdown | `episodes[0].clinic.name` exact match; "All clinics" option shows all |

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

Do **not** add `adminOnly: true` — omitting the property means the link passes the existing `!link.adminOnly || isAdmin` filter for all authenticated users. This is the correct pattern for non-admin links in this codebase.

---

## Out of Scope

- Full visit history (most recent only)
- Export / CSV download
- Pagination (3 demo records)
- Edit / write operations (read-only page)
- Cross-clinic visit comparison
