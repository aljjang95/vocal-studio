# Administrator schedule: sync, design, Cloudflare — 2026-09-17

Correct product: `aljjang95/vocal-studio`, the customer and lesson scheduling administrator app. This is not HLB-Clone-Avatar-Academy.
Baseline: `70a105cf7203c0650e030f895c7df120afa6ed8d` on `feat/cloudflare-unified-vocal-20260915`.

## Changes
- Cloudflare transport rejects login HTML, malformed state and incorrect commit acknowledgements instead of reporting success or treating them as an empty database.
- Only explicit missing-state responses mean an empty destination. Reads use no-store, reject redirects, and have a 20-second abort deadline.
- Unsubscribed pollers cancel their requests and cannot deliver late data/errors. Commit admission uses its own snapshot mode rather than another request's global mode.
- Added the inherited transport regression suite to the default test command: previously 3 passed/7 failed, now 10 passed.
- Redesigned the active administrator shell, today/customer cards, controls and sync status. Scoped styles supersede conflicting seasonal rules without modifying customer state.
- Corrected initial/current page titles, mobile heading clipping, active-button contrast and disabled viewport zoom restriction.
- Expanded actual-app browser checks to assign calendar cells in both directions, preserve appointment deletion across reload, and retain customers when an expired-login HTML response arrives.

## Verification
- Node regression suite: 72 passed, 0 failed, 0 skipped.
- Actual local Wrangler Worker + SQLite Durable Object + R2 checks: passed.
- Product/static gates and production configuration dry-run: passed; eight allowed assets; deployment lock remains false.
- Installed Chrome with desktop 1440 and independent emulated mobile 390/360: 67 checks passed, 0 page errors.
- Populated today, schedule, customers, logs, payments and consultation screens fit their viewport; headings are inside their headers. Screenshots wait for transitions to finish.
- Synthetic QA customers only. This does not certify physical-phone behavior, real Cloudflare Access login/logout, or production customer cutover.

## Migration and release boundary
The existing Cloudflare-only target (Worker/SQLite DO/private R2/Access) is preserved. No production data was imported, activated, overwritten, combined or deleted. Firebase was not changed.
Follow `OPERATIONS.md`: preserve divergent device copies, identify the authoritative source, checkpoint legacy writers, map media, stage an empty destination and compare principal-bound readback/counts/hashes before activation. Source merge does not authorize customer cutover.
Independent repository-execution review encountered a local sandbox ACL initialization failure and timed out. Its result is not approval. A source-only static review is recorded separately when completed.
Evidence: `C:\Users\Administrator\Documents\HANDOFF-2026-09-16\evidence\04-admin-schedule-20260917`.
