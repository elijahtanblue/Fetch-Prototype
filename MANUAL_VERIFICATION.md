# Manual Verification Checklist

## Prerequisites
1. Set `DATABASE_URL` in `.env` to your Neon Postgres connection string (`Database_URL` is also accepted as fallback).
2. Set `AUTH_SECRET` (preferred) or `NEXTAUTH_SECRET` (legacy, uppercase). `Nextauth_secret` is accepted as fallback.
3. Run `npx prisma migrate dev` to create/update database tables
4. Run `npm run db:seed` to populate seed data
5. Run `npm run dev` to start the development server
6. If demo login fails, run `npm run db:seed:auth` against the same database to ensure demo credentials

---

## Milestone 1 — Core Setup

### Login Flow
- [ ] Navigate to `http://localhost:3000` — should redirect to `/login`
- [ ] Login page shows "Kinetic" branding with gold logo
- [ ] Login page shows "Shared Pet History" subtitle
- [ ] Enter invalid credentials — should show "Invalid email or password." error
- [ ] Enter valid credentials (`edsun@diversus.com` / `password123`) — should redirect to `/dashboard`

### Dashboard (Clinician View)
- [ ] Dashboard shows "Shared Pet History" heading
- [ ] Dashboard shows gold "Contribute Updates to Unlock Pet History" banner
- [ ] Dashboard shows a "Clinics" table with 3 rows
- [ ] Each clinic row shows the clinic name and opt-in status badge
- [ ] "City Physio" shows "Opted In" (green badge) with toggle (own clinic)
- [ ] "Harbour Health" shows "Not Opted In" (gray badge, no toggle — not own clinic)
- [ ] "Summit Rehabilitation" shows "Opted In" (green badge, no toggle — not own clinic)
- [ ] Navbar shows "Kinetic" logo and "Dashboard" link (active/highlighted)
- [ ] "Sign out" is a gold button in the navbar — clicking it clears session and redirects to login page

### Data Persistence
- [ ] After login + viewing dashboard, stop the dev server (`Ctrl+C`)
- [ ] Restart the dev server (`npm run dev`)
- [ ] Navigate to dashboard — data still shows 3 clinics with correct opt-in status

---

## Milestone 2 — Opt-In Toggle

### Clinician Toggle (Own Clinic Only)
- [ ] Log in as `edsun@diversus.com` (City Physio clinician)
- [ ] Toggle is visible ONLY on "City Physio" row (own clinic)
- [ ] Other clinics show read-only status badge (no toggle)
- [ ] Click toggle on City Physio — status updates dynamically
- [ ] Refresh — toggle state persists

### Admin Toggle (All Clinics)
- [ ] Log in as `elijah@admin.com` (admin)
- [ ] Toggle switches visible on ALL 3 clinics
- [ ] Can toggle any clinic's opt-in status

### Authorization
- [ ] `PATCH /api/clinics/<id>` without auth → 401
- [ ] `PATCH /api/clinics/<id>` as clinician for OTHER clinic → 403
- [ ] `PATCH /api/clinics/<id>` as clinician for OWN clinic → 200
- [ ] `PATCH /api/clinics/<id>` as admin for ANY clinic → 200

### SimulationEvent
- [ ] After toggling, verify in Neon console that `SimulationEvent` table has a row with:
  - `type` = `TOGGLE_OPT_IN`
  - correct `clinicId` and `userId`
  - `metadata` contains `previousStatus` and `newStatus`

---

## Milestone 3 — Episodes & Clinical Updates

### Add Pet Visit
- [ ] Log in as `edsun@diversus.com`
- [ ] Dashboard shows a "Pet Visits" section with a "+ Add Pet Visit" button
- [ ] Click "+ Add Pet Visit" — form expands with Pet, Reason, Start Date fields
- [ ] Pet dropdown shows "John Smith" and "Winston Liang"
- [ ] Fill in reason "Lower back pain assessment" and click "Add Visit"
- [ ] Visit appears in the list showing pet name, reason, and start date
- [ ] Click "Cancel" — form collapses without creating a visit

