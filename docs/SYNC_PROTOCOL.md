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
