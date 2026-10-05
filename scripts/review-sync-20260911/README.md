# Schedule sync: review-required candidate, NOT an applied runtime fix

Source: aljjang95/vocal-studio at 607409a149bce61644a7c288bf6fb0c52179fcc0.
Expected index.html Git blob: 2ebeecb25662ceeaa64ca296a13ca90e14150114.

## Scope and evidence

This directory contains a bounded seven-hunk hardening proposal, exact-source patch utility, extracted runtime fixtures and synthetic regression tests. It does NOT modify index.html, fix the remaining schedule-conflict protocol, prove a whole-repository review, or authorize deployment. The older js/infra/firebase.js implementation is not substituted for the active inline implementation. Hosting rewrites existing HTML aliases to index.html.

Executed in a separate Linux container with Node v22.16.0, NOT the owner's PC or Codex. Firestore/auth/render dependencies are mocks; non-schedule row reconciliation is mocked. No customer data or credentials are included. The connected Remote Desktop Commander device timed out and subsequently reported offline.

Measured results on the same behavioral suite: baseline 4/17 pass, candidate 17/17 pass. Patch utility pure-function safety tests: 6/6 pass. Remaining schedule acceptance tests: 0/2 pass (both failures are intentional release blockers, not expected production behavior). Extracted baseline and candidate JS syntax checks passed. The full-index patch, full application build/tests, Firebase emulator, actual browser/device journeys, independent review and signed proof were NOT performed.

## Confirmed unresolved release blockers

1. _mergeWeekOvr unions stale local keys back into remote data, resurrecting a deleted week/assignment. The listener can push this merged result back to the server.
2. Every save activates eight seconds of local preference. An unrelated local save can cause stale local lesson times to override newer remote times.
3. _pushToFirestore still replaces the entire shared document using set(payload), without a transactional version check. Concurrent-device data-loss risk is identified from code, not claimed as a completed live two-client test.

Do not replace the merge with unconditional remote-only data: that can discard unsent local work. A complete fix needs a server baseline, actual mutation tracking, deletion semantics, conflict handling, durable offline edits and compatibility with old clients.

## Bounded proposal

Request snapshot metadata; distinguish cache/pending echoes from server confirmation; always release the remote-application guard; render actual remote changes despite a stale skip counter; clear a failed listener so foreground/network events can reconnect; record duplicate-suppression signatures only after successful writes; avoid stale ACKs overwriting newer failure indicators; remove the extra direct weekly-reset write. This does NOT resolve the blockers above. Browser review must also check that a remote render does not discard an in-progress form draft.

## Reproduce

From this directory:

```sh
node --test tests/sync-hardening.test.mjs tests/patch-safety.test.mjs
node --test tests/unresolved-schedule.test.mjs
```

The second command must currently fail two tests. For baseline comparison, set VOCAL_VARIANT=baseline and run tests/sync-hardening.test.mjs alone.

After a real checkout is available, inspect an exact-source dry run:

```sh
node scripts/apply-sync-hardening.mjs /path/to/vocal-studio
```

The utility defaults to no-write. --apply explicitly writes only after checking the source blob, unique patch matches and inline-script syntax; it creates a private OS-temp backup and reports its location. It performs no Git commit, push, merge, deployment or database operation. The full-file dry-run/application was not executed in this review.

## Handoff / gate

State: review-required; device execution activation-required; release BLOCKED. Governing policy: APEX task-effort-routing-v1 and the existing owner-goal/living-constitution contracts. Native model/effort invocation settings unknown; no independent subagent was run. Do not self-approve this proposal.

Next: establish the authorized current checkout and live HEAD/diff, implement the unresolved deletion/concurrency protocol, integrate the candidate into the actual full runtime, execute existing regression gates and two-client add/edit/delete/offline-recovery journeys, obtain independent read-only review and exact-tree proof. Production and DB/permission changes remain separate owner gates.
