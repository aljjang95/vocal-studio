# RALPLAN-DR Revision Stage 2 — Vocal Studio A-to-Z Upgrade

## Summary
This revision integrates Architect BLOCK and Critic ITERATE feedback. The first executable release must combine four hard gates: remove private PII from every public static asset, replace anonymous broad access with authorized access, purge old service-worker cache exposure, and install an automatic-attendance no-write kill switch. The proposal queue, split Firestore, media recovery, and schedule v2 can phase later, but render/navigation must create zero logs immediately.

Runtime fact: `index.html` is authoritative today. `js/app.js` says the modular entrypoint is unused and `index.html` does not load local `js/*.js`. Static PII is broader than active runtime: `index.html`, `vocal-studio.html`, `vocal-studi.html`, `js/store/state.js`, `js/types.js`, `js/ui/consult.js`, and other public JS files contain private names/phones or inquiry seeds. `sw.js` caches `index.html`. Firestore rules allow any authenticated user, while the app signs in anonymously. Planner id for this revision is `2-VocalUpgradePlanner`.

## Principles
1. No private operational data in public static assets or caches.
2. Render and navigation paths must never mutate attendance, billing, or payment state.
3. `index.html` remains the runtime source until modules are explicitly loaded and tested.
4. Business invariants need one canonical service with focused tests.
5. Migration requires freeze or maintenance window, live hash check, audit trail, and backout.

## Top 3 decision drivers
1. Security: anonymous auth, broad rules, public PII, stale cache.
2. Billing correctness: automatic attendance and cycle drift silently affect payment status.
3. Migration safety: one-document sync, concurrent legacy writes, media placeholders, and group/schedule ambiguity.

## Options
### Option A — Security-first staged modernization, recommended
Patch current runtime, remove all public-asset private PII, add attendance kill switch, add services/repositories, then migrate data/media and clean modules.

Pros: fastest P0 reduction, prevents new attendance corruption, allows phased verification, preserves workflow, supports rollback. Cons: monolith remains longer, temporary adapters, strict module discipline required. Chosen.

Invalidation: no live-hash baseline can be captured; authorized Firebase access cannot be established; public asset inventory cannot be bounded; maintainers require a full runtime rewrite first.

### Option B — Big-bang modular rewrite
Replace `index.html` and ship auth, split Firestore, media, schedule, and cycle together. Pros: cleaner architecture. Cons: delays P0 fixes, highest regression risk, hard backout. Rejected for first release.

### Option C — Emergency lockdown and no-write slice
Only remove all public private PII, lock auth/rules, purge caches, and disable automatic attendance. Pros: smallest safe release. Cons: leaves overwrite, media, cycle, and schedule risks. Accepted as first slice inside Option A, not the full upgrade.

## In scope
- Authorized auth and least-privilege Firestore/Storage rules.
- PII removal from `index.html`, `vocal-studio.html`, `vocal-studi.html`, `js/**/*.js`, `sw.js` cache surface, and any deployed static bundle.
- Repeatable static PII scan over all public assets.
- Service-worker purge of historical PII caches.
- First-release automatic-attendance no-write kill switch.
- Full attendance proposal workflow after the kill switch.
- Canonical lesson/payment cycle service.
- Migration freeze, live hash or server revision checkpoint, split Firestore, audit metadata, and backout.
- Media manifest, placeholder quarantine, durable media, recovery UI.
- Schedule engine v2 and group lessons.
- Regression tests and source-of-truth cleanup.

## Out of scope / non-goals
- No broad redesign beyond required auth, review, recovery, migration, conflict, and group UI.
- No unrelated CRM, marketing, analytics, or automation.
- No destructive cleanup without export, dry-run, live-hash validation, approval, and rollback pointer.
- No App Check as authorization.
- No project-wide build/lint/format gate during planning.
- No behavior-only fixes in unused modules unless wired into runtime with tests in the same slice.

## Evidence
- `index.html` is active runtime and loads Firebase compat SDKs directly.
- `js/app.js` says modules are unused.
- Private PII appears in active and inactive public assets: `index.html`, `vocal-studio.html`, `vocal-studi.html`, `js/store/state.js`, `js/types.js`, `js/ui/consult.js`, and related JS templates.
- `sw.js` precaches `./index.html`.
- `firestore.rules` allows read/write for any authenticated user.
- `index.html` signs in anonymously and listens to `studio/data`.
- `firebase.json` deploys only Firestore rules while Storage code exists.
- `autoFillPastAttendance()` writes attendance and Today rendering invokes it.
- Cycle/payment logic is duplicated and divergent across runtime and unused modules.
- Firestore writes all domain arrays into one document.
- Media is stripped to `[saved]`; IndexedDB saves are not uniformly awaited; consent audio can render placeholder data.
- Consult conversion, conflict handling, reset, and group lesson modeling are incomplete.

