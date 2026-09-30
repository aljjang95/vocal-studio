# Durable backup overflow under browser storage pressure

Base: `14f7548e6113de8beb7beacb9526a0147c454783` (`aljjang95/vocal-studio`, student schedule release).

An existing browser can fill localStorage with historical recovery backups. A new journal containing confirmed server data and an older recovery variant then cannot obtain a durable backup, so the application correctly stops synchronization. The intended repair retains every historical localStorage value and uses a dedicated IndexedDB database only for a new backup belonging to the current tab.

Archive initialization, transaction completion and exact committed readback must finish before readiness or server transmission. Pending saves retain newer intent; disconnected accounts and stale asynchronous completions cannot resume another owner. Storage denial, quota exhaustion, aborts and corrupt readbacks keep transmission blocked. The recovery export must include both historical and overflow backups for the current owner.

Acceptance uses isolated synthetic data: full localStorage, divergent recovery, normal calendar/student edits, peer synchronization, reload and recovery export. Production verification checks deployed assets, readiness and historical hashes without submitting customer test changes or selecting the server over local recovery.

Final candidate hashes, independent review, test results, deployment and rollback identifiers belong to the associated pull request and release receipt. This document does not itself prove acceptance. Student date entry, original assessment notices, 11pt printing, camera recovery, existing media storage and server transport remain preserved. Physical-camera and physical-phone verification are separate boundaries.
