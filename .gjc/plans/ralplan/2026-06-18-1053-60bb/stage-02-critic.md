**[OKAY]**

**Justification**: The revised RALPLAN artifact is actionable and testable for pending approval. It folds the prior Architect `BLOCK` and Critic `ITERATE` findings into mandatory sequencing, gates, and acceptance criteria: all deployed public assets are now PII surfaces, the first executable release must include the attendance no-write kill switch, split migration is gated by freeze/live hash or server revision, media placeholders are quarantined before cutover, and `index.html` is declared authoritative until modules are actually loaded and tested. Representative checks against the current source confirm the risks are real and the revised plan now tells executors where to change, what not to claim, and how to prove completion without guessing.

**Summary**:
- Clarity: Clear. Option A remains the recommended path, with Option C explicitly embedded as the indivisible first slice. Phase 0, Phase 1, Phase 4, and acceptance criteria state the required gates directly.
- Verifiability: Strong. The plan names repeatable static PII scans, unauthorized/authorized rules tests, no-write render/navigation tests, service-worker cache verification, migration hash-drift abort tests, media placeholder quarantine checks, and PC/mobile manual schedule flows.
- Completeness: Sufficient for approval. The revised artifact covers security/auth/rules, public PII/cache exposure, attendance writes, cycle/payment drift, split Firestore migration, media durability, schedule/group modeling, stale modules, rollback, observability, and review checkpoints.
- Big Picture: Sound. Security-first staged modernization is still the right fit for this static monolith because public PII and broad anonymous data access must be reduced before a rewrite. The revised plan avoids the earlier unsafe security-only slice by pairing lockdown with no-write attendance.
- Principle/Option Consistency: Consistent. The plan principles now match its sequencing: render paths must not write, migrations require a known-good checkpoint, public static assets cannot carry private data, and behavior cannot be claimed from unused modules.
- Alternatives Depth: Adequate. Big-bang rewrite and lockdown-only hotfix are considered with realistic tradeoffs; the synthesis is to use lockdown/no-write as Phase 1 inside staged modernization.
- Risk/Verification Rigor: Adequate for execution approval. The pre-mortem and gates cover stale public assets, old service-worker caches, owner lockout, concurrent legacy writes, media false success, non-runtime patches, and rollback constraints.

**Artifacts read**:
- `.gjc/plans/ralplan/2026-06-18-1053-60bb/stage-02-revision.md`
- `.gjc/plans/ralplan/2026-06-18-1053-60bb/stage-04-architect.md`
- Prior context: `stage-01-planner.md`, `stage-03-architect.md`, `stage-01-critic.md`

**Referenced file checks**:
- Verified existing referenced source files: `index.html`, `vocal-studio.html`, `vocal-studi.html`, `sw.js`, `firestore.rules`, `firebase.json`, `manifest.json`, `js/app.js`, `js/store/state.js`, `js/types.js`, `js/core/cycle.js`, `js/ui/payment.js`, and broader `js/**/*.js` inventory.
- `storage.rules` is not present; this is not a plan defect because the revised plan identifies it as a new deployment artifact to add.
- No `package.json` or existing obvious test setup was found, so the plan focused harness/emulator/manual verification requirements remain necessary.

