# Vocal Studio Cloudflare synchronization protocol

Protocol header: `X-VS-Protocol: vs-cf-1`

Status: candidate under release closure; production deployment/data cutover is not implied by local verification.

## Trust boundary

Every application asset and API request passes the Worker first. Production authentication is Cloudflare Access JWT verification using the official `jose` verifier with issuer, audience, and server-side email allowlist checks. Mutations also require `Origin` to exactly equal the Worker request origin.

The canonical state lives in one SQLite Durable Object selected by the fixed `vocal-studio` namespace. Private media lives in the `vocal-studio-media` R2 binding. Browser local/session storage is recovery/cache state only; it is never the canonical server source.

## State lifecycle

A missing Durable Object state is returned as missing. It is never bootstrapped by application first load.

`POST /api/import` is accepted only while the destination is empty. The imported state is stored as revision 0 in `staged` mode. Staged state is readable but rejects normal commits. `GET /api/export` records a hash/revision readback tied to the authenticated principal. `POST /api/activate` succeeds only when that same principal has a recent readback matching the staged hash and revision.

Once active, `POST /api/commit` requires an exact `baseRevision`. A different current revision returns conflict rather than applying a stale write. Each request ID is bound to the exact request payload; exact replay returns the stored response, while reuse with a different payload is rejected. Compatible writes preserve unknown root fields and increment the canonical revision.

## Browser journal and recovery

`vs-sync.js` compares explicit local edits with the last server-confirmed baseline and writes through a transaction-shaped Cloudflare transport. Server deletions and same-item concurrent edits remain conflicts; unrelated records and server fields survive. Inline media bodies are excluded from state diffs and journals, while stable media pointers stay attached only to matching surviving records.

Each tab has a session journal plus persistent recovery backups. The Cloudflare adapter adds a principal-bound local owner marker. On an authenticated but not-yet-hydrated reload, `resumeData(owner)` can load the durable `vsC_*` copy only when that marker exactly matches the current principal.

If that durable copy differs from a pending or acknowledgement journal, the previous journal-local state is copied into recovery, the durable copy becomes the displayed local state, `resumeConflict` is set, and flush is blocked. This prevents the failure sequence `server 10:00 -> pending 11:00 -> journal persistence failure -> user undo 10:00 -> unhydrated reload` from silently replaying the old 11:00 edit. The old 11:00 value remains recoverable evidence only.

Recovery controls remain explicit: retry re-reads the canonical server; device backup exports local recovery evidence; server-choice archives the disputed local state and adopts the latest confirmed server view. No automatic union of old recovery snapshots is performed.

## Media protocol

Media uploads use same-origin `PUT /api/media/<pointer>`. Pointers are validated and immutable: an existing object returns conflict. The maximum body is 20 MiB. The Worker exposes authenticated GET/HEAD with byte ranges and 416 handling; this candidate has no media delete endpoint and no arbitrary URL proxy.

Data URLs are decoded into a Blob in browser memory. The client does not `fetch(data:)`, so the production CSP can keep `connect-src 'self'`. IndexedDB remains the local byte cache/queue. A failed R2 PUT changes the queue item to `retry`; the retry action remains visible even if schedule state is synchronized. Online reconnect and authenticated hydration schedule media draining. Only a successful Worker PUT changes the queue record to `uploaded`.

## Service worker

The service worker is network-only and deletes prior `vs-v2-*` caches during activation. Authenticated application/runtime content is not served from an old offline cache.

## Verification surfaces

The release closure uses three different evidence layers and does not conflate them:

- Node protocol/regression tests exercise merge, deletion, concurrency, journal, owner-switch, and exact High/Medium review regressions.
- `scripts/test-cloudflare.mjs` starts real local Wrangler and validates Static Assets, SQLite Durable Object transitions/CAS/idempotency, and local R2 PUT/range/HEAD/error behavior.
- `scripts/verify-sync-browser.py` opens the actual `index.html` in installed Chrome against that Worker, reproduces the unhydrated-reload conflict and media PUT failure/retry/recovery, then checks desktop plus 390/360 emulated mobile viewports with page-error capture.

