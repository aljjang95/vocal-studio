## Summary
Planner stage 1 is directionally right and its recommended staged modernization is the only defensible path for this codebase, but the plan needs changes before execution approval. The largest gap is that Phase 1 must treat every public static asset as a PII surface, not only the active `index.html`, and the first executable slice must also stop render-triggered attendance writes.

## Analysis
Evidence inspected: `.gjc/plans/ralplan/2026-06-18-1053-60bb/stage-01-planner.md`, `index.html`, `sw.js`, `firestore.rules`, `firebase.json`, `manifest.json`, `js/app.js`, selected `js/**/*.js`, and prior assessments. No product files were edited and no project-wide build, lint, format, or test gate was run.

Spec compliance: the planner artifact covers the requested domains: migration ordering, security, automatic attendance, billing and cycle correctness, media persistence, schedule and group model, rollback, tests, and source-of-truth risk. It correctly identifies the active runtime as monolithic `index.html`, with `js/app.js:1-4` explicitly saying the modular entrypoint is unused, and it correctly prioritizes security, no-write attendance, canonical cycle logic, split Firestore data, media durability, schedule/group modeling, tests, and source cleanup.

Security evidence is severe. `index.html:3050` embeds real student names and phone numbers, `index.html:5738-5763` injects inquiry phone numbers and writes them back to Firestore, `sw.js:7-14` precaches `./index.html`, and `index.html:10924-10940` registers that service worker. `index.html:3551-3558` signs clients in anonymously and continues into the listener even after auth failure. `firestore.rules:4-5` allows any authenticated user to read and write `/studio/{docId}`. `firebase.json:1-5` deploys only Firestore rules despite `index.html:15-18` loading Firebase Storage and `index.html:3659-3684` uploading photos.

Workflow and billing evidence is also severe. `index.html:4554-4617` computes missing past schedule slots, inserts `att:출석` logs, and calls `saveAll()`. `index.html:4635-4637` calls that function from `buildTodaySchedule()`, so a render path mutates attendance. `index.html:7244-7260` excludes `결석` and `연기` from cycle counts, but `index.html:7848-7870` computes lesson record `wn` from all logs up to a date, and `index.html:7609-7612` stores payment `cycleNum` at creation time. Stale modules deepen the drift: `js/core/cycle.js:26-44` and `js/ui/payment.js:26-36` only distinguish 4 or 8 lesson cycles, while `index.html:3218-3221` now supports N x 4 cycles.

Media evidence supports the plan but changes the cutover risk. `index.html:3235-3324` stores media in IndexedDB and strips large media to `[saved]` in localStorage. `index.html:3736-3793` strips media again before whole-document Firestore writes. Callers at `index.html:4238-4302` and `index.html:8298-8320` call `mediaSave(...)` without waiting for success before `saveAll()`. `index.html:9888-9910` renders consent audio directly from `savedConsent.data`, so a `[saved]` placeholder can become an invalid player source.

Schedule and group evidence supports the planner diagnosis. `index.html:5173-5225` mixes fixed students, flex overrides, and unconverted consult dates into one computed schedule. `index.html:6793-6844` and `index.html:6946-6961` warn about conflicts but still save flex and weekly edits. `index.html:10543-10556` deletes the whole week override for reset. `index.html:9578-9620` records `lessonType` and `groupMembers`, while `index.html:9022-9075` conversion pre-fills one student from consultation fields and does not force mapping confirmed dates into first lesson, recurring enrollment, or an override.

Strongest steelman antithesis: the best case against Option A is that temporary adapters inside the monolith can institutionalize the current source-of-truth confusion. A stricter alternative would be emergency lockdown plus no-write attendance only, then stop feature work until a loaded modular runtime and domain services exist. That alternative minimizes duplicate contracts and makes tests target the future architecture, but it delays fixes for media loss, split persistence, and schedule/group correctness. The synthesis is to keep Option A, but make Phase 1 smaller and harder gated: remove PII from every public asset, stop automatic attendance writes, declare `index.html` the runtime source until modules are actually loaded, and forbid fallback paths that hide sync/media/auth failures.

Deliberate-mode principle-violation flags:
- Render purity violation: `buildTodaySchedule()` mutates logs through `autoFillPastAttendance()`.
- Source-of-truth violation: runtime `index.html` and unused `js/**/*.js` carry divergent cycle and data definitions.
- Silent fallback violation: anonymous auth failure still starts the Firestore listener, photo upload failure becomes local-only state, and media save failures are not surfaced before placeholders are persisted.
- Canonical invariant violation: attendance counts, payment cycle membership, and lesson `wn` are computed by multiple paths.

## Root Cause
The root cause is that private operational data, authorization, sync, media, attendance, schedule, and billing invariants all live in a public static client bundle with localStorage and a single shared Firestore document as the effective database. Anonymous authentication plus broad rules turns identity into a transport detail rather than authorization, and duplicated monolith/module logic makes it easy to patch a non-runtime source or preserve stale private data.

