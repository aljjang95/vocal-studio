## Summary
Vocal Studio already has pragmatic client-side resilience: localStorage snapshots, IndexedDB media keys, Firestore realtime sync, photo compression, and an offline shell. The architecture is still not safe enough for durable studio records because access control, offline conflict handling, and media durability are client-only and can silently lose or expose data.

## Analysis
Inspected target files: index.html, sw.js, firestore.rules, firebase.json. Evidence is from the requested files only.

Current strengths:
- index.html:3052-3068 wraps localStorage parsing and writes with a recovery fallback and temporary key write.
- index.html:3078-3091 writes a rolling recovery snapshot and keeps five local snapshots.
- index.html:3227-3274 creates an IndexedDB media store and keeps media references through _mediaKey.
- index.html:3277-3324 strips large media from localStorage to avoid quota failure, with a media-stripped fallback.
- index.html:3577-3627 uses a Firestore onSnapshot listener and identity merge to reduce simple remote overwrite cases.
- index.html:3636-3708 compresses photos and prefers Firebase Storage URLs instead of keeping large base64 values in Firestore.
- sw.js:37-41 avoids service-worker caching for Firestore/Firebase/Google API requests, protecting realtime paths from stale cache responses.
- sw.js:47-66 uses network-first navigations and cache-first static assets, giving a working offline shell.

## Root Cause
The app treats a single public client as the owner of all durable data. Anonymous authentication gates broad Firestore access, all entities are saved as one studio/data document, offline writes have no durable pending-write ledger or per-record revision, and media is reduced to local-only placeholders after save. This makes privacy, concurrent editing, offline recovery, and cross-device media availability fragile.

## Findings

1. Severity CRITICAL - Anonymous auth plus broad Firestore rules exposes all studio data.
Reference: index.html:3551-3558 signs every visitor in anonymously and then starts Firestore. firestore.rules:4-5 allows read and write to /studio/{docId} for any request.auth != null.
Impact: Anyone who loads the public app can become authenticated and read or overwrite the entire studio document, including names, phone numbers, schedules, payment state, logs, and inquiries.
Fix: Replace anonymous broad access with explicit user authorization. Use Firebase Auth users plus custom claims or an allowlist, include studio membership in rules, restrict doc IDs, validate schemas and field sizes, and consider server-mediated writes for critical changes. Add App Check as abuse reduction, not as the only authorization boundary.

2. Severity CRITICAL - Real personal data is embedded in the public HTML bundle.
Reference: index.html:3050 defines _DEFAULT_STUDENTS with names and phone numbers. index.html:5739-5756 injects initial inquiries with phone numbers. sw.js:8-14 caches index.html as a core shell asset.
Impact: Private studio data ships to every browser before any meaningful authorization and can be cached offline by the service worker. Firestore rules cannot protect data already present in index.html.
Fix: Remove real seed data from the static bundle. Store bootstrap data in protected Firestore documents or a one-time admin import path, and keep only schema/demo data in public assets.

3. Severity HIGH - Single-document full-state Firestore sync can lose offline or concurrent edits.
Reference: index.html:3577-3627 consumes one studio/data snapshot and merges arrays. index.html:3769-3793 writes the full payload with docRef.set. index.html:3804-3815 overrides saveAll to push after local save, but only when _fbReady and not applying remote. The conflict model is an 8 second _localProtectUntil window at index.html:3452 and 3808.
Impact: Edits to the same student, consultation, payment, or log from another device can be overwritten by a later full-document set. Offline edits to existing records can be overwritten when a remote snapshot arrives after the local protection window, because _mergeByIdentity keeps remote values unless preferLocal is active. The single document will also grow toward Firestore document limits as logs and inquiries accumulate, even after media stripping.
Fix: Split data into collections such as students, logs, consults, payments, inquiries, and mediaRefs. Give every record updatedAt, updatedBy, deletedAt, and revision fields. Use batched writes or transactions for multi-entity operations. Maintain a durable pending-write queue and reconcile by per-record revision, not by whole-document replacement.

