# Manual Verification Checklist

## Prerequisites
1. Set `DATABASE_URL` in `.env` to your Neon Postgres connection string
2. Set `NEXTAUTH_SECRET` to a secure random string (generate with `openssl rand -base64 32`)
3. Run `npx prisma migrate dev` to create/update database tables
4. Run `npm run db:seed` to populate seed data
5. Run `npm run dev` to start the development server

---

## Milestone 1 — Core Setup

### Login Flow
- [ ] Navigate to `http://localhost:3000` — should redirect to `/login`
- [ ] Login page shows "Kinetic" branding with gold logo
- [ ] Login page shows "Shared Patient History" subtitle
- [ ] Enter invalid credentials — should show "Invalid email or password." error
- [ ] Enter valid credentials (`alice@cityphysio.com` / `password123`) — should redirect to `/dashboard`

### Dashboard (Clinician View)
- [ ] Dashboard shows "Shared Patient History" heading
- [ ] Dashboard shows gold "Contribute Updates to Unlock Patient History" banner
- [ ] Dashboard shows a "Clinics" table with 3 rows
- [ ] Each clinic row shows the clinic name and opt-in status badge
- [ ] "City Physio" shows "Opted In" (green badge)
- [ ] "Harbour Health" shows "Not Opted In" (gray badge)
- [ ] "Summit Rehabilitation" shows "Opted In" (green badge)
- [ ] **No toggle column** is visible for clinician users
- [ ] Navbar shows "Kinetic" logo and "Dashboard" link (active/highlighted)
- [ ] "Sign out" button in navbar logs the user out and redirects to `/login`

### Data Persistence
- [ ] After login + viewing dashboard, stop the dev server (`Ctrl+C`)
- [ ] Restart the dev server (`npm run dev`)
- [ ] Navigate to dashboard — data still shows 3 clinics with correct opt-in status

---

## Milestone 2 — Admin Opt-In Toggle

### Admin Toggle (Admin View)
- [ ] Sign out and log in as admin: `carol@summitrehab.com` / `password123`
- [ ] Dashboard shows a **Toggle column** with toggle switches for each clinic
- [ ] "City Physio" toggle is **on** (green)
- [ ] "Harbour Health" toggle is **off** (gray)
- [ ] "Summit Rehabilitation" toggle is **on** (green)

### Toggle Behavior
- [ ] Click the toggle for "Harbour Health" — toggle turns green (opted in)
- [ ] The status badge text updates (no page reload needed)
- [ ] Refresh the page — "Harbour Health" still shows as "Opted In"
- [ ] Click the toggle again — turns gray (not opted in)
- [ ] Refresh — "Harbour Health" shows "Not Opted In"

### Authorization
- [ ] Log in as clinician (`alice@cityphysio.com`) — no Toggle column visible
- [ ] Manually call `PATCH /api/clinics/<id>` without auth — returns 401
- [ ] Manually call `PATCH /api/clinics/<id>` as clinician — returns 403

### SimulationEvent
- [ ] After toggling, verify in Neon console that `SimulationEvent` table has a row with:
  - `type` = `TOGGLE_OPT_IN`
  - correct `clinicId` and `userId`
  - `metadata` contains `previousStatus` and `newStatus`

---

## Milestone 3 — Episodes & Clinical Updates

### Create Episode
- [ ] Log in as clinician (`alice@cityphysio.com` / `password123`)
- [ ] Dashboard shows an "Episodes" section with a "+ Create Episode" button
- [ ] Click "+ Create Episode" — form expands with Patient, Reason, Start Date fields
- [ ] Patient dropdown shows "John Smith"
- [ ] Fill in reason "Lower back pain assessment" and click "Create Episode"
- [ ] Episode appears in the list showing patient name, reason, and start date
- [ ] Click "Cancel" — form collapses without creating an episode

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
- [ ] `POST /api/episodes` with non-existent patient — returns 404
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

## Milestone 5 — Access Policy & Shared Patient History

### Access Policy (Opt-In Check)
- [ ] Log in as `alice@cityphysio.com` (City Physio, opted in)
- [ ] Create an episode + add a clinical update (to set `lastContributionAt`)
- [ ] On the episode card, click "View Shared History"
- [ ] If no other clinic has contributed updates for that patient → denial panel shows "NO_SNAPSHOT" with explanation
- [ ] Log in as admin (`carol@summitrehab.com`), toggle City Physio opt-in **off**
- [ ] Log back in as Alice, click "View Shared History" → denial panel shows "OPTED_OUT" with explanation
- [ ] Toggle City Physio opt-in back **on** via admin

### Access Policy (Contribution Expiry)
- [ ] With City Physio opted in and `lastContributionAt` set to today, click "View Shared History"
- [ ] Access decision is based on contribution recency (within 30 days = allowed if snapshot exists)
- [ ] To test expiry: in Neon console, manually set `lastContributionAt` to 31+ days ago
- [ ] Refresh and click "View Shared History" → denial panel shows "INACTIVE_CONTRIBUTOR" with explanation
- [ ] Reset `lastContributionAt` to current date to restore access

### Snapshot Data (Allowed Access)
- [ ] Set up: Log in as `bob@harbourhealth.com`, create an episode for the same patient, add a clinical update
- [ ] Log in as `alice@cityphysio.com` (ensure City Physio is opted in + recently contributed)
- [ ] Click "View Shared History" on the episode for that patient
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

## Seed Data Reference
| Entity  | Count | Details |
|---------|-------|---------|
| Clinics | 3     | City Physio (opted in), Harbour Health (not opted in), Summit Rehabilitation (opted in) |
| Users   | 3     | alice@cityphysio.com (clinician), bob@harbourhealth.com (clinician), carol@summitrehab.com (admin) — all password: `password123` |
| Patients| 1     | John Smith, DOB 1985-03-15, assigned to City Physio |