**Prior ITERATE issue resolution**:
1. All-public-asset PII scope: Resolved. Prior critic required `index.html`, `sw.js`, `manifest.json`, and `js/**/*.js` coverage. The revision expands scope to `index.html`, `vocal-studio.html`, `vocal-studi.html`, `js/**/*.js`, `sw.js`, manifest, CSS, bundles, and any deployed app shell; Phase 1 requires scan failure on private names, phones, inquiry seeds, media, payment, attendance, or unreviewed phone/account values.
2. First-release attendance no-write: Resolved. The revision makes the kill switch part of the first executable release and requires load, refresh, navigation, Today render, and schedule render to create zero attendance/payment writes. The full proposal queue can follow later.
3. Migration freeze/live hash: Resolved. Phase 0 must design maintenance/write lock, legacy write disablement, live hash or server revision, and stale-write rejection. Phase 4 must enter freeze, capture checkpoint, rerun export immediately before writes, and abort on drift.
4. Media placeholder quarantine: Resolved. Phase 4 requires a media manifest and placeholder quarantine before cutover; `[saved]` alone is explicitly not success and required unresolved media must fail or be marked `recoveryRequired` by policy.
5. Runtime-source policy: Resolved. The plan states `index.html` remains authoritative until modules are loaded and tested; behavior-only fixes in unused modules are prohibited unless wired into runtime in the same slice.
6. Expanded acceptance/pre-mortem: Resolved. Revised acceptance and risks cover stale public JS assets, old service-worker caches, concurrent legacy writes, media false success, non-runtime patches, owner lockout, and non-anonymous backout.

**Representative implementation simulations**:
1. Phase 1 PII and cache slice: An executor can start by inventorying public assets, because the files exist and the plan names the minimum scope. Source evidence confirms private phone/name data in active and inactive assets: `_DEFAULT_STUDENTS` in `index.html`, `vocal-studio.html`, `js/store/state.js`, and `js/types.js`; inquiry phone seeds in `index.html` and `js/ui/consult.js`; and `sw.js` currently precaches `./index.html`. The revised gate prevents the earlier failure mode of cleaning only active `index.html` while leaking downloadable stale JS or cached HTML.
2. First executable release no-write slice: Current `buildTodaySchedule()` calls `autoFillPastAttendance()`, which inserts attendance logs and calls `saveAll()`. The revised plan is specific enough to implement and verify a kill switch: render/load/refresh/navigation/Today/schedule must not add attendance or payment writes, while Phase 2 later converts the computation into proposals and explicit confirmation.
3. Auth/rules slice: Current runtime signs in anonymously and `firestore.rules` permits any authenticated user on `/studio/{docId}`; `firebase.json` deploys only Firestore rules while Storage code exists. The plan makes Phase 0 decide the owner UID/claim/role model and Phase 1 replace anonymous broad access with authorized access plus Firestore/Storage rule tests. Executors have a concrete gate and must not guess owner access in the rules deployment.
4. Split Firestore migration: Current `_startFirestoreListener()` merges local additions and can push them back, while `_pushToFirestore()` writes the whole legacy document via `docRef.set(payload)`. The revised freeze/live-hash sequence makes the migration executable without relying on a stale export: lock or maintenance, checkpoint update time/revision plus normalized SHA-256, immediate re-export, abort on drift, deterministic ids, counts/checksums, dual-read comparison, and read-only/admin-only legacy observation.
5. Media migration/cutover: Current save paths strip large media data to `[saved]`, call `mediaSave(...)` without awaiting durable completion, and can render consent audio from `savedConsent.data`. The plan now forces a manifest with owner/type/durability/path/local key/placeholder/recovery state before split cutover and forbids treating `[saved]` as migrated success.
6. Runtime-source and cycle/service work: `js/app.js` says the modular entrypoint is unused, and `index.html` loads external scripts only, not local `js/*.js`. The current runtime supports `cycleSizeOf(s)=freq*4`, while unused modules still use `s.freq===2?8:4`. The revised policy blocks false completion from stale modules and requires active runtime callsites or same-slice module wiring plus tests.

**No required fixes before approval**.

**Execution recommendations after approval**:
- Keep the first executor slice indivisible: public-asset PII removal, authorized auth/rules lockdown, old service-worker cache purge, and automatic-attendance no-write.
- Require Phase 0 evidence for owner UID/claim/role model before deploying restrictive rules.
- Preserve the planned review checkpoints: architect after Phase 1 and before Phase 4; critic before migration freeze/live-hash/media quarantine cutover.
- Treat any attempt to skip public JS scans, split off the no-write gate, migrate without a live checkpoint, accept `[saved]` as success, or claim behavior from unused modules as a plan violation.

Verdict: OKAY (approval recommended).
