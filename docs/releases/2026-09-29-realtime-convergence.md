# PC/mobile synchronization correction

Base: `668d98d8696d9be8e2bacec90548803be17902d4` in `aljjang95/vocal-studio`. This release addresses the reopened synchronization report; previous schedule/storage acceptance did not establish this journey.

## Resulting behavior

- Different properties of one existing record merge using the confirmed base, local intent and latest server value. Nested properties and independent property deletion are included. Different weekdays merge only when each weekly assignment list has unique day identities.
- Divergent values for the same property, deletion versus editing, duplicate identities and ambiguous arrays still preserve the unsent intent as a conflict.
- Empty unhydrated startup state is not mistaken for an edit. An unversioned shared cache cannot silently replace a confirmed journal: divergent cache contents are retained in recovery without inferred writes. A legacy resume hold clears only when its exact current local value is already confirmed by the server and no ACK is pending.
- The WebSocket `hello` revision closes initial and reconnect read/subscription gaps. Matching revisions do not add a request; the five-minute audit remains a fallback.

## Verification

- The previous deployed runtime failed six of thirteen independent controller scenarios. The final runtime passes all nineteen expanded scenarios, including true conflict preservation, canceled pending-save protection, own-property semantics and atomic ambiguous arrays.
- Independent transport reproduction changed from one stale observation at revision 1 to immediate observations at revisions 1 and 2 after a peer commit between GET and WebSocket registration.
- Full local suite: 175 tests; 92 invariant gates; build and Wrangler dry-run passed. The added transport regression also covers reconnect and matching-revision request suppression.
- Independent browser acceptance and exact merged release identifiers are recorded in the associated pull request after validation. Synthetic browser evidence is separate from physical-phone operation.

## Reviewed runtime identity

| Working artifact | SHA-256 |
| --- | --- |
| `vs-sync.js` | `c8ba60c1071cf71496539a9863ed8174448108f9b6fb0897c4ff033e1084da03` |
| `cf-transport.js` | `b6b440e23100de5a65e72b0543eb9cfb657e6b5c33f4813146e554c4ac970a52` |

Git may normalize line endings. Compare canonical LF bytes when verifying commit identity, and verify the actual served bytes after deploying the exact merged source.

## Scope and recovery

Production diagnostics are read-only. No customer records, backup-clearing operation or server-choice recovery is used to bypass the reported defect. Physical-phone operation and the original affected device remain unverified. Genuine different-value conflicts still need a deliberate resolution; the release never discards them automatically.

The immediate pre-release Worker is `9db1d4e5-4b55-44ab-af68-9c4f8f1b07bd`. Roll back by assigning traffic to that version with Wrangler, preserving all local journals and backups. Both versions retain the existing compressed-backup decoder. The public intake product, original portraits, Worker bindings and deployment lock remain unchanged. No GitHub Actions are enabled.
