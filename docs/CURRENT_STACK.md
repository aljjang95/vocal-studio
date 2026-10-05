# Current stack — 2026-10-05

Canonical repository: `aljjang95/vocal-studio`. Initial cleanup baseline: `93da7d3f45b07c26db400b734b4c219a090121da`. The current cleanup branch also preserves all five later main commits through `51dc1e105bb81fecce5ec67a625637da74b5943e`; its attempted retired-host configuration update is superseded by the current removal policy.

| Surface | Current source authority |
| --- | --- |
| Admin browser / PWA | `index.html`; `vs-sync.js`, `vs-backup.js`, `cf-transport.js`, `cf-migration.js`, `v2-ui.js`, `v2.css`, `v3-daylight.css`, `sw.js` |
| Published asset inventory | Explicit `assets` array in `scripts/build-worker.mjs`; no `js/`, `css/`, old HTML shell or preview directory is imported/copied |
| API / state | `worker/entry.mjs`, `worker/index.mjs`, `worker/state.mjs` and the Worker modules; Cloudflare Workers with SQLite Durable Object `STUDIO` |
| Media / authentication | Private R2 `MEDIA`; Cloudflare Access JWT verification (`jose`) |
| Cloud configuration | `wrangler.jsonc` (locked candidate), `wrangler.local.jsonc` (local QA), `wrangler.sms-relay.jsonc` (separate relay) |
| Android Studio bridge | `native/android-sms-relay`, `scripts/build-android-sms-relay.ps1`, `sms-manager.js`; private SMS relay plus optional owner-enabled incoming-call intake, adjacent schedule suggestions and fixed browser launch; Windows/Android requirements remain separate from the cloud browser runtime |
| Dependency contract | `package.json` / `package-lock.json`; `jose` and Wrangler 4.131.2 |

## Commands

Install: `npm ci`. Tests: `npm test`, `npm run test:cloudflare`. Invariants: `npm run gate`. Build: `npm run build`. Bundle-only verification: `npm run dry-run` (no live deploy). Local server: `npx wrangler dev --config wrangler.local.jsonc --local --port 18793`; use an unused port if another task owns it. Browser QA: `python scripts/verify-sync-browser.py` after checking its local synthetic-server/port ownership.

Production command `npm run deploy` intentionally throws. Preserve that lock and the customer reconciliation, server readback, real Access login/logout, physical-device verification, independent review and exact reviewed-release approval requirements in `OPERATIONS.md`.

## Current Android/SMS extension

The latest main source adds `worker/schedule-options.mjs`, `worker/studio-privacy.mjs`, optional call-intake routes in `worker/sms.mjs`, and native Android permission/consent/generation safeguards. Read `android-studio-bridge-contract.md`, `android-studio-privacy.md` and the native README alongside the existing SMS contracts. Incoming-call observation does not book a lesson or change customer state without the owner's explicit action. SMS, call settings, credentials and authorization stay owned by the existing source contracts.

Cloud-safe regressions remain `npm test` (now including schedule-options, sms-call and studio-privacy), `npm run test:cloudflare`, `node scripts/test-sms-bridge.mjs`, build/gate/dry-run. The Java/Android package checks require the existing Windows SDK/JDK and dedicated signing owner: `build:android-sms`, `build:android-studio` and `test:android-build` are not Linux cloud startup checks. In particular the signed-builder regression accesses private signing state and must not be invoked by generic source cleanup. Retain the incoming APK bytes without claiming a fresh signature/device/Play/actual SMS/call validation.

## Removed runtime paths

Vercel/Firebase deployment files, their disconnected modular `js/` / `css/` app and old HTML/preview shells, the unused Firebase browser fixture, and obsolete agent plans/active state no longer belong to this source tree. They are not alternative release targets. Existing hosted services and remote data were not changed.

Stored Firebase-form portrait URLs and the protected legacy media/state reconciliation contract remain compatible inputs to the Cloudflare migration. Dated Cloudflare QA reports and historical recovery/data records retain their original revisions and results; none establishes a fresh production cutover.
