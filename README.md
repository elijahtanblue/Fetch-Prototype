# Heidi-Project

Prototype for a shared **pet history** workflow across physiotherapy clinics, with access earned through clinical contribution and owner-controlled sharing.

See `PET_OWNER_WORKFLOW.md` for the proposed pet-owner mobile workflow and rollout plan.


## Deployment env vars

- `DATABASE_URL`: Neon/Postgres connection string used by Prisma.
- `AUTH_SECRET` (preferred) or `NEXTAUTH_SECRET` (legacy fallback): Auth.js secret for production.
- `NEXTAUTH_URL` or `AUTH_URL` (optional on Vercel if auto-detected): deployment URL.

> Note: environment variable names are case-sensitive in Vercel/Linux. Prefer the exact uppercase names: `DATABASE_URL`, `AUTH_SECRET`, and `NEXTAUTH_URL`.

### If `password123` login fails on deployment

Run this against the same Neon database used by the app to (re)create/update the 3 demo users with password `password123`:

```bash
npm run db:seed:auth
```

This script is non-destructive: it upserts demo clinics/users and resets only the demo user passwords.
