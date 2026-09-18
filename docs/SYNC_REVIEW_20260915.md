# Independent sync review record

Scope: local code candidate, not production or physical-device approval. The reviewer was a separate read-only native runtime from the builder. Local absolute paths have been removed; original reports and request/event logs remain in the working evidence directory. No private customer data or credentials were supplied.


## Initial independent review

Found **3 reproducible introduced issues** in the code scope.

1. **High — Raw media now enters the sync journal and transaction payload.**
   Location: `index.html:4576`, `vs-sync.js:26`, `vs-sync.js:202`.

   **Scenario:** Attach an audio/video file through the existing media workflow. The adapter supplies the in-memory records, including attachment `data`, directly to the controller. `normalize()` removes only top-level device pointers; the former `_stripMediaForSync()` call was removed from the write path.

   **Reproduction:** Using the supplied synthetic runtime fixture, I added an audio entry containing 1,200,000 base64 characters and saved it. The transaction received a **1,200,364-byte document**, retaining the full attachment. The existing sanitizer converts that same attachment’s `data` to `'[saved]'`.

   **Impact:** An ordinary attachment can exceed Firestore’s document size limit and prevent the entire document—including subsequent schedule and text edits—from syncing. Keeping the raw attachment in repeated journal snapshots also substantially increases storage consumption. The oversized payload was observed locally; no real Firebase request was made.

   **Minimal fix/test:** Restore a consistent media-safe representation for comparison, journaling, and cloud writes while retaining playable local media through the existing device storage path. Add a runtime test with a large audio/video attachment and a subsequent schedule edit; assert that outgoing data excludes inline media, the schedule can sync, and local playback references survive.

2. **High — Reload after a failed journal write overwrites newer locally saved edits without retaining them in sync recovery.**
   Location: `vs-sync.js:130`, particularly the unconditional saved-state display at line 131.

   **Scenario:** Start with a confirmed `10:00` schedule. Change it to `11:00`; the application’s ordinary local save succeeds, but the session journal write fails. Reload with the older session journal and the newer application data. A new controller has no `unbound` flag, so `connect()` displays the old journal before capturing the current application data.

   **Reproduction:** I injected the journal failure, then constructed a replacement client using the same journal and the edited application data. Its resulting state was **`10:00`, `pending=0`, `recovery=[]`**. The newer `11:00` value was overwritten.

   **Impact:** A storage failure followed by reload silently removes the edit from active state and the new sync recovery export. The real adapter also calls `_saveAllOrig()` during that display, writing the older values back into application storage. Separate legacy recovery snapshots may still contain the edit, but this resume path does not preserve or surface it.

   **Minimal fix/test:** Capture application data before restoring a journal. When it diverges, durably retain it as a recovery candidate before any display or storage overwrite; do not automatically promote unconfirmed differences into cloud operations. Extend the quota test to reload with an older journal and newer application data, asserting that the newer edit remains recoverable.

3. **Medium — Each reload leaves another permanent full-state backup, eventually blocking synchronization.**
   Location: `index.html:4571`, `vs-sync.js:102`.

   **Scenario:** Reload the same tab repeatedly. Each page initialization generates a new instance UUID, and every instance writes a separate `:backup:<instance>` entry into shared localStorage. Existing backups are neither reused nor retired. Backup-write failure makes `persist()` fail even when the session journal write succeeds.

   **Reproduction:** With unchanged data and a synthetic 4,000-character backup capacity, eight reloads accumulated **eight identical 454-character backups**. Reload eight entered `storage-error`; a subsequent edit and explicit retry produced **zero writes** and remained blocked.

   **Impact:** Normal reloads consume increasing permanent storage until sync stops. Retrying cannot reclaim the redundant copies, and the accumulated entries compete with the application’s existing local data.

   **Minimal fix/test:** Persist a stable per-tab backup identity across reloads and bound retention of superseded clean backups while preserving unresolved edits. Add a bounded-storage test that repeatedly reloads one tab and verifies stable backup usage and successful subsequent saving; retain the separate-tab isolation test.

I verified HEAD against base **`607409a149bce61644a7c288bf6fb0c52179fcc0`** and confirmed the supplied index SHA-256 **`dc23b23e776ad13127601e7db4b9e39bbac14c6173fdf597d81c0be91f37a6f5`**. I read all of `vs-sync.js`, both requested test files, and the current diffs for `index.html`, `sw.js`, and `scripts/regression-gates.mjs`.

I personally ran:

- `node --test scripts/sync-protocol.test.mjs scripts/sync-runtime.test.mjs` — **34 passed, 0 failed**.
- `node scripts/regression-gates.mjs` — returned **`ok: true`**, parsed eight inline scripts, and reported **`invariantCount: 60`**.
- Three additional in-memory reproductions described above — all reproduced successfully in the final probe run.

Coverage included schedule deletion/staleness, record identity, same-item conflicts, unknown-field preservation, transaction retries, ACK ordering, edits during saving, account epochs, storage/reload behavior, media payloads, and form deferral. I inspected the sibling Chrome QA evidence; I did **not** personally rerun browser QA. That evidence uses synthetic Firebase transport, not an emulator or physical phone. I made no edits, commits, production/network calls, or subagent calls. This is a code-scope review, with no overall release approval.


## First correction review

**H1: CLOSED. H2: remains High for a reproducible undo-to-baseline case. M1: CLOSED.** This assessment is limited to the three findings and their closure delta.

1. **H1 — CLOSED: oversized media payloads.**
   The revised normalization sanitizes photos, audio, video, and consent recordings before journaling and transaction construction. The active adapter invokes `retainLocal()`, which restores attachment playback data and pointers for matching surviving identities.

   I personally ran the added tests covering 1.2 MB audio/video attachments, bounded journal/payload sizes, a subsequent successful schedule save, and retention/removal of local playback identities. They passed.

