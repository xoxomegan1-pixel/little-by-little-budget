# Security and privacy

This review copy intentionally excludes the live `public/firebase-config.js`, authentication
credentials, service-account keys, `.env` files, user exports, and any personal financial records.

- GitHub repository should be **private**; invite only a trusted reviewer.
- Never upload exported budget JSON, bank statements, pay stubs, passwords, API secret keys,
  Firebase service-account JSON, GitHub tokens, or files from a working browser profile.
- Firebase **browser web configuration** is different from a service-account secret. This
  repository still excludes it to minimize unnecessary deployment coupling.
- The `.gitignore` is defense in depth, not a guarantee: review staged files before each commit.
- Authentication and per-user Firestore rules are essential; never use `allow read, write: if true`.
- The reference Firestore rules in this repo are not automatically deployed.
- Cloud sync uses last-write-wins for overlapping changes. Review behavior across multiple devices.
- Before any production deployment, export a private budget backup, compare against the latest
  known-good source, and deploy Hosting only unless deliberate security-rule migrations are needed.
- Avoid posting live configuration, personal account emails, or financial records in public issues.

**If any actual secret is committed by mistake:** remove it from the repository *and history*,
rotate/revoke the credential, and verify GitHub access logs; deleting one visible file is insufficient.
