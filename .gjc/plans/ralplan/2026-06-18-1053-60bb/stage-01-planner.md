# RALPLAN-DR Planner Stage 1 — Vocal Studio A-to-Z Upgrade

## Summary
Read-only inspection found the active runtime is the monolithic `index.html`; local `js/*.js` files are not loaded, and `js/app.js` says they are unused. The app embeds real student and inquiry PII, `sw.js` caches `index.html`, `index.html` signs users in anonymously, and `firestore.rules` lets any authenticated user read/write `/studio/{docId}`. The runtime also auto-creates attendance logs from the Today render path, calculates lesson/payment cycles in multiple ways, writes all domain data to one Firestore document, strips media to placeholders, and has incomplete consult/group/schedule modeling.

Priority order for execution: 1) security/auth and remove PII from static bundle, 2) disable automatic attendance mutations, 3) unified lesson/payment cycle service, 4) Firestore split data model and migration, 5) media persistence/recovery, 6) schedule engine v2 and group lessons, 7) regression tests and source-of-truth cleanup.

## Principles
1. Fix data exposure before workflow improvements; public HTML/cache PII is already leaked beyond Firestore rules.
2. Rendering and navigation must never mutate attendance, billing, or payment state.
3. Each business invariant gets one canonical service and tests.
4. Migrations must be export-first, idempotent, auditable, and reversible from a known-good backup.
5. Prefer staged compatibility over a big-bang rewrite while P0 risks exist.

## Top 3 decision drivers
1. Security exposure: anonymous auth plus broad rules plus static PII.
2. Billing correctness: auto attendance and cycle drift can silently change payment status.
3. Migration blast radius: one-document sync, media placeholders, and schedule/group ambiguity require phased cutover.

## Options
### Option A — Security-first staged modernization, recommended
Patch the current runtime first, add tested pure services and repositories, migrate data/media behind compatibility adapters, then resolve module loading.

Pros: fastest P0 risk reduction; phased verification; preserves operator workflow; supports backout. Cons: monolith remains longer; temporary adapters add complexity; stale modules must be controlled. Chosen because security and billing risks cannot wait for a rewrite.

Invalidation: no trusted data export can be made; authorized Firebase access cannot be established; maintainers mandate full module conversion before any release.

### Option B — Big-bang modular rewrite and schema replacement
Replace `index.html` with modules and ship auth, split Firestore, media, schedule, and cycle changes together.

Pros: cleaner end state sooner; fewer temporary adapters. Cons: delays P0 fixes; highest regression risk; backout is hard because runtime and data model change together. Rejected for initial execution.

### Option C — Lockdown-only hotfix
Remove static PII, restrict rules/auth, and disable auto attendance, but defer model/service/media/schedule work.

Pros: fastest emergency slice. Cons: leaves overwrite risk, payment drift, media loss, group ambiguity, and source drift. Valid only as Phase 1 of Option A, not the full upgrade.

## In scope
- Authorized-user auth and least-privilege Firestore/Storage rules.
- Removal of real static PII and old PII-bearing service-worker cache.
- No-write attendance proposal/review workflow.
- Canonical lesson/payment cycle service and payment repair reporting.
- Split Firestore collections, migration tooling, audit metadata, and legacy retirement.
- Durable media persistence and recovery UI.
- Schedule engine v2 for fixed, flex, consult, and group lessons.
- Focused tests and runtime source-of-truth cleanup.

## Out of scope / non-goals
- No broad visual redesign beyond required auth, review, recovery, migration, conflict, and group UI.
- No unrelated CRM, marketing, analytics, or automation features.
- No destructive data cleanup without export, dry-run, approval, and rollback pointer.
- No App Check as authorization; it can only supplement auth.
- No project-wide build/lint/format gate during planning.

## Evidence from inspected files
- `index.html` is active runtime and loads Firebase compat SDKs directly.
- `js/app.js` states the modular entrypoint is unused; `index.html` does not load local `js/*.js` scripts.
- `index.html` embeds `_DEFAULT_STUDENTS` with names and phone numbers; prior assessments also identify embedded inquiry phone numbers.
- `sw.js` precaches `./index.html`.
- `firestore.rules` allows read/write when `request.auth != null`.
- `index.html:initFirebase()` calls anonymous sign-in and listens to `studio/data`.
- `firebase.json` deploys only Firestore rules, while Storage SDK/upload code exists.
- `autoFillPastAttendance()` writes past `출석` logs and calls `saveAll()`.
- `getCycleInfo()` excludes `결석` and `연기`, while payment save uses raw log count for `wn` and stores drifting `cycleNum`.
- Firestore sync writes students, logs, week overrides, consults, payments, and inquiries into one document.
- Media paths strip data to `[saved]`; IndexedDB/localStorage fallback is not durable cross-device storage.
- `getWeekSched()` displays consult confirmed dates, but conversion does not explicitly map those dates to first lesson or overrides.
- `saveFlexWeek()` warns but saves conflicts; `resetWeekOvr()` deletes the whole week override.
- No `package.json` or obvious test files were found.

