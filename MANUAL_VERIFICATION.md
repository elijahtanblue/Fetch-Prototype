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

## Seed Data Reference
| Entity  | Count | Details |
|---------|-------|---------|
| Clinics | 3     | City Physio (opted in), Harbour Health (not opted in), Summit Rehabilitation (opted in) |
| Users   | 3     | alice@cityphysio.com (clinician), bob@harbourhealth.com (clinician), carol@summitrehab.com (admin) — all password: `password123` |
| Patients| 1     | John Smith, DOB 1985-03-15, assigned to City Physio |
