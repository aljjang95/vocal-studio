## Summary
The revised plan resolves the prior Architect `BLOCK` and Critic `ITERATE` concerns. The former missing gates are now explicit acceptance and sequencing constraints: all public static PII scope, first-release attendance no-write, migration freeze/live hash, media placeholder quarantine, and runtime-source policy. Recommendation: approve the revised plan for execution, with required re-review after Phase 1 and before Phase 4 cutover.

## Analysis
Evidence inspected: `.gjc/plans/ralplan/2026-06-18-1053-60bb/stage-02-revision.md`, prior Planner/Architect/Critic artifacts, and representative source files (`index.html`, `sw.js`, `firestore.rules`, `firebase.json`, `js/app.js`, `js/store/state.js`, `js/types.js`, `js/core/cycle.js`, `js/ui/payment.js`). No product source was edited and no project-wide build/test/lint/formatter was run.

Spec compliance: the revision directly answers the prior required fixes. Architect P1 listed five plan blockers in `stage-03-architect.md:29-52`; Critic P1 required those same gates before execution in `stage-01-critic.md:26-32`. The revised plan now makes them mandatory rather than advisory.

Gate verification against the revision:
- All public static PII scope is integrated. The revision lists public PII removal across `index.html`, both HTML copies, `js/**/*.js`, `sw.js` cache surface, and bundles at `stage-02-revision.md:36-37`; requires a public-asset inventory at `stage-02-revision.md:74`; makes Phase 1 remove and scan the full public inventory at `stage-02-revision.md:112-113`; and carries the same requirement into S1 and acceptance at `stage-02-revision.md:161` and `stage-02-revision.md:185-186`. Source risk is real: `js/store/state.js:9` and `js/types.js:195-198` embed student PII, while `sw.js:9-10` precaches `index.html`.
- First-release attendance no-write is integrated. The summary states the first executable release must include the automatic-attendance no-write kill switch at `stage-02-revision.md:4`; Phase 1 requires load, refresh, navigation, Today render, and schedule render create zero attendance/payment writes at `stage-02-revision.md:116`; S5 and acceptance repeat the same gate at `stage-02-revision.md:165` and `stage-02-revision.md:188`. This closes the prior source defect where `index.html:4554-4616` creates attendance logs and calls `saveAll()`, and `index.html:4634-4636` invokes it from Today rendering.
- Migration freeze/live hash is integrated. Phase 0 designs maintenance/write lock, legacy write disablement, live hash or server revision, and stale-write rejection at `stage-02-revision.md:104-105`; Phase 4 enters the freeze, captures server update time/revision plus normalized SHA-256, reruns export, and aborts on drift at `stage-02-revision.md:127-130`; migration/backout repeats the same order at `stage-02-revision.md:150-152`; S7 and acceptance enforce it at `stage-02-revision.md:167` and `stage-02-revision.md:192`. This addresses the live risk where `index.html:3571-3580` bootstraps/pulls a single legacy document, `index.html:3626-3627` can push merged local additions back, and `index.html:3769-3792` writes the whole payload with `docRef.set(payload)`.
- Media placeholder quarantine is integrated. Phase 4 builds a media manifest and quarantines placeholders before cutover at `stage-02-revision.md:131-132`; Phase 5 forbids `[saved]` until durable commit or explicit local-only degraded state at `stage-02-revision.md:141`; migration/backout, S8, tests, and acceptance repeat that `[saved]` is not migrated success at `stage-02-revision.md:153-154`, `stage-02-revision.md:168`, `stage-02-revision.md:173`, `stage-02-revision.md:179`, and `stage-02-revision.md:193-195`. This addresses the current source paths that strip media to `[saved]` (`index.html:3070-3075`, `index.html:3741-3749`), save media without waiting (`index.html:4248`, `index.html:8310`), and can render placeholder consent audio (`index.html:8437`, `index.html:9904`).
- Runtime-source policy is integrated. The plan states `index.html` remains the runtime source until modules are explicitly loaded and tested at `stage-02-revision.md:11` and `stage-02-revision.md:69-70`; prohibits behavior-only fixes in unused modules at `stage-02-revision.md:53` and `stage-02-revision.md:82-83`; makes the policy a Phase 0 gate at `stage-02-revision.md:99` and `stage-02-revision.md:109`; and repeats it in S6 and acceptance at `stage-02-revision.md:166`, `stage-02-revision.md:190`, and `stage-02-revision.md:197`. Source evidence supports this boundary: `js/app.js:2` says the modular entrypoint is unused, `index.html` has no local `./js` script/module load, and stale module cycle logic in `js/core/cycle.js:26-40` and `js/ui/payment.js:26-37` diverges from active runtime frequency/cycle logic in `index.html:3219-3220` and `index.html:7244-7255`.

