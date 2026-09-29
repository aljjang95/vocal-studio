# HLB schedule and storage acceptance

Product: `hlb-vocal-studio` (`aljjang95/vocal-studio`). Public intake is the separate `hlb-vocal-studio-next` repository, coordinated as one user journey.

## Accepted source and scope

- Candidate: `72e7951ce226f2bb2f4dd275188b59cb43959b55`, branch `codex/schedule-quota-integration-20260929`, integration PR #16.
- Existing production backend: `9d9f192ab346799c1e43f125000b6607c5e552e2`; public-intake and Telegram behavior preserved. Original portraits are unchanged.
- Schedule: explicit biweekly choice, collision rejection, preservation of confirmed lessons and manual/empty week overrides, direct date/time changes across weeks, mobile weekly overview and accessible attendance controls.
- Storage: lossless own-backup compression, no automatic deletion of other writers' mutable sync backups, and strictly guarded omission of a new clean server-confirmed duplicate. Edits, ACKs, unique metadata and recovery history still require durable persistence before transmission. See `docs/SYNC_PROTOCOL.md`.

## Acceptance evidence

- Local automated validation: 161 tests, 92 invariants, build and Wrangler upload dry-run passed.
- Independent review: 55 runtime regressions; 10 codec/controller cases including 25 codec variants; 20 clean-allocation guards; 3 cross-tab deletion cases; 1 insufficient-capacity retry boundary passed. The inherited read/remove race was reproduced in the previous version and is closed by eliminating peer deletion.
- Schedule independent review: 15 cases and browser journeys at 1440, 390 and 360 px. Author browser suites: new-student 18 cases, biweekly 47 cases, no reported JavaScript errors.
- Actual integrated local Worker/browser: approximately 5.2 million stored characters; existing-tab and fresh-tab schedule edits, acknowledgements and reloads succeeded. A 120,000-character memo and seven historical recovery variants retained their bytes. A separate synthetic capacity test confirms blocked transmission and retained session intent when another durable backup cannot fit.
- Production initial release: Worker `b3f665b5-1510-4a16-8dd9-3c157b6ee42f`, deployment `28b66f04-9236-4263-ac03-7757ddeb63fc`, 100% traffic. Served runtime hashes match the reviewed artifact. Confirmed server revision 28 and aggregate state hash remained unchanged during read-only release verification.
- After preserving an existing unsent local conflict in private recovery files, the application's server-view recovery restored a coordinator-owned validation tab. A separate fresh 360px tab reached `synced`, `ready=true`, `blocked=false`, `pending=0`; no horizontal overflow. The inquiry view rendered all 184 records (counts only recorded). Production customer data was not edited or re-submitted.

## Artifact identity

| Asset | Served/reviewed SHA-256 |
| --- | --- |
| `index.html` | `22c3df36cd2f17f11d934006cc4f836039e5d25d5665271bd1f5a30e41da4ea9` |
| `v3-daylight.css` | `f2f22822ac0d8bd09126fea6526c2a2ec84a4a621d26e72e111abd9b693ab43d` |
| `vs-sync.js` | `e43bb2a344424f2e5298480d6d27b275a1b1604400b3614fc0e083a371d0c136` |

The committed sync blob is `923e02ce209a6855729861109a41b19a6ed9ac862cff971e84e5bada9b6f136a`; it matches the reviewed working artifact after CRLF-to-LF normalization, not as raw bytes. Final merge and deployment identifiers are recorded in PR #16 after completion. No GitHub Actions were enabled.

## Limits and recovery

- Physical-phone operation, a second physical device, and unattended execution are unverified. Responsive-browser testing is not physical-device proof.
- A true quota limit can still block an additional editing tab; the system preserves intent and fails closed. Do not clear browser storage to recover.
- One coordinator-created browser tab hit a tool-level confirmation-dialog timeout. That tab's recovery data was privately exported before the attempt; independent fresh-tab verification succeeded. Production click-through testing of that stalled dialog is not claimed. The successful local UI journeys and production rendered inquiry view are separate evidence.
- Rollback version: `35914b07-b46b-48b8-88de-f85966a2a93c`. Reassign traffic with Wrangler versions deploy if necessary, preserving all browser backups. Older code cannot decode the new compressed backup envelope; retain the current decoder and export capability when recovering data.
- Public intake remains source `e9da0e4868770f453fcc9621d50261103932db6a`, Worker `fa401cf7-cb89-4492-b852-718f16a17316`. The previously verified form-to-inquiry-to-Telegram flow and idempotent replay were not repeated against live customers for this frontend/storage release.

## Continuity

Operating-document pointer: `aljjang95/apex-skill-forge@a9010f63c74ad86c8244fea88d4e207bc37b467e`, `docs/PRODUCT_OPERATIONS_CONTINUITY.md` and `chatgpt-work/global/portfolio-registry.md`. This pointer does not assert main merge, global installation, automatic recovery or unattended operation of that separate repository.

Next release action: complete the reviewed integration PR and bind the exact merged source to a Wrangler version; record its identifiers and readback in PR #16. Preserve private customer recovery files locally, outside tracked source. Do not publish them as release evidence.