## Runtime-source policy, Phase 0 invariant
Until `index.html` explicitly loads extracted modules, `index.html` is the only runtime logic. Executors must not claim behavior complete from changes only in `js/**/*.js`. Unused modules may receive only PII removal, deletion, or same-slice extraction that is wired into `index.html` and tested against the loaded browser path.

## File-level changes
### Public asset inventory
Enumerate every deployed public file before edits. Minimum scope: `index.html`, `vocal-studio.html`, `vocal-studi.html`, `sw.js`, `manifest.json`, all `js/**/*.js`, CSS, generated bundles, and any copied static app shell. The PII scan runs against this inventory.

### `index.html`
Remove real seed data and inquiry seeds. Add authorized sign-in gate. Stop private render/listener startup until auth succeeds. Remove anonymous fallback reads. Add no-write kill switch for attendance. Later convert auto attendance to proposals. Route persistence through repositories, cycle/payment through one service, and schedule/group/consult flows through schedule v2.

### `vocal-studio.html`, `vocal-studi.html`
Treat as public even if obsolete. Remove private PII or delete from deployment. Include in scan until removed.

### `js/**/*.js`
Remove private PII from unused modules immediately. Do not implement runtime behavior here unless `index.html` loads it in the same slice. Delete or convert stale modules later.

### `sw.js`
Bump version, activate/claim, delete old caches, avoid caching private HTML/data, and manually verify old cache removal.

### `firestore.rules`
Replace `/studio/{docId}` broad access with `/studios/{studioId}` and subcollection rules gated by authorized UID/claims/roles. Validate schemas, immutable fields, allowed fields, types, studio membership, and legacy phase behavior.

### `firebase.json` and `storage.rules`
Add Storage rules deployment. Add no-store or short-cache headers for HTML and `sw.js` if hosting is managed here. Storage rules must restrict private media by studio, record, role, size, type, and ownership metadata.

### `manifest.json`
Keep in scan; ensure `start_url` has no tokens or user-specific state.

## Sequencing and dependencies
### Phase 0 — Inventory, source policy, freeze design
1. Document that `index.html` is authoritative until modules are loaded.
2. Inventory all public assets and bundle outputs.
3. Define static PII scan and reviewed allowlist for intentionally public business contact text only.
4. Design attendance no-write kill switch.
5. Decide owner UID/claim/role model.
6. Design migration freeze: maintenance window or write lock, legacy write disablement, live hash or server revision, stale-write rejection.
7. Export legacy data only after freeze/checkpoint design. Baseline export is not authoritative until live hash or revision is captured.
8. Inventory counts, duplicates, invalid dates, missing foreign keys, media placeholders, document size, and schema anomalies.
9. Plan focused tests and manual baseline flows.

Gate: asset inventory, source policy, freeze/hash procedure, and auth approach exist before implementation slices.

### Phase 1 — First executable release
1. Remove private PII from `index.html`, `vocal-studio.html`, `vocal-studi.html`, `js/**/*.js`, `sw.js` cache surface, and any deployed static bundle.
2. Run static PII scan over the full public inventory. Fail on private names, phones, inquiry seeds, media, payment, attendance, or unreviewed phone/account values.
3. Add sign-in/access-denied shell and prevent private Firestore/Storage access before auth.
4. Replace anonymous broad access with authorized access and restrictive Firestore rules; add Storage rules if private media is reachable.
5. Install automatic-attendance no-write kill switch: load, refresh, navigation, Today render, and schedule render create zero attendance/payment writes.
6. Purge old service-worker caches and verify Cache Storage manually.

Gate: unauthorized user denied, authorized owner can load intended studio, static scan passes, cache purge passes, no-write render test passes.

### Phase 2 — Attendance proposal workflow
Convert old automatic calculation into no-write proposal generation. Add review UI, per-item/bulk confirm, audit fields, and report existing automatic logs for admin review. Gate: proposals do not write; confirmation writes exactly expected audit-marked logs.