These tests are local evidence. They do not prove production customer import, production Access login/logout, production deployment, or physical-phone dogfood.

## Reconstruction provenance

This candidate was reconstructed in an isolated worktree from remote commit `692299743ffde2b362d5fd5589449a97d59290e9` because the previously described Cloudflare candidate branch/worktree was not present on the currently connected PC and had not been pushed to GitHub. The reconstruction follows the handoff contract and is re-verified from scratch; it must not be represented as byte-identical recovery of the inaccessible earlier local candidate.

## Concurrent changes and resumed tabs

The WebSocket subscription's `hello` revision is compared with the latest confirmed read, just like a change notification. A mismatch refreshes immediately, closing the interval between the initial (or reconnect) GET and socket registration. A matching revision does not cause another GET; the five-minute audit remains a fallback.

Existing record updates use a three-way comparison of the confirmed base, this tab's requested value and the current server value. Changes to different properties of the same record can merge, including nested properties and property deletion. Two different replacements for one property, deletion versus editing a record, and ambiguous record identities remain conflicts with the unsent value preserved. Arrays stay atomic except a weekly assignment list whose three versions each contain at most one entry per day; those lists can merge independent changes to different days. Multiple entries for the same day remain atomic because they lack stable slot identities.

An unhydrated page without an owner-bound durable cache does not treat its temporary empty UI as a user edit. A versioned, confirmed session journal is more authoritative than an unversioned shared application cache: divergent cache data is retained in recovery, without inferred server writes or a fabricated conflict. A genuinely pending journal versus a different meaningful local value retains the existing ambiguity guard. A legacy resume hold can clear only when there is no pending ACK and its exact current local value is already confirmed by the server; all alternate recovery snapshots remain preserved.

## Backup quota recovery

The controller never automatically deletes another tab's mutable sync backup, including byte-identical, server-confirmed or contained copies. Web Storage has no atomic compare-and-delete; another tab can write unsent intent after the final comparison and before removal. This restriction applies both after a successful write and during quota recovery. Reloads reuse their own instance key; separate tabs keep separate backups.

A clean new tab may omit allocating a new durable duplicate after its plain session journal passes write/readback. This requires the current authenticated owner, an exactly matching confirmed server revision and data, the exact version-1 journal field set, equal base/local values, an empty recovery array, and no existing own backup. ACKs, pending edits, unknown metadata and recovery copies cannot use this exception. Existing own backups are never deleted by this policy. A later edit still requires a full durable write before any server transaction: a fresh tab can read confirmed data while its first edit remains blocked if quota cannot fit another distinct backup. Simultaneous editable tabs are bounded by available storage; no unlimited-capacity claim is made.

Legacy session rescue copies remain readable and included in device export. Session journals have the browser's normal tab lifetime and are not permanent archival storage. Export a device copy before closing a tab whose recovery matters.

When a large new backup cannot fit, the controller first tries lossless compression of that tab's own replacement value. Tagged JSON subtree references share unchanged rows and strings across the base, edited state, recovery copies and pending acknowledgement. This avoids requiring a second full encoded snapshot after ordinary or disjoint field edits. The serialized journal must round-trip exactly before writing, and the stored value is decoded and checked again before reporting success. Unknown fields, reserved property names and Unicode remain intact. Existing historical backups are not migrated or rewritten by this compression step.

The localStorage envelope uses version 2 with `vs-lz-utf16-1` encoding, a `json-tree` or `raw` layout, original character length and a corruption checksum. Legacy plain JSON backups and the earlier `repeat-base` layout remain readable. The synchronous session journal stays plain JSON, and device export returns decoded journals. The embedded lz-string 1.5.0 implementation is unmodified and retains its MIT notice. If compressed storage still fails, only the existing adapter app-cache reclamation hook is tried; foreign sync backups remain untouched; saving remains blocked rather than silently discarding an unsent variant. Quota compression does not promise unlimited storage or permanent archival of session-only rescue copies.

Rollback preserves the raw session journal and historical backups. Older code does not understand new compressed localStorage envelopes; use a version with this decoder to export those copies. Never clear browser data as a rollback procedure.