2. **H2 — Remaining High: a newer undo matching `saved.base` is discarded, and the cancelled edit is uploaded.**
   Location: `vs-sync.js:176`, followed by restored-journal display at line 179.

   The original `10:00 → 11:00` failure/reload reproduction is fixed. However, the added `!equal(startup,saved.base)` condition excludes a legitimate newer undo from recovery.

   **Personally reproduced using the current runtime fixture:**

   - Start with confirmed schedule `10:00`.
   - Change to `11:00`; inject a transaction failure. The durable journal now contains `base=10:00`, `local=11:00`.
   - Undo to `10:00`; inject a journal-write failure while retaining the newer application data.
   - Reload with that application data and the older journal, with storage available again.

   Because startup data equals `saved.base`, `connect()` skips recovery, displays the cancelled `11:00` edit, and subsequently uploads it. Observed result:

   ```text
   latestUserValue: 10:00
   reloadedUI:      11:00
   server:          11:00
   recovery:       []
   pending:        0
   writes:         1
   ```

   **Impact:** The user’s latest undo is silently discarded, and the superseded edit becomes confirmed server state. This remains the journal/reload data-loss class identified in H2.

   **Minimal fix/test:** Preserve a startup candidate that differs from `saved.local` even when it equals `saved.base`, or use durable provenance to distinguish a newer undo from stale application data. Add the exact transaction-failure → undo → journal-failure → reload sequence above; the undo must remain recoverable rather than being silently treated as absent.

3. **M1 — CLOSED: backup accumulation on reload.**
   The per-namespace session identity is reused across reloads. Duplicate retirement requires a successfully written, byte-identical clean replacement; pending, ACK-bearing, and differing recovery copies do not qualify. I personally ran the 20-reload tests, including the 4,000-character capacity followed by a successful save, and the copied-tab identity isolation test. They passed.

Both supplied SHA-256 bindings matched:

- `vs-sync.js`: `d6cef2ab2b58c9927a1c67f170fe4166c13bbf15ed91f8f68bb40473e419b17f`
- `index.html`: `14f7af413b940081e9aa0fae78d971e8e50b0ae510bf71753ff49b6654245b91`

**Personally executed coverage:** current Node suite **40 passed, 0 failed**; regression gate returned **`ok: true`, `invariantCount: 60`**; the additional H2 reproduction above completed successfully. I did not rerun Chrome, IndexedDB, or WAV decoding, so the reported 35 browser checks are not my personally executed coverage.

No edits, agents, or production/network calls. **No whole-release approval.**


## Undo correction closed

**H2: CLOSED. H1 and M1 remain CLOSED.**

I reviewed the final undo delta and the new last runtime test. The restore path now retains startup data whenever it differs from `saved.local`, including an undo that equals `saved.base`. When that divergence involves pending changes or an ACK, `resumeConflict` prevents journal display, ACK application, and automatic writes until explicit recovery selection.

I personally ran:

```text
node --test scripts/sync-protocol.test.mjs scripts/sync-runtime.test.mjs
41 passed, 0 failed
```

The regression covering my exact remaining reproduction passed:

- Confirmed schedule starts at `10:00`.
- Saving `11:00` encounters a transaction failure.
- Undoing to `10:00` encounters a journal-write failure.
- Reload preserves visible `10:00` and durably retains it in recovery.
- The synthetic server stays at `10:00`, with **zero writes**, including after retry.
- Explicit `useServer()` resolves the conflict at `10:00` with no pending changes.

The ordinary offline-pending and deferred-ACK reload tests also passed with the corrected fixtures supplying saved application data alongside the journal. I found no reproducible Critical/High/Medium regression directly introduced by this H2 delta.

Both file bindings matched:

- `vs-sync.js`: `1989d49f8ea26e742141278e60b1d29d780835a80358f7f5befa3e9470d2df5f`
- `index.html`: `14f7af413b940081e9aa0fae78d971e8e50b0ae510bf71753ff49b6654245b91`

This closes the remaining H2 code finding. No files were modified, no agents were used, and no network or production calls were made.


## Final layout delta

**NO_ACTIONABLE_FINDINGS** for this narrow layout delta. **H1, H2, and M1 remain CLOSED.**

I reviewed the supplied patch, relevant CSS and DOM context, `scripts/verify-sync-browser.py`, the specified browser-results JSON, and the retained desktop-schedule and mobile-conflict screenshots.

The changes allow the main flex item to shrink, enable desktop toolbar wrapping, and move the existing sync status and controls outside the mobile header’s clipping rules. The status overrides address the existing absolute positioning, nowrap, and pointer-event restrictions. Sync controls retain their callbacks and enforce minimum **44 × 44 px** targets. I found no concrete introduced Critical/High/Medium issue within this scope.

**Personally executed:**

- `node --test scripts/sync-protocol.test.mjs scripts/sync-runtime.test.mjs` — **41 passed, 0 failed**.
- `node scripts/regression-gates.mjs` — **`ok: true`**, reported **60 invariants**.

The inspected browser report records **43 passing assertions**, no page errors, and zero production Firebase requests. Its script covers populated schedule assignment through actual cell selection and save controls, desktop schedule-engine verification, and mobile conflict-control bounds. **I inspected that evidence; I did not rerun the browser tests.** They use synthetic Firebase transport, not a real backend or physical phone.

Both supplied SHA-256 bindings matched:

- `index.html`: `c16b91cc186f96c310fbf6a0795900e9aecd0a0181e34f71686e8b210f8ca770`
- `vs-sync.js`: `1989d49f8ea26e742141278e60b1d29d780835a80358f7f5befa3e9470d2df5f`

No edits, agents, network, or production calls were made.