### Phase 3 — Unified lesson/payment cycle service
Define counted statuses, cancellation policy, offsets, N-times-per-week cycle size, edit/delete behavior, and historic payment membership. Implement pure service and replace active runtime callsites. Enrich payments with cycle range, cycle size, policy version, optional lesson ids, and impact reports. Gate: all UI surfaces agree on cycle and paid/unpaid state.

### Phase 4 — Split Firestore with freeze, live hash, media manifest
1. Enter maintenance window or apply legacy write lock.
2. Capture authoritative checkpoint: server update time or revision, normalized live SHA-256 of `/studio/data`, export timestamp, document size, Storage metadata list.
3. Rerun export immediately before migration writes; abort if live hash or revision drifted.
4. Build media manifest before cutover: owner, type, durability requirement, Storage path, local key, placeholder state, recovery status.
5. Quarantine placeholders. `[saved]` alone is not success. Required media must resolve to Storage, verified recoverable local-only state, or `recoveryRequired`; otherwise fail migration or mark recoveryRequired by policy.
6. Target `/studios/{studioId}` plus `students`, `logs`, `payments`, `consults`, `inquiries`, `weekOverrides` or `scheduleOverrides`, `attendanceProposals`, `auditEvents`, and `media`.
7. Add schemaVersion, createdAt, updatedAt, updatedBy, deletedAt, revision, source, migratedFrom, legacyHash, migrationRunId.
8. Dry-run with deterministic ids, duplicate detection, referential checks, checksums, batch resume, idempotence, and media validation.
9. Dual-read summaries, compare counts/checksums, cut writes to split collections, keep legacy read-only/admin-only during observation, then deny.

Gate: live hash matches checkpoint, media placeholders are quarantined, split counts/checksums match, record writes do not overwrite unrelated data.

### Phase 5 — Media persistence and recovery
Classify media. Store required media in Storage with metadata docs; use IndexedDB only as queue/cache. Do not write `[saved]` until durable commit or explicit local-only degraded state. Add retry ledger, quota errors, unified load path, orphan scan, placeholder quarantine list, diff preview, and restore. Gate: reload/cross-device works or shows recoveryRequired.

### Phase 6 — Schedule engine v2 and group lessons
Define enrollment, member, group, recurring slot, one-off override, absence, cancellation, conflict, and consult appointment. Engine returns slots, conflicts, unassigned students, group members, reason codes. Block conflicts or require audited overbook. Replace whole-week reset with diff reset. Conversion maps confirmed consult dates explicitly. Group lessons support primary payer, members, per-member attendance/contact, shared slot, payment ownership. Gate: PC/mobile behavior consistent and reset preserves unrelated assignments.

### Phase 7 — Runtime cleanup and regression hardening
Choose final runtime structure, delete or synchronize stale modules, document auth, scan, migration, media recovery, cache purge, and release checklist. Add regressions for every invariant. Gate: maintainers can identify loaded code and tests cover it.

## Migration and backout strategy
1. Freeze or maintenance window before authoritative export.
2. Capture live hash, server revision/update time, export timestamp, size, and Storage metadata.
3. Rerun export immediately before writes and abort on drift.
4. Build media manifest and quarantine placeholders before cutover.
5. Dry-run transform arrays and report counts, duplicates, invalid dates, missing students, unresolved media, recoveryRequired media, and proposed deletes.
6. Write idempotently with deterministic ids, migrationRunId, schemaVersion, migratedFrom, legacyHash.
7. Verify each batch by count/checksum and support resume.
8. Dual-read compare before final cutover.
9. Back out only to previous release or legacy read-only from immutable checkpoint before final deny. Never reopen broad anonymous access.

## Data safety and security gates
- S1 public asset PII scan covers all HTML copies, `js/**/*.js`, `sw.js`, manifest, CSS, and bundles.
- S2 anonymous denied, arbitrary authenticated denied, authorized role scoped to intended studio.
- S3 Firestore and Storage emulator tests cover allow/deny, schema validation, legacy phases, cross-studio denial.
- S4 service worker purges old PII caches and manual Cache Storage check passes.
- S5 first-release no-write: load, refresh, navigation, Today, schedule render create zero attendance/payment writes.
- S6 runtime-source policy prevents behavior-only fixes in unused modules.
- S7 migration freeze uses live hash/revision and aborts on drift.
- S8 media manifest requires Storage, verified local recovery, or recoveryRequired; `[saved]` alone fails success.
- S9 audit events exist for attendance, payments, migration, overbooks, resets, media recovery, freeze, and cutover.