## File-level changes
### `index.html`
Remove real seed PII; add authorized sign-in gate; stop private render/listeners before auth; replace anonymous auth; route persistence through repositories; convert auto attendance to no-write proposals; route payment/cycle UI through one service; add pending write and audit state; route schedule/consult/group flows through schedule engine v2.

### `firestore.rules`
Replace broad `/studio/{docId}` rules with `/studios/{studioId}` and subcollection rules using authorized UID/custom claims/roles. Validate schemas, immutable fields, allowed field sets, types, studio membership, and legacy-path phase behavior.

### `firebase.json`
Keep Firestore rules; add Storage rules deployment. Add hosting/cache headers if hosting is managed here: no-store or short-cache for `index.html` and `sw.js`, long-cache only for immutable hashed assets.

### `storage.rules`, new
Restrict private media by studio, record, role, size, content type, and ownership metadata. Deny unauthorized list/read/write.

### `sw.js`
Bump version, delete old caches, avoid precaching private HTML/data, and verify old PII-bearing `index.html` is purged after activation.

### `manifest.json`
No major change expected; ensure `start_url` has no user-specific data or tokens.

### `js/**/*.js`
Short term: treat modules as non-runtime or tested pure-service homes only. Medium term: extract canonical cycle, schedule, media, and repository services and load them explicitly. Remove stale duplicate logic after runtime selection.

### `scripts/` and tests
Add migration dry-run/export/import tooling or admin migration UI. Add a minimal focused JS/rules test harness deliberately because no existing package/test setup was found.

## Sequencing and dependencies
### Phase 0 — Baseline and backup
Export current `/studio/data`, Storage metadata, and local recovery snapshots where possible. Inventory counts, duplicates, missing foreign keys, invalid dates, media placeholders, document size, and schema anomalies. Decide owner UID/claims model. Add focused pure-function and rules tests. Capture manual baseline flows.

### Phase 1 — Security/auth and static PII
Remove real static PII; add sign-in/access-denied shell; replace anonymous auth; deploy restrictive Firestore rules; add Storage rules; update service worker to purge old caches. Gate: static scan has no real PII, unauthorized users cannot read/write, old cache is purged.

### Phase 2 — Disable automatic attendance writes
Remove render/navigation write calls. Convert auto-fill to `computeMissingPastAttendance()` returning proposals only. Add review queue with per-item and bulk confirm. Confirmed logs get source, user, timestamp, proposal id, and policy version. Report existing automatic logs for admin review. Gate: opening Today/schedule creates zero writes until confirm.

### Phase 3 — Unified cycle/payment service
Define counted statuses, offsets, frequency-to-cycle-size, edit/delete policy, and historic payment membership. Implement pure functions for effective lessons, current cycle, cycle for lesson, payment status, recomputation, and offset preview. Replace dashboard, payment, profile, timeline, alert, log, and schedule card callsites. Enrich payments with cycle range, cycle size, policy version, and optional lesson ids. Gate: every UI surface reports the same payment state.

### Phase 4 — Split Firestore model and migration
Target collections: `/studios/{studioId}`, `students`, `logs`, `payments`, `consults`, `inquiries`, `weekOverrides` or `scheduleOverrides`, `attendanceProposals`, `auditEvents`, and `media`. Add metadata: schemaVersion, createdAt, updatedAt, updatedBy, deletedAt, revision, source, migratedFrom, legacyHash. Build dry-run migrator with deterministic ids, duplicate detection, referential checks, batch resume, checksums, and idempotence. Dual-read, then cut writes to split collections, freeze legacy writes, and finally deny legacy. Gate: record writes no longer overwrite unrelated data.

### Phase 5 — Media persistence and recovery
Classify photos, audio/video, consent recordings, and attachments. Store required media in Storage with metadata docs; use IndexedDB as upload queue/cache only. Do not replace inline media with `[saved]` until durable commit or explicit local-only degraded state. Add retry ledger, quota errors, unified load path, orphan scan, snapshots, diff preview, and selective restore. Gate: reload/cross-device works or shows explicit recovery state.

### Phase 6 — Schedule engine v2 and group lessons
Define enrollment, member, group, recurring slot, one-off override, absence/cancel, conflict, and consult appointment. Engine returns slots, conflicts, unassigned students, group members, and reason codes. Block conflicts by default or require audited overbook reason. Replace reset with diff-based selected reset. Conversion must explicitly map confirmed consult dates to first lesson, recurring schedule, or one-week override. Group lessons need members, primary payer, per-member contact/attendance, shared slot, and payment ownership. Gate: PC/mobile schedule behavior is consistent and reset preserves unrelated assignments.

### Phase 7 — Source-of-truth cleanup and regression hardening
Choose final runtime: monolith with loaded services or explicit module runtime. Remove/sync stale duplicates. Document runtime source, auth setup, migration operations, recovery drills, and release checklist. Add regressions for every upgraded invariant.

