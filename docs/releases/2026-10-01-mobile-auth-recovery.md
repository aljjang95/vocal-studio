# Mobile authentication and loading recovery

Expired Access authentication previously appeared as a generic disconnected status, without a relogin action. A failed read could also wait for the five-minute audit when the server revision had not changed. Foregrounding a mobile page with an apparently open silent socket did not immediately verify server state.

The app now distinguishes authentication, network, timeout, and malformed-response failures. Authentication failures expose an explicit same-domain relogin action; an open form requires confirmation before navigation. Requests and their bodies settle at a 20-second deadline even if abort is ignored, and the initial waiting view exposes recovery after 25 seconds. Storage waiting remains a separate fail-closed state. JavaScript deadlines execute when the browser resumes if the page itself was suspended.

Manual and subscription reads share failure tracking. Foreground restoration verifies state immediately, and obsolete reads or transaction outcomes cannot reverse a newer authentication result. Existing pending journals, recovery backups, principals, scheduling, camera recovery, unabridged print notices, and 11pt print styles are preserved. Server JWT validation is unchanged.

Validation: 273 full tests, 34 focused checks, 92 regression invariants, build and Worker dry-run. Independent review tests and real synthetic browser flows cover expired authentication, ignored-abort timeout, manual retry, same-revision hello, foreground restoration, pending journal byte preservation, acknowledged recovery, stale reads, and old commit outcomes. Responsive verification uses an actual 360px viewport. Customer production data is not used as a write fixture.

The owner's physical-phone loading cause remains unconfirmed; an Access page that stalls before app scripts execute is a separate boundary. Cloudflare Access supports at most one month, not unlimited login. This source release does not change Access duration, policy, cookies, permissions, or identity-provider settings.

Rollback: redeploy the preceding Worker version `1c5cef1d-95bd-49f6-9d97-787718433af3`. No database migration or backup deletion is part of this release.
