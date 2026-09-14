# Schedule synchronization candidate

Status: **local code review completed; signed-proof and production gates pending; not released**. Base: `607409a149bce61644a7c288bf6fb0c52179fcc0`.

## Active implementation

`index.html` loads the root-level `vs-sync.js?v=20260915-r1`. The root location matters: Firebase Hosting excludes `js/**` and `scripts/**`. Missing protocol code disables remote saves rather than falling back to the previous whole-document overwrite.

The controller compares explicitly saved local edits with the last server-confirmed baseline. A Firestore transaction reads the latest document, checks each changed record or weekly assignment, and applies only compatible changes. It retains unrelated server fields and increments `_vsSyncRevision`. Exact record IDs distinguish multiple lesson/payment records for one student. Missing or duplicate IDs require an atomic collection comparison; records are never deduplicated by student ID.

Deletion is an explicit before/after operation. An unchanged stale assignment cannot resurrect a remote deletion. Conflicting edits to the same item stop the write and retain local intent. The transaction callback has no UI or journal side effects. Snapshot metadata, session epochs, and a durable acknowledgement envelope distinguish cached data, pending writes, late responses, and edits made while a write is in flight.

Each tab keeps its journal in session storage, with a stable backup identity across reloads and persistent recovery copies in local storage. A newly navigated copied tab forks its backup identity. Byte-identical clean copies are retired only after an identical replacement is durable; unresolved or different recovery copies are preserved. Reloading the same tab can resume pending work. A new tab without that journal adopts server data and retains divergent local data as recovery; it never automatically uploads a union of old records. Closing a tab is not equivalent to a tested automatic recovery/import workflow: persistent copies are available through the local export control.

## Recovery controls

- **다시 확인** requests server-confirmed data and retries compatible pending changes. Freeing local storage and using this control retries a held journal write.
- **기기 보관본** downloads the current journal and local backup copies as JSON. This file can contain student information; keep it private.
- **서버 기준 사용** asks for confirmation, archives the pending local snapshot, and adopts the last confirmed server view. It does not upload the discarded local edit.

Synchronization status remains visible in its own strip, with at least 44-pixel recovery controls. The populated desktop schedule allows toolbar wrapping rather than expanding the document. Open modal forms and focused inputs defer remote rendering. When application data and a pending restored journal disagree, automatic saving pauses for an explicit recovery choice, including an undo back to the confirmed baseline. Large inline photos/audio/video/consent are excluded from comparison, journals, and transactions using the prior media-safe thresholds. Existing photo/media pointers and playable local data are retained only on matching surviving records and attachment IDs. The previous app design is otherwise preserved; this is not the earlier proposed full visual redesign.

## Local verification

Use a normal clone with Node.js. Node 24.14.1 was used for this candidate:

```sh
node scripts/sync-baseline-red.mjs
node --test scripts/sync-protocol.test.mjs scripts/sync-runtime.test.mjs
node scripts/regression-gates.mjs
```

The baseline command deliberately reproduces three defects in the pinned old source; a successful command means the expected defects were reproduced, not that the baseline is safe.

For browser checks, use Python with Playwright and an installed Chrome browser:

```sh
python scripts/verify-sync-browser.py --output ../vocal-studio-browser-evidence
```

This starts a temporary localhost server, runs the actual app in isolated desktop/mobile Chrome contexts, and closes the server. External requests are blocked. Authentication and transaction transport are explicitly synthetic. The tests cover both directions of schedule changes, deletion preservation, separate lesson records, an existing form's focused text, and navigation/overflow at 1440, 390, and 360 pixels. Generated output is evidence, not a deployable app asset.

## Release gates and limitations

Passing these tests does **not** establish a production Firestore, physical-phone, media-upload, permission-rule, or complete visual acceptance result. Before release:

1. Complete independent read-only review and exact-tree evidence/proof. Do not use the builder's own test report as an independent approval.
2. Verify with the real Firebase emulator/SDK and then the separately authorized production/physical-device surface. No production data was read or changed during these local checks.
3. Retire or block old writer clients. An old app can still submit blind writes under unchanged rules; client-side revision checks cannot prohibit that writer. Firebase authentication, rules, and migrations were deliberately not changed.
4. Confirm the hosting/release route and rollback. A repository merge is not a production authorization, and no GitHub Actions/workflows are part of this verification route.
5. Exercise realistic storage and media sizes, recovery across a closed tab, and the local recovery export/import process. Full snapshots and genuinely different recovery copies still consume browser storage; blocked writes are retained rather than falsely reported as synchronized. A divergent application snapshot is archived before a restored session journal may overwrite the current view.

The candidate does not perform migration bootstrap, overwrite a missing server document, auto-resolve concurrent edits, or invent missing customer records. Server selection is explicitly local recovery behavior, not a merge of disputed data.

## Rollback

Keep a copy of the candidate's local journals and recovery exports before any rollback. The exact prior source is commit `607409a149bce61644a7c288bf6fb0c52179fcc0`. Returning to it reintroduces the documented old sync defects; never downgrade an active writer population without a controlled read-only/backup phase. Repository source rollback and production-data recovery are separate operations requiring their own evidence and authorization.