## Migration and backout strategy
1. Export legacy data with timestamp, update time, byte size, SHA-256, and Storage object list.
2. Dry-run transform arrays to target docs; report counts, duplicates, invalid dates, missing students, unresolved media, and proposed deletes.
3. Write idempotently with deterministic ids, migrationRunId, schemaVersion, migratedFrom, and legacyHash.
4. Verify each batch by count/checksum and support resume without duplicates.
5. Dual-read and compare split summaries to legacy summaries before cutover.
6. Flip schema/config to split model; deny ordinary legacy writes.
7. Backout only to previous release or legacy read-only from immutable export before final deny; never reopen broad anonymous access.

## Data safety and security gates
- S1: no real PII in public static files, service-worker shell, or caches.
- S2: anonymous denied, arbitrary authenticated denied, authorized role allowed only for intended studio.
- S3: Firestore and Storage emulator tests cover allow/deny and schema validation.
- S4: service worker deletes old PII caches; manual Cache Storage check passes.
- S5: load, refresh, Today, and schedule render create no attendance/payment writes.
- S6: export hash and dry-run report exist before migration writes.
- S7: required media has Storage object or explicit recoverable local-only state before placeholder replacement.
- S8: attendance confirmations, payment edits, migration writes, overbooks, resets, and recovery actions create audit events.

## Expanded test plan
### Unit
Cycle status/counting, frequencies 1/2/3+, offsets, edits/deletes, payment states, policy versions. Attendance proposal skip rules and no-write guarantee. Schedule fixed/flex/group/consult conflicts and override semantics. Migration id mapping, duplicates, foreign keys, invalid dates, payment enrichment, media placeholder detection. Media Storage success, IndexedDB queue, quota failure, fallback load, delete/orphan, consent recording.

### Integration
Firestore emulator owner CRUD, anonymous denial, unauthorized denial, cross-studio denial, invalid schema denial, immutable field denial, and legacy phase behavior. Storage emulator authorized upload/download and denied wrong path/type/size/role. Repository split reads/writes, retries, revision conflicts, soft delete, audit events. Migration fixture dry-run/write/checksum/rerun idempotence. Offline recovery queue survives refresh, flushes on reconnect, and prompts conflicts.

### E2E/manual browser
Unauthorized visitor sees sign-in/access denied; network denied; source/cache has no real PII. Authorized owner can load data, use schedule PC/mobile, lesson record, payment add, consult form, conversion, and media. Today with missed lessons creates no log until confirmation. Confirm proposals create exact audit-marked logs. Payments stay consistent after log edit/delete/offset change. Consult conversion requires explicit schedule mapping. Flex conflict blocks or requires audited overbook. Reset shows diff and preserves unrelated assignments. Group lesson supports shared slot, per-member attendance, and payment ownership. Old service worker purges old cache.

### Observability/recovery
Audit events exist for key mutations. Recovery panel lists snapshots and previews restore. Migration report shows run id, counts, failed records, checksums, and rollback pointer. Pending write/upload ledger survives refresh. Operator-visible errors exist for sync/media/rules failures.

## Acceptance criteria
1. No real private PII remains in public static files or service-worker caches.
2. Anonymous and unauthorized authenticated users cannot read/write Firestore or Storage; authorized owner can access only the intended studio.
3. Render/navigation creates zero attendance logs automatically.
4. Missing attendance writes only after explicit confirmation.
5. One cycle service drives dashboard, payments, profile, timeline, alerts, and lesson records.
6. Payments remain explainable after log edit/delete/offset change.
7. Legacy `/studio/data` migrates to split collections with counts, checksums, audit metadata, and backout pointer.
8. Required media persists through reload/cross-device or shows explicit recovery-needed status.
9. Fixed, flex, consult, and group schedules use engine v2 with conflict handling and safe reset.
10. Loaded runtime source is documented and stale duplicates are removed, synchronized, or made actual runtime.

## Risks and mitigations
- Owner lockout: verify UID/claims in emulator and manual browser; keep admin-only emergency path, not anonymous fallback.
- Old PII cache remains: SW version bump, activate/claim, delete caches, manual Cache Storage verification.
- Migration loss/duplication: immutable export, deterministic IDs, dry-run diff, checksums, idempotent resume.
- Payment surprise: before/after impact report, policy versioning, admin review queue.
- Media false success: pending ledger, durable commit requirement, explicit local-only state.
- Non-runtime patches: document loaded runtime first, test current `index.html`, then extract services.
- Schedule disruption: preserve layout, use diff previews and confirmations, test PC/mobile manually.

## Pre-mortem
1. Security ships but PII remains offline because old `index.html` stayed cached. Prevent with cache purge gate and manual verification.
2. Migration succeeds but Monday payment cards look wrong due to silent cycle policy changes. Prevent with before/after reports and policy versions.
3. Consent audio shows success but disappears on another device because IndexedDB was treated as durable. Prevent with Storage-backed media and pending upload state.

## Handoff guidance
Use `executor` for approved bounded slices. Use `architect` after Phase 1 and before Phase 4 cutover. Use `critic` to challenge migration/backout before cutover. Use `team` if approved execution is parallelized. Use `ultragoal` if phases span multiple sessions and need durable evidence tracking.
