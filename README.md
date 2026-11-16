# Little by Little — code review

Private-source handoff for a personal budgeting progressive web app (PWA).

**Source snapshot:** latest version prepared in November 2026, including income & paydays and opening chequing balance. This snapshot has **not** been verified to match the latest live deployment. Do not deploy it over the working website without comparing versions and making a private data backup.

## What the app does

- Month-by-month Planned / Used / Left or Over budgeting
- Expenses and recurring bills; hidden/restorable categories
- Automatic groceries/travel rollovers and monthly user-selected rollover elsewhere
- Annual bill savings pots, including a fixed number of consecutive monthly instalments
- Biweekly paycheque entries, extra income/refunds, and a separate chequing opening balance
- TFSA/FHSA savings goals, spending visualizations, monthly reviews
- Optional Firebase Authentication + Cloud Firestore sync, while keeping local storage

## Contents

- `public/index.html` — core browser app interface and monthly-budget logic
- `public/cloud-sync.js` — Firebase Authentication/Firestore synchronization
- `public/sw.js` & `public/manifest.webmanifest` — installable PWA assets
- `public/icons/` — app icons
- `public/firebase-config.example.js` — **dummy template**, not live settings
- `firebase.json` — Firebase Hosting configuration
- `firestore.rules.reference` — reference-only access rules for discussion; not set to deploy
- `SECURITY.md`, `REVIEW_CHECKLIST.md` — security notes and suggested audit scope

## Local preview

Use a static web server to serve `public/` (e.g. `python -m http.server 8000 --directory public`).
For cloud features, copy `public/firebase-config.example.js` to `public/firebase-config.js`,
insert the browser *web app* configuration from your own Firebase project, and keep the real
file ignored by Git. A placeholder will not enable sign-in. Do not use service-account JSON
in browser code. Live financial data is **not included** here.

**Do not use `firebase deploy` just to preview this review copy.**

## Code review priorities

See [REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md). Please work in a branch or pull request,
not by replacing the live Firebase website. Avoid weakening Firestore security rules.

## Preserving the live data

The financial records live in Firebase and each user's browser. The owner must separately
download the JSON backup through the app's Help & backup menu and keep it **private**.
Never upload that JSON to GitHub, including a private repository.

This is a handoff for review, not a guarantee that the application is free of bugs or security issues.