## Findings
1. CRITICAL - Phase 1 PII scope is too narrow unless it explicitly includes all public static JS assets.
Reference: `index.html:3050` embeds student PII, `js/store/state.js:8-9` embeds the same default student data, and `js/types.js:195-208` embeds the same real data. `sw.js:7-14` also caches `index.html`.
Impact: An executor following only the plan file-level focus on `index.html` and late `js/**/*.js` cleanup could remove PII from the runtime while still shipping downloadable static JS files with names and phone numbers. Firestore rules cannot protect already served static files.
Fix: Amend Phase 1 to remove real PII from every public static asset under the deployed root, including unused modules, and make S1 scan `index.html`, `sw.js`, `manifest.json`, and `js/**/*.js`. Source cleanup can wait, but PII removal cannot.

2. HIGH - The first executable release can still leave automatic attendance writes active.
Reference: `index.html:4554-4617` creates past `출석` logs and calls `saveAll()`, and `index.html:4635-4637` invokes it during Today rendering. Payment and cycle views then consume those logs through `index.html:7244-7260` and `index.html:7609-7612`.
Impact: A security-only Phase 1 release would reduce exposure but continue silently polluting attendance and billing data each time Today renders.
Fix: Combine the no-write attendance kill switch with Phase 1 or add a Phase 1 gate that `buildTodaySchedule`, schedule render, and refresh create zero attendance/payment writes. The proposal queue UI can follow in Phase 2.

3. HIGH - Migration export needs an explicit freeze or revision guard before it becomes authoritative.
Reference: `index.html:3769-3793` writes all domain data through `docRef.set(payload)`, while `index.html:3577-3627` merges remote data and may push back local additions. The planner has export, dry-run, dual-read, and later legacy freeze steps, but it does not require a write freeze or server revision checkpoint before the baseline export.
Impact: The legacy document can change between export, dry-run, and migration writes, especially while any client can authenticate anonymously. That creates a rollback pointer that might not match the data actually migrated.
Fix: Add a Phase 0 or Phase 1 gate: lock down auth first or enter a maintenance window, capture server update time or revision/hash, block stale writes, rerun export immediately before migration, and require the migrator to compare the live legacy hash before cutover.

4. MEDIUM - Media cutover must not treat `[saved]` placeholders as migrated success.
Reference: `index.html:3235-3324` and `index.html:3736-3750` strip media to `[saved]`; `index.html:4238-4302` and `index.html:8298-8320` ignore IndexedDB save completion; `index.html:9888-9910` can render consent audio from placeholder data.
Impact: Splitting Firestore before classifying media can fossilize local-only or missing media references as valid migrated records.
Fix: Keep full media UI in Phase 5, but add a Phase 4 prerequisite that creates media manifest docs, marks unresolved placeholders as `recoveryRequired`, and fails migration checks for required media without Storage object, IndexedDB recoverability, or explicit local-only status.

5. MEDIUM - Runtime source-of-truth cleanup is too late unless an execution invariant is added now.
Reference: `js/app.js:1-4` says modules are unused, but `js/core/cycle.js:26-44`, `js/ui/payment.js:26-36`, and `js/types.js:23-24` lag the runtime N-times-per-week model in `index.html:3218-3221`.
Impact: Tests or fixes can land in unused modules and appear correct while the deployed app still runs old monolithic code.
Fix: Add a Phase 0 invariant: until `index.html` explicitly loads modules, only `index.html` is runtime logic. Unused modules may only receive PII removal, deletion, or extraction that is wired into runtime with tests in the same slice.

## Recommendations
1. Revise Phase 1 acceptance to remove static PII from all public assets and verify service-worker cache purge.
2. Move the automatic attendance no-write guard into the first executable production slice.
3. Add a migration freeze, live hash comparison, and server revision checkpoint before any split-collection writes.
4. Add a media manifest and placeholder quarantine before split Firestore cutover.
5. Add an explicit runtime-source policy before delegating implementation: `index.html` is authoritative until modules are loaded.
6. Keep the planner test gates, especially unauthorized Firestore/Storage denial, no-write render tests, cycle-policy fixtures, media quota/failure cases, and migration idempotence.

## Architectural Status
BLOCK

## Code Review Recommendation
REQUEST CHANGES

## Trade-offs
- Security speed vs billing integrity: locking down auth and removing PII is the fastest risk reduction, but leaving auto attendance active keeps corrupting business data. The right cut is a small first release that does both PII/auth lockdown and the no-write kill switch, while deferring the full attendance proposal UI.
- Monolith patch vs modular rewrite: patching `index.html` reduces immediate risk but can worsen duplicate contracts. A rewrite is cleaner but delays critical fixes. The synthesis is monolith-first only under a strict source-of-truth policy and aggressive deletion or wiring of stale modules.
- Firestore split before media vs media before split: split collections reduce overwrite risk, but media placeholders can become permanent if not classified first. Add media manifests before cutover, then finish Storage-backed UX after split reads are stable.