### Add Clinical Update
- [ ] On an existing episode, click "+ Add Update"
- [ ] Form expands with Pain Region, Diagnosis, Treatment Modalities, Red Flags, Notes fields
- [ ] Fill in: Pain Region = "Lower back, L4-L5", Diagnosis = "Lumbar disc herniation", Treatment = "Manual therapy, exercise prescription"
- [ ] Check "Red Flags Present" checkbox
- [ ] Click "Save Update" — update appears under the episode with red flag badge
- [ ] Add another update without red flags — appears without red flag badge

### API Validation
- [ ] `POST /api/episodes` without auth — returns 401
- [ ] `POST /api/episodes` with missing `patientId` — returns 400
- [ ] `POST /api/episodes` with non-existent pet profile — returns 404
- [ ] `POST /api/updates` without auth — returns 401
- [ ] `POST /api/updates` with missing `painRegion` — returns 400
- [ ] `POST /api/updates` with non-existent episode — returns 404

### Contribution Timestamp
- [ ] After adding a clinical update, verify in Neon console that the clinic's `lastContributionAt` is set

### SimulationEvents
- [ ] After creating an episode, verify `SimulationEvent` with `type` = `VISIT` exists
- [ ] After adding a clinical update, verify `SimulationEvent` with `type` = `CLINICAL_UPDATE` exists
- [ ] Both events have correct `clinicId`, `userId`, and `metadata`

---

## Milestone 5 — Access Policy & Shared Pet History

### Access Policy (Opt-In Check)
- [ ] Log in as `edsun@diversus.com` (City Physio, opted in)
- [ ] Create an episode + add a clinical update (to set `lastContributionAt`)
- [ ] On the episode card, click "View Shared History"
- [ ] If no other clinic has contributed updates for that pet → denial panel shows "NO_SNAPSHOT" with explanation
- [ ] Toggle City Physio opt-in **off** (own clinic toggle)
- [ ] Click "View Shared History" → denial panel shows "OPTED_OUT" with explanation
- [ ] Toggle City Physio opt-in back **on**

### Access Policy (Contribution Expiry)
- [ ] With City Physio opted in and `lastContributionAt` set to today, click "View Shared History"
- [ ] Access decision is based on contribution recency (within 30 days = allowed if snapshot exists)
- [ ] To test expiry: in Neon console, manually set `lastContributionAt` to 31+ days ago
- [ ] Refresh and click "View Shared History" → denial panel shows "INACTIVE_CONTRIBUTOR" with explanation
- [ ] Reset `lastContributionAt` to current date to restore access

### Snapshot Data (Allowed Access)
- [ ] Set up: Log in as `edzhang@diversus.com`, create an episode for Winston Liang, add a clinical update
- [ ] Log in as `edsun@diversus.com` (ensure City Physio is opted in + recently contributed)
- [ ] Click "View Shared History" on the episode for that pet
- [ ] Snapshot panel shows shared records from "Harbour Health" (not from City Physio)
- [ ] Snapshot entry shows clinic name, pain region, diagnosis, treatment modalities, red flags
- [ ] Click "Hide Shared History" to collapse the panel

### Denial Panel Rendering
- [ ] When access is denied, panel shows amber background with "Access Denied" badge
- [ ] Denial panel shows the reason code (e.g., "OPTED_OUT")
- [ ] Denial panel shows a human-readable explanation

### API Validation
- [ ] `GET /api/snapshots/<patientId>` without auth → returns 401
- [ ] `GET /api/snapshots/<patientId>` with opted-out clinic → returns `accessDecision: "denied"`, `reasonCode: "OPTED_OUT"`
- [ ] `GET /api/snapshots/<patientId>` with expired contribution → returns `reasonCode: "INACTIVE_CONTRIBUTOR"`
- [ ] `GET /api/snapshots/<patientId>` with no shared data → returns `reasonCode: "NO_SNAPSHOT"`
- [ ] `GET /api/snapshots/<patientId>` with all conditions met → returns `accessDecision: "allowed"` + `snapshot` array

