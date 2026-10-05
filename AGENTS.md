# Vocal Studio — current runtime

Read `docs/CURRENT_STACK.md` first, then `docs/OPERATIONS.md` and `docs/SYNC_PROTOCOL.md`.

- Canonical application: `index.html` and the explicit asset allowlist in `scripts/build-worker.mjs`; backend: `worker/entry.mjs` / `worker/index.mjs`.
- Runtime: Cloudflare Access, Workers Static Assets, one SQLite Durable Object (`STUDIO`), private R2 (`MEDIA`), and the separate Cloudflare SMS relay / Android SMS bridge.
- Firebase Hosting/Firestore/Storage, Vercel, GitHub Pages, FullCalendar CDN and Google Calendar API are retired deployment/runtime paths. Their deploy configs and disconnected UI sources are removed. Do not reconstruct or investigate those paths during startup, development, QA or release.
- Existing Firebase-form photo strings are data compatibility input mapped to same-origin R2 by `getStudentPhoto`; this does not authorize any Firebase SDK or write path.
- Install from the existing lockfile with `npm ci`. Run `npm test`, `npm run test:cloudflare`, `npm run gate`, `npm run build`, and `npm run dry-run` for relevant changes. Use local/emulated synthetic data; report real customer migration, physical-phone and production checks separately.
- Production is intentionally locked (`DEPLOYMENT_ENABLED=false`, `scripts/deploy-locked.mjs`). Preserve source/data reconciliation, Access, readback, independent review and exact release approval gates in `docs/OPERATIONS.md`.
- Never alter customer data, legacy server copies, recovery exports, OAuth credentials or network/secret settings as part of source cleanup. Secret registration stays with the existing local owner. No GitHub Actions release path.
- Dated verification/release records describe their recorded revisions; they are not startup commands or a current production-completion claim. Historical recovery/data evidence is retained without reading or rewriting it.