Architecture: Option A is still the right sequencing. The revision tightens Option A by embedding Option C as the first slice (`stage-02-revision.md:31-32`) rather than allowing a security-only release that leaves attendance mutation active. It also keeps the monolith safe temporarily through a runtime-source invariant instead of pretending unused modules are live.

Strongest antithesis/tradeoff/synthesis:
- Antithesis: The strongest argument against Option A is that patching `index.html` first can entrench the monolith and keep duplicate service contracts alive longer. A big-bang module rewrite would give cleaner boundaries, and a lockdown-only slice would reduce the release surface.
- Tradeoff: Big-bang modularization delays P0 security/PII and attendance-corruption fixes; lockdown-only leaves split persistence, media durability, and schedule/group correctness unresolved. Staged modernization adds temporary adapters and requires discipline.
- Synthesis: Approve Option A only with the revised hard gates: Phase 1 must combine all public-asset PII removal, auth/rules lockdown, service-worker purge, and attendance no-write; Phase 0 must declare runtime source; Phase 4 must freeze/hash and quarantine media placeholders before split writes.

Deliberate principle violation flags: none remaining at the plan level. The current product still violates render purity, source-of-truth, authorization, and media-durability principles, but the revised plan names those violations and gates their removal instead of accepting them as deliberate architecture.

## Root Cause
The prior plan failed because key safety constraints were implied across later phases rather than promoted to release-blocking gates. The revised plan fixes the planning root cause by moving exposure, render-mutation, migration-consistency, media-durability, and runtime-source controls into explicit sequencing, gates, tests, and acceptance criteria.

## Findings
No remaining plan-level findings requiring changes.

Resolved prior findings:
- Former CRITICAL public static PII scope: resolved by full deployed-asset inventory, Phase 1 removal, scan gate, cache purge, and acceptance criteria.
- Former HIGH first-release attendance write risk: resolved by making the no-write kill switch part of the first executable release, not a later attendance workflow phase.
- Former HIGH migration drift risk: resolved by freeze/maintenance, live hash or server revision checkpoint, immediate re-export, and abort-on-drift gates.
- Former MEDIUM media placeholder risk: resolved by media manifest, placeholder quarantine, and `[saved]` failure/recoveryRequired semantics before split cutover.
- Former MEDIUM runtime-source drift risk: resolved by Phase 0 runtime-source policy and prohibition on behavior-only fixes in unused modules.

## Recommendations
1. Approve the revised plan for execution.
2. Keep the first executor slice indivisible: public-asset PII removal, auth/rules lockdown, service-worker purge, and attendance no-write kill switch must ship together as stated in `stage-02-revision.md:219`.
3. Preserve the planned review checkpoints: architect after Phase 1 and before Phase 4; critic before migration freeze/live hash/media quarantine cutover.
4. Treat any executor attempt to split off the no-write gate, skip public JS scans, migrate without live hash/revision, accept `[saved]` as success, or claim behavior from unused modules as a plan violation.

## Architectural Status
CLEAR

## Code Review Recommendation
APPROVE

## Trade-offs
| Option | Benefit | Risk | Architectural decision |
| --- | --- | --- | --- |
| Option A: security-first staged modernization | Fastest P0 reduction while preserving phased verification and rollback | Temporary monolith adapters and strict discipline required | Approved because revised gates prevent the unsafe splits identified in P1 |
| Option B: big-bang modular rewrite | Cleanest final boundaries | Delays PII/auth and attendance-corruption fixes; high regression/backout risk | Reject for first release |
| Option C: emergency lockdown/no-write only | Smallest safe production slice | Leaves overwrite, media, cycle, and schedule risks | Use as Phase 1 inside Option A, not as the full upgrade |
