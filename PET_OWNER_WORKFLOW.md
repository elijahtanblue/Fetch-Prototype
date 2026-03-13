# Pet Owner Mobile Workflow (for Fetch insurance use case)

## Goal
Design a **pet-side workflow** where owners keep core rehab/medical records on their phone and can share them with physiotherapists, while reusing the current clinician fields already captured in this app.

## Existing clinician data we should reuse
From the current workflow, clinics already capture:
- Pet profile details (currently stored in `Patient` model): first/last name, date of birth, owner phone.
- Visit context: reason for visit, start date.
- Clinical update fields: pain region, diagnosis, treatment modalities, red flags, precautions, response pattern, suggested next steps, date of visit, summary/notes.
- Sharing controls: clinic opt-in + per-pet sharing consent.

## Proposed mobile-first pet owner workflow

### 1) Owner enrollment (phone)
1. Owner receives SMS invitation from clinic after first visit.
2. Owner opens a secure link and verifies with OTP (owner phone number already present in profile).
3. Owner sees their pet profile and can confirm demographic details.

### 2) Owner document wallet
1. App shows a **Pet Health Wallet** timeline grouped by visit date.
2. For each visit/update, show a patient-friendly card generated from current clinician fields:
   - **Visit reason**
   - **Diagnosis**
   - **Treatment done** (modalities)
   - **Important warnings** (red flags + precautions)
   - **How the pet responded** (response pattern)
   - **What to do next** (suggested next steps)
   - **Clinician summary notes**
3. Owner can download/export each entry as PDF and keep it offline.

### 3) Sharing with another physiotherapist
1. In wallet, owner taps **Share pet records**.
2. Owner chooses share mode:
   - **One-time QR code** (valid 15 minutes)
   - **Secure link** (expires in 24h)
   - **Persistent consent for specific clinic**
3. Receiving physiotherapist scans/opens and gets scoped access to the same snapshot data already provided by `/api/snapshots/[patientId]`.

### 4) Consent + insurance controls
1. Owner can toggle sharing ON/OFF at pet level (maps to existing consent model).
2. Owner sees an access log: which clinic accessed records and when.
3. Owner can revoke any active share instantly.

### 5) Follow-up loop
1. After each new clinician update, owner gets push/SMS: “New rehab update added for <pet name>”.
2. Owner can complete lightweight follow-up checklist (optional extension):
   - appetite/activity trend
   - pain behavior observed at home
   - adherence to exercises/plan
3. Clinician sees owner feedback in next visit prep.

## Suggested MVP scope (fastest path)
1. Keep current backend schema intact (internal `patient` naming can remain technical debt for now).
2. Add owner-auth endpoint (OTP by phone) + owner session role.
3. Add `/owner/wallet` page that renders snapshot/episode+update data in mobile layout.
4. Add share token table (`ShareToken`) with expiration + audit events.
5. Reuse current consent toggle semantics but expose owner controls in mobile UI.

## Security and privacy requirements
- OTP + short session expiry for owner logins.
- Share tokens must be signed, revocable, and time-bound.
- Audit every read access (`who`, `when`, `pet`, `source`).
- Do not expose internal clinic notes beyond configured tier.
- Enforce clinic opt-in + consent checks exactly as current policy does.

## Why this fits Fetch (pet insurance)
- Makes care history portable across providers and emergency visits.
- Reduces repeated diagnostics and claim friction.
- Creates structured, timestamped evidence for claim validation.
- Improves owner trust with transparent sharing controls.
