# Vocal Studio customer synchronization — 2026-09-16

## Correct project and scope
This is `aljjang95/vocal-studio`, not `HLB-Clone-Avatar-Academy` or its public-guide PR #31.
The inherited Cloudflare migration was uncommitted on `feat/cloudflare-unified-vocal-20260915`, based on `692299743ffde2b362d5fd5589449a97d59290e9` (the prior client-sync candidate in PR #2).
The target is one SQLite Durable Object for shared customer/schedule state, private R2 media, and Cloudflare Access. Browser-local state is recovery material, not an independent authoritative server.

## Reproduced and fixed in this resume
- Real local Wrangler returned HTTP 500 for customer commits: raw `BEGIN IMMEDIATE` was unsupported by Durable Object SQL. The record and idempotency receipt now use `storage.transactionSync()`.
- Async request parsing and hashing could interleave stale reads. The complete state operation is now serialized with `blockConcurrencyWhile()`, including empty-destination imports and revision checks.
- Async errors escaped the route catch. Awaited dispatch now returns structured errors.
- Concurrent distinct uploads to one R2 pointer both succeeded before the fix. Conditional `If-None-Match: *` creation prevents overwriting; identical content retries recover as idempotent success.
- Customer state responses prohibit caching. Local-test authentication is restricted to loopback hosts.
- The broken dependency junction was recorded and removed without deleting its target. `npm ci` restored the declared dependencies; no lockfile dependency upgrade was made.

## Verification performed
| Check | Result |
| --- | --- |
| Unit/regression tests | 62 passed, 0 failed, 0 skipped |
| Real local Worker + SQLite DO + R2 checks | 32 passed |
| Static/product invariants | 90 passed |
| Installed Chrome browser checks | 25 passed, 0 page errors |
| Build and production-config dry-run | Passed; exactly 8 allowlisted assets |

Browser evidence includes two independent desktop/mobile contexts using the actual app and local Cloudflare storage: desktop customer edit to mobile, mobile edit to desktop, reload persistence, and server readback of both fields. Mobile viewports are 390x844 and 360x800. These are simulated devices and synthetic QA data, not a physical phone or production customer migration.
The new executable state regressions also cover concurrent imports, ten competing CAS writers, concurrent exact retries, rollback after receipt-storage failure, principal-bound activation, error handling, and private response caching.

## Release status — not a production cutover
A fresh read-only Codex review was attempted and interrupted by model-capacity errors (with local provider/MCP connection errors); it produced no approval. Prior review notes are not a review of this exact candidate. Existing review concerns beyond this resume, including calendar support beyond the embedded holiday range, remain separate review items.
`DEPLOYMENT_ENABLED=false` and `scripts/deploy-locked.mjs` remain unchanged. No production upload, customer import/activation, permissions change, Firebase data deletion, or GitHub Actions/workflow execution was performed.
Read-only deployment history still identified Worker version `b85fc736-1d0e-4e0e-9b5c-e87f0ee8d6b2` at 100%, created 2026-09-14T17:24:05Z. This is not the current local candidate.

Before cutover, follow `docs/OPERATIONS.md`: identify the authoritative customer source, preserve every divergent device copy, freeze/checkpoint legacy writers, establish media mapping, stage only an empty destination, compare principal-bound server readback/counts/hashes, then activate only the verified state. Real Access login/logout, physical-phone validation, independent review, and exact-reviewed release approval remain outstanding. Do not automatically union recovery snapshots or assume desktop is newer than phone.

## Evidence and replay
`docs/CLOUDFLARE_VERIFICATION_20260916.json` records counts and normalized source hashes.
Local evidence: `C:\Users\Administrator\Documents\HANDOFF-2026-09-16\evidence\04-studio-sync-204358` (initial source ZIP/patch/hashes, RED/GREEN logs, browser screenshots, dry-run and interrupted review).
Replay: `npm test`, `npm run test:cloudflare`, `npm run gate`, `python scripts/verify-sync-browser.py`, `npm run dry-run`.
No confidential recovery exports are part of this source commit.

## API references used
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ — supported synchronous storage transactions.
- https://developers.cloudflare.com/durable-objects/api/state/ — concurrency blocking.
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/ — conditional object writes and null on precondition failure.
