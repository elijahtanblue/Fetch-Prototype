# Milestone 1 — Manual Verification Checklist

## Prerequisites
1. Set `DATABASE_URL` in `.env` to your Neon Postgres connection string
2. Set `NEXTAUTH_SECRET` to a secure random string (generate with `openssl rand -base64 32`)
3. Run `npx prisma migrate dev --name init` to create database tables
4. Run `npm run db:seed` to populate seed data
5. Run `npm run dev` to start the development server

## Verification Steps

### Login Flow
- [ ] Navigate to `http://localhost:3000` — should redirect to `/login`
- [ ] Login page shows "Kinetic" branding with gold logo
- [ ] Login page shows "Shared Patient History" subtitle
- [ ] Enter invalid credentials — should show "Invalid email or password." error
- [ ] Enter valid credentials (`alice@cityphysio.com` / `password123`) — should redirect to `/dashboard`

### Dashboard
- [ ] Dashboard shows "Shared Patient History" heading
- [ ] Dashboard shows gold "Contribute Updates to Unlock Patient History" banner
- [ ] Dashboard shows a "Clinics" table with 3 rows
- [ ] Each clinic row shows the clinic name and opt-in status badge
- [ ] "City Physio" shows "Opted In" (green badge)
- [ ] "Harbour Health" shows "Not Opted In" (gray badge)
- [ ] "Summit Rehabilitation" shows "Opted In" (green badge)
- [ ] Navbar shows "Kinetic" logo and "Dashboard" link (active/highlighted)
- [ ] "Sign out" button in navbar logs the user out and redirects to `/login`

### Data Persistence
- [ ] After login + viewing dashboard, stop the dev server (`Ctrl+C`)
- [ ] Restart the dev server (`npm run dev`)
- [ ] Navigate to dashboard — data still shows 3 clinics with correct opt-in status
- [ ] Verify in Neon console that tables (Clinic, User, Patient) exist with seeded rows

## Seed Data Reference
| Entity  | Count | Details |
|---------|-------|---------|
| Clinics | 3     | City Physio (opted in), Harbour Health (not opted in), Summit Rehabilitation (opted in) |
| Users   | 3     | alice@cityphysio.com, bob@harbourhealth.com, carol@summitrehab.com (all password: `password123`) |
| Patients| 1     | John Smith, DOB 1985-03-15, assigned to City Physio |
