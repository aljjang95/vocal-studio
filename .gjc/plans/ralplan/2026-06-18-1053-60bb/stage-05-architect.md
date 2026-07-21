## Summary
G001 baseline evidence is sufficient to mark the Phase 0 safety inventory complete and start G002. The inventory captures the authoritative runtime, stale public/static surfaces, PII-bearing static data, render-triggered attendance mutation, Firebase/Storage rule exposure, current counts/hash evidence, and focused G002 verification gates.

## Analysis
- Public static surface coverage is explicit in tmp/ultragoal-g001/g001-baseline.json: runtimePolicy names index.html as authoritative and stale/reference surfaces as vocal-studio.html, vocal-studi.html, and js/**/*.js; publicStaticAssetInventory lists HTML, sw.js, manifest, Firebase config/rules, JS, CSS, and icons. index.html:10-18 confirms manifest plus Firebase SDK script surfaces, and sw.js caches ./, ./index.html, manifest, and root icons.
- PII surface coverage is sufficient for G001. The baseline calls out index.html student seed data and inquiry seed data; inspected runtime evidence confirms _DEFAULT_STUDENTS embeds names/phones/ages/schedules at index.html:3050, is copied/merged into local state at index.html:3185-3195, is merged into Firestore-loaded state at index.html:3597-3600, and inquiry seed phone numbers are injected at index.html:5741-5754. Owner phone/bank-account template evidence is present at index.html:8545, index.html:8574-8575, index.html:8846, and index.html:10010-10053. The baseline also inventories stale HTML and js/**/*.js PII surfaces for G002, matching the assignment constraint that those are public/static surfaces to carry forward.
- Automatic attendance mutation coverage is accurate. buildTodaySchedule() calls autoFillPastAttendance() at index.html:4634-4636; the mutator backfills prior slots, appends _auto attendance log entries, sets vsC_lastAutoFill, and calls saveAll() at index.html:4554-4619. saveAll() is overridden to push to Firestore when ready at index.html:3769-3816, so the baseline correctly treats a render/navigation path as capable of mutating localStorage and the shared document.
- Firebase/rules/storage coverage is sufficient to start G002. initFirebase() signs in anonymously and starts the listener even after auth failure at index.html:3547-3559; the listener reads/merges /studio/data at index.html:3571-3628. firestore.rules:4-5 allows read/write on /studio/{docId} for any authenticated user, and firebase.json only references firestore.rules. index.html:3454-3458 configures a Storage bucket and index.html:3659-3684 uses Firebase Storage uploads, while no Storage rules reference exists in firebase.json; the baseline Storage/rules G002 gate is therefore necessary and correctly scoped.
- Data evidence is present in the baseline without exposing raw customer data: it records legacyDocHashSha256, byte length, local and remote counts, and names the count/hash evidence files and recovery artifacts. This is enough for G002 to compare pre/post counts and document hash during no-write and authorization checks.
- G002 gates are focused and non-tautological: PII scan, unauthorized denial, authorized load/fail-closed local-dev behavior, no-write render behavior with counts/hash, service-worker purge/version, and Storage/rules config. These gates directly cover the risks observed in the inspected runtime and config files.

## Root Cause
No G001 defect found. The underlying safety work is driven by a legacy monolithic public static app that seeds real customer data, uses anonymous broad Firestore access, has Storage upload capability without a versioned Storage rule surface, and performs render-time data mutation.

## Findings
No blocking or material G001-completion findings.

## Recommendations
1. Mark G001 complete and start G002 from this baseline.
2. Treat G002 as the indivisible release described in the baseline: remove static PII, lock auth/rules, purge/update service-worker cache behavior, and disable render-triggered attendance writes before deployment.
3. Carry the inspected Storage upload path (index.html:3659-3684) into G002 implementation notes so the Storage/rules gate preserves authorized media behavior while denying unauthorized access.
4. Use the recorded counts and legacy document hash as mandatory pre/post evidence for no-write render and authorization checks.

## Architectural Status
WATCH

## Code Review Recommendation
APPROVE

## Trade-offs
| Option | Benefit | Risk |
| --- | --- | --- |
| Complete G001 now and start G002 | Baseline is complete enough and keeps execution moving to the actual safety fixes. | Requires G002 to honor all gates atomically. |
| Expand G001 with more inventory before starting | Could add redundant line-level detail for every stale/reference file. | Delays fixes while the current baseline already captures the required public/static surfaces and verification gates. |