4. Severity HIGH - Media durability is not guaranteed after data is stripped from localStorage and Firestore.
Reference: index.html:3245-3274 queues or writes media to IndexedDB, but callers at index.html:4248, 4288, 8310, and 9445 ignore the success callback. index.html:3281-3324 and 3736-3750 replace large data with [saved]. index.html:8366-8389 can reload normal media from IndexedDB, but consent recordings are rendered directly from savedConsent.data at index.html:8436-8438 and index.html:9903-9905. Consultation inline audio at index.html:9613-9614 and 9738-9739 is saved without _mediaKey.
Impact: If IndexedDB is unavailable, still opening, quota-limited, or the write fails, saveAll can strip the only in-app media copy. On reload or another device, normal media falls back to Downloads and consent audio can render src=[saved]. Some consult-form media has no IndexedDB key, so it cannot be restored after stripping.
Fix: Treat mediaSave as a required asynchronous commit before stripping data. Store media as Blobs in IndexedDB with quota/error handling, and upload durable media to Firebase Storage with metadata records. Use the same mediaLoad path for consentRec and consult-form media. Surface failed media persistence instead of saving a placeholder as success.

5. Severity MEDIUM - Recovery snapshots exist but are not operationally recoverable enough.
Reference: index.html:3078-3091 writes recovery snapshots, and index.html:3052-3062 only uses the latest snapshot when JSON parsing fails. Search found no general restore UI for vsC_recovery snapshots; visible restore paths are for consult drafts at index.html:9455-9504 and 10379-10381.
Impact: Valid but stale remote data can overwrite valid localStorage, and the recovery fallback will not trigger because JSON parsing still succeeds. Operators have no built-in way to compare snapshots, restore a point in time, or export a known-good backup with media references.
Fix: Add an admin recovery panel with snapshot list, diff, selective restore, and export/import. Write explicit recovery checkpoints before remote apply and before destructive operations. Add server-side scheduled export for Firestore and Storage metadata.

6. Severity MEDIUM - Offline shell and data-sync behavior are disconnected.
Reference: sw.js:47-66 provides offline HTML/static fallback, while sw.js:37-41 intentionally leaves Firebase network-only. index.html:3629-3632 only marks Firestore listener errors as offline, and index.html:3804-3815 does not register online or visibilitychange retries for failed pushes.
Impact: The app can open offline but existing-record changes are only local until a manual save path happens while connected. A reconnect can fetch remote state and merge over local edits instead of replaying an ordered pending queue.
Fix: Add explicit sync state: pending local writes, last server revision, retry backoff, online or visibilitychange flush, and user-visible conflict prompts. Consider enabling Firestore offline persistence only after rules and per-record conflict semantics are corrected.

7. Severity MEDIUM - Firebase deployment config does not cover Storage or hosting cache policy.
Reference: firebase.json:1-5 only deploys Firestore rules. index.html:18 loads Firebase Storage SDK and index.html:3683-3684 writes to Firebase Storage. No storage rules or hosting cache headers are configured in firebase.json.
Impact: Photo upload behavior depends on out-of-band Storage rules. If Storage is permissive to authenticated users, anonymous users may write/read media; if it is locked down, uploads fail and the app silently falls back to local-only photos. Hosting cache policy for index.html and sw.js is also not declared in firebase.json.
Fix: Add storage.rules and firebase.json storage configuration for studio/photos paths, authorized roles, size and content-type checks. Add hosting headers so index.html and sw.js revalidate predictably while hashed or versioned assets can be long cached.

## Recommendations
1. First fix access control and privacy: remove embedded real data, replace anonymous broad rules, add Storage rules, and validate Firestore writes.
2. Replace the single studio/data document with per-entity collections and per-record revision metadata.
3. Add a durable offline pending-write ledger with retry and conflict UX before relying on offline PWA behavior.
4. Make media persistence transactional: IndexedDB commit or Storage upload must complete before placeholders replace base64 data.
5. Build an operator recovery surface for local snapshots, Firestore exports, and media-reference validation.
6. Keep the service-worker shell strategy, but connect reconnect events to the data-sync queue and configure hosting headers.

## Architectural Status
BLOCK

## Code Review Recommendation
REQUEST CHANGES

## Trade-offs
- Incremental hardening: fastest path is rules plus embedded-data removal plus media error handling. It reduces immediate exposure but leaves single-document sync risk.
- Sync redesign: per-collection data with revisions takes longer but solves scale, conflict, and recovery at the source.
- Local-only media: simple and cheap, but not cross-device and fragile under browser quota. Storage-backed media costs more and needs rules, but is the right durability boundary for studio records.
- Firestore offline persistence: useful after authorization and conflict semantics are fixed. Enabling it before then can make stale or unauthorized states harder to reason about.
