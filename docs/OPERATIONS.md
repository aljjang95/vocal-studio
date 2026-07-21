# Vocal Studio release operations

## Runtime source policy

- `index.html` is the authoritative runtime until modular JS is explicitly imported by it.
- `vocal-studio.html`, `vocal-studi.html`, and `gjc-session-*.html` are compatibility redirects only and must not contain app code or customer data.
- Firebase Hosting ignores `.gjc/`, `tmp/`, `scripts/`, `docs/`, `js/`, rules files, and legacy HTML wrappers. Deploy only the runtime shell and public PWA assets.

## Firebase auth and rules release gate

1. Authenticate the Firebase CLI with the studio admin account:
   ```bash
   npx firebase-tools login
   ```
2. Deploy rules before treating the safety release as live:
   ```bash
   npx firebase-tools deploy --only firestore:rules,storage --project hlbvocalstudio-72481
   ```
3. Verify unauthorized clients cannot read or write Firestore/Storage.
4. Verify an allowlisted admin UID or verified admin email can load and save through the app.

Until this gate passes, G002/G004/G005 live-release items remain blocked even when local checks pass.

## Split migration procedure

1. Run `window.vsSplitMigration.dryRun()` in an authenticated admin browser.
2. Review counts, deterministic ids, checksums, warnings, and media manifest quarantine entries.
3. Begin the freeze with the current legacy hash using `window.vsSplitMigration.beginFreeze(expectedLegacyHash)`.
4. Run `window.vsSplitMigration.write(plan)` only while frozen and authenticated as an allowlisted admin.
5. Verify dual-read counts/checksums before ending the freeze with `window.vsSplitMigration.endFreeze()`.

## Media recovery procedure

1. Run `window.vsMediaRecovery.scan()` and save a snapshot with `window.vsMediaRecovery.snapshot(label)`.
2. Process queued media with `window.vsMediaRecovery.processQueue()` while authenticated as an admin with Storage rules deployed.
3. Export a recovery snapshot before manual repair using `window.vsMediaRecovery.exportSnapshot()`.
4. Use `window.vsMediaRecovery.diff(before, after)` to prove restored, queued, and `recoveryRequired` counts changed as expected.

## Regression gates

Run before any release attempt:

```bash
node scripts/regression-gates.mjs
```

Required manual/live gates that cannot pass on an unauthenticated workstation:

- Firebase rules deploy succeeds.
- Unauthorized Firestore and Storage access is denied.
- Allowlisted admin load/save succeeds.
- Split migration dry-run and frozen write pass against live Firebase.
- Media queue upload and cross-device media load pass against Firebase Storage.