### Architecture Verification
- [ ] `domain/policy/access.ts` has NO Prisma imports
- [ ] Snapshot endpoint imports and calls `evaluateAccess` from `domain/policy/access`
- [ ] No other file reimplements access decision logic (no inline optedIn/lastContributionAt checks)

---

## Milestone 6 — Simulation System

### Admin Access
- [ ] Log in as `elijah@admin.com` (admin)
- [ ] Navbar shows "Check Access" link
- [ ] Click "Check Access" — navigates to `/check-access`
- [ ] Page shows "Check Access Console" heading
- [ ] Non-admin users (e.g. `edsun@diversus.com`) cannot access `/check-access` — redirected to `/dashboard`

### Pet Transfer Demo (A → B Scenario)
- [ ] Select "City Physio" from Acting Clinic dropdown
- [ ] Click "Toggle Opt-In" — event appears in Event Log, result shows "Opted In"
- [ ] Select "John Smith" from Pet dropdown
- [ ] Click "Simulate Visit" — result shows episode created
- [ ] Click "Add Clinical Update" — result shows update added
- [ ] Switch Acting Clinic to "Harbour Health"
- [ ] Click "Toggle Opt-In" — Harbour Health now opted in
- [ ] Click "Simulate Visit" for John Smith
- [ ] Click "Add Clinical Update"
- [ ] In "Check Access Decision" section: select "City Physio" as Viewing Clinic + "John Smith"
- [ ] Click "Check Access" → shows **Allowed** (green badge)
- [ ] Select "Harbour Health" as Viewing Clinic + "John Smith"
- [ ] Click "Check Access" → shows **Allowed** (green badge)

### Opt-Out Denies Access
- [ ] Switch Acting Clinic to "Harbour Health"
- [ ] Click "Toggle Opt-In" — Harbour Health now opted out
- [ ] In Check Access: select "Harbour Health" + "John Smith"
- [ ] Click "Check Access" → shows **Denied** with `OPTED_OUT` reason code
- [ ] In Check Access: select "City Physio" + "John Smith"
- [ ] Click "Check Access" → still **Allowed** (Harbour Health's prior data still visible)

### Replay
- [ ] Click "Replay All Events" — Replay Timeline appears
- [ ] Timeline shows numbered steps with event type and access decision at each step
- [ ] Access decisions in replay match what was observed live

### SimulationEvents
- [ ] In Event Log, verify events include `TOGGLE_OPT_IN`, `VISIT`, and `CLINICAL_UPDATE` types
- [ ] Click "Refresh" — events list updates

### Architecture Verification
- [ ] `domain/services/simulation.ts` imports `evaluateAccess` from `domain/policy/access`
- [ ] `domain/services/simulation.ts` does NOT contain inline access checks (no `optedIn` boolean comparisons)
- [ ] All simulation API endpoints (`/api/simulation/*`) check `role === "admin"`

---

## Sign-Out Verification
- [ ] "Sign out" button is gold/prominent in the navbar (not plain text)
- [ ] Clicking "Sign out" clears the session and redirects to the current deployment's `/login` page
- [ ] On Vercel deployment (e.g. `https://vercel.com/elijahtanblues-projects/fetch-prototype`), sign-out redirects to the same domain's `/login`
- [ ] On localhost, sign-out redirects to `http://localhost:3000/login`

---

## Seed Data Reference
| Entity  | Count | Details |
|---------|-------|---------|
| Clinics | 3     | City Physio (opted in), Harbour Health (not opted in), Summit Rehabilitation (opted in) |
| Users   | 3     | edsun@diversus.com (clinician, City Physio), edzhang@diversus.com (clinician, Harbour Health), elijah@admin.com (admin, Summit Rehabilitation) — all password: `password123` |
| Pets| 2     | John Smith (DOB 1985-03-15), Winston Liang (DOB 1990-07-22) — both visible to all clinicians |
