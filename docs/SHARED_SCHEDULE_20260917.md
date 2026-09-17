# Shared mobile/desktop schedule — 2026-09-17

## User requirement
The administrator app has ONE shared Cloudflare state, not a PC master and not a phone master. Either device can register, edit or delete customers/appointments. Other connected devices must converge to the committed state. Local storage is a durable pending/recovery copy, not a second independent server.
Existing desktop, phone and legacy-server copies must all be preserved and reconciled. A common verified baseline is required to distinguish missing records from intentional deletions. Do not silently select one device, blindly union stale backups, or discard a conflicting version. Review individual unresolved conflicts before constructing the final import dataset.

## Implemented in this continuation
- Cloudflare transactions retry an explicit revision conflict up to four total attempts. Each attempt reads current state and reruns the caller's conditional merge; it never blindly replays the obsolete entire document.
- Semantic conflicts, invalid acknowledgements, authentication errors and unknown write outcomes do not use that automatic retry path. Existing local intent/recovery handling remains.
- Failed polling retains its unsubscribe handle. Retry no longer leaks duplicate subscriptions; normal polling can recover without reloading the app.
- Missing, malformed or failed reads revoke readiness while preserving the displayed customer data and pending intent.
- Existing fixed STUDIO namespace, CAS/idempotency, private R2 and Access checks remain unchanged.

## Verification
- Default regression suite: 77 passed, 0 failed, 0 skipped (five added tests).
- Added tests cover real transport logic with a controlled CAS race, bounded rejection retries, subscriber lifecycle, read-readiness and offline pending-intent convergence without resurrecting a deleted schedule.
- Existing actual local Cloudflare Worker/SQLite DO/R2 suite, product gates, build and production-config dry-run passed.
- Existing actual-app Chrome suite re-executed: 67 checks passed; desktop/mobile schedule cell registration in both directions, deletion/reload retention and layout checks. Physical phone and production data remain unverified.
- Writing the additional real-browser simultaneous-commit/offline-scenario extension was blocked by tool security-state evaluation. That extension was not applied or run. Unit-level race coverage is not represented as new real-browser race coverage.

## Release and data boundary
No production import, activation, customer overwrite, Firebase modification, permissions change or deployment-lock change occurred. This continuation does not turn the local result into production migration acceptance.
Independent static source review was attempted; use the completed report only when present. A timeout or provider connection error is not approval.
Evidence: `C:\Users\Administrator\Documents\HANDOFF-2026-09-16\evidence\04-shared-schedule-20260917`.
API reference: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ (transactional, strongly consistent instance storage).

## Independent result
The source-only independent reviewer completed successfully (exit 0) and found no actionable newly introduced correctness, lost-update or privacy defects in the supplied `cf-transport.js`/`vs-sync.js` delta and context. This is a static review, not a separately executed browser test or approval of the entire inherited production cutover. The exact input hash and result are saved as `review-input.sha256` and `review-result.txt` in the evidence directory.
