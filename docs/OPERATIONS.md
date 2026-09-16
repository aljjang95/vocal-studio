# Vocal Studio Cloudflare unified operations

Status: **candidate only**. Repository merge and production cutover are separate gates.

## Canonical runtime

The target runtime is one Cloudflare system:

- Cloudflare Access authenticates the admin before application assets or APIs are served.
- Worker Static Assets serves exactly the allowlisted PWA/runtime files.
- Worker APIs expose session, state, commit, protected migration readback, and private media access.
- one SQLite Durable Object (`STUDIO`) is the canonical schedule/lesson/consult/payment/inquiry state.
- private R2 (`MEDIA`) stores recordings, videos, and photos.
- Firebase, GitHub Pages, FullCalendar CDN, and Google Calendar API are not active runtime dependencies.
- GitHub Actions are not part of the release path.

## Local verification

Run before staging a repository candidate:

```powershell
npm.cmd test
node --test scripts/review-regressions.test.mjs
node scripts/test-cloudflare.mjs
python scripts/verify-sync-browser.py
node scripts/regression-gates.mjs
git diff --check
npm.cmd run build
node_modules\.bin\wrangler.cmd deploy --dry-run --outdir tmp\cf-evidence\dry-run
```

`verify-sync-browser.py` opens the actual app against local Wrangler/SQLite DO/R2 in Chrome at desktop 1440 and emulated mobile 390/360 widths. It is **not** physical-phone evidence.

## Protected production cutover

The repository candidate is intentionally locked with `DEPLOYMENT_ENABLED=false`; `npm run deploy` throws. Do not remove either lock as part of ordinary repository merge.

Production cutover requires a separately approved run with all of the following evidence:

1. choose the authoritative customer source; never union recovery snapshots automatically.
2. extract legacy media and establish its R2 pointer mapping when media exists.
3. stage import only into an empty Cloudflare destination.
4. obtain a private server export/readback from the same Access principal.
5. compare counts and canonical hashes against the authoritative source.
6. activate only the staged state whose recent principal-bound readback matches.
7. verify real Cloudflare Access login and logout.
8. dogfood on a physical phone; viewport emulation is insufficient.
9. obtain exact release approval for the reviewed HEAD.
10. deploy only that exact reviewed HEAD and retain the prior Worker version for rollback.

Do not automatically import or activate customer data, delete Firebase data/media, change Cloudflare permissions, export OAuth credentials, or create GitHub Actions.

## State and recovery rules

- First load never creates/bootstrap-writes a missing canonical state.
- imports are empty-destination-only and start in `staged` read-only mode.
- active writes use revision CAS plus request-ID idempotency.
- unknown root fields survive compatible updates.
- stale clients cannot silently resurrect a conflicting schedule deletion.
- an unhydrated reload can reuse local state only when its owner marker equals the authenticated principal.
- if durable local state differs from a pending journal, the journal copy becomes recovery evidence, durable local data remains displayed, and automatic write is blocked until an explicit resolution.
- queued R2 media remains visible/retryable even when schedule state reports synchronized.
- media pointers are immutable; there is no delete API in this candidate.

## Rollback

Repository rollback and production-data rollback are separate actions. A source rollback must not overwrite or delete canonical customer data. For production Worker rollback, select the previously verified Worker version only after confirming that its data protocol is compatible with the current canonical state. Preserve recovery exports and exact release hashes before any rollback.