## Expanded test plan
### Unit
Static PII scanner; attendance kill switch; attendance proposal rules; cycle service statuses/frequencies/offsets/edits/payments; schedule fixed/flex/group/consult conflicts; migration id mapping, hash drift, idempotence; media manifest placeholder quarantine; media save/load failure paths.

### Integration
Firestore rules for owner, anonymous, unauthorized, cross-studio, invalid schema, immutable fields, and legacy phases. Storage rules for path/type/size/role. Repository tests for retries, revision conflicts, stale hash rejection, soft delete, audit. Migration fixture dry-run/write/checksum/rerun and abort on drift. Offline/recovery queue and conflict prompts.

### E2E/manual
Unauthorized browser sees denied shell and cannot read data. Source and Cache Storage contain no private PII. Static scan covers all public files. Old service worker purges prior cache. Authorized owner can load and use core flows. Today/schedule/refresh/navigation create zero logs before confirmation. Payments stay consistent after edits. Migration rehearsal aborts on live hash drift. `[saved]` media becomes recoveryRequired, not success. Consult conversion, flex conflicts, reset diff, and group lesson flows work on PC/mobile.

### Observability/recovery
Audit events for freeze, export, migration, cutover, attendance, payment, overbook, reset, media quarantine, recovery. Migration report includes run id, live hash, revision, counts, failed records, media summary, checksums, rollback pointer. Operator-visible errors for auth, rules, sync, media, migration drift, cache purge.

## Acceptance criteria
1. Private PII removed from every deployed public static asset and old cache.
2. Repeatable public asset PII scan passes with reviewed public contact allowlist if any.
3. Anonymous and unauthorized users cannot read/write Firestore or Storage; owner can access only intended studio.
4. First executable release proves load, refresh, navigation, Today, and schedule render create zero attendance/payment writes.
5. Attendance writes only after explicit confirmation after Phase 2.
6. `index.html` remains authoritative until modules are loaded and tested.
7. One cycle service drives all active runtime displays and payment logic.
8. Migration uses freeze or maintenance window, live hash/revision checkpoint, and aborts on drift.
9. Split migration has counts, checksums, audit metadata, media manifest, and rollback pointer.
10. `[saved]` is not migrated media success; required unresolved media fails or is recoveryRequired.
11. Required media persists cross-device or shows recoveryRequired.
12. Schedule v2 handles fixed, flex, consult, group, conflicts, and safe reset.
13. Stale modules are deleted, synchronized, or loaded before behavioral completion is claimed.

## Risks and mitigations
- Public JS still leaks PII: full inventory and scan.
- Old PII cache remains: SW purge and manual verification.
- Security release corrupts attendance: first-release kill switch.
- Owner lockout: auth dry run and admin-only emergency path, never anonymous fallback.
- Export drift: freeze, live hash, abort on mismatch.
- Media false success: manifest, quarantine, recoveryRequired.
- Payment surprise: impact report and policy version.
- Non-runtime patches: runtime-source policy.
- Schedule disruption: diff previews, confirmations, PC/mobile manual tests.

## Pre-mortem
1. PII remains in obsolete HTML or unused JS. Prevent with full inventory and scan.
2. Today render still creates attendance after security release. Prevent with mandatory no-write kill switch.
3. Migration uses stale export after a legacy client push. Prevent with freeze and live hash comparison.
4. `[saved]` consent audio is marked migrated. Prevent with media manifest and recoveryRequired quarantine.
5. Executor fixes unused module only. Prevent with runtime-source policy.
6. Rules lock out owner and rollback reopens anonymous access. Prevent with auth dry run and non-anonymous emergency path.

## Handoff guidance
After approval, first `executor` slice is public-asset PII removal, auth/rules lockdown, service-worker purge, and attendance no-write kill switch. Use `architect` after Phase 1 and before Phase 4. Use `critic` for migration freeze/live hash/media quarantine before cutover. Use `team` only for approved parallel execution. Use `ultragoal` for multi-release evidence tracking.

## Revision status
Required pass 2 changes are incorporated: all-public-asset PII scope, first-release no-write attendance kill switch, migration freeze and live hash checkpoint, media manifest and placeholder quarantine before split cutover, Phase 0 runtime-source policy, and planner id `2-VocalUpgradePlanner`.
