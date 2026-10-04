# HLB Android Studio bridge contract

This extends the existing private SMS bridge. It uses Android permissions and
the user-selected call-screening role; packaging or internal testing is not a
security bypass. Existing SMS scheduling and settings remain compatible.

## Acceptance

- A1: official API evidence separates OTP-only WebOTP, browser-rendered PWA/TWA,
  native Android functions and Play permission review.
- A2: preserve existing SMS allowlists, generation protection, send provenance,
  owner-bound UI drafts and durable schedule readback.
- A3: optional incoming caller identification uses ROLE_CALL_SCREENING on API29+.
  Immediately allow incoming calls before local persistence/network activity;
  never reject, silence, skip notifications or skip phone call history. No call
  audio or historical call-log access. Outgoing/hidden/invalid numbers ignored.
- A4: owner-only recent call inbox; known student/consult/inquiry identity uses
  current canonical phone matching. Multiple possible people stay ambiguous.
- A5: signed version-code2+ APK/AAB with unchanged package/signing identity,
  source/artifact receipts and bundle validation.
- A6: fresh independent review of integrated candidate and targeted regressions.
- A7: distinguish Play acceptance and real phone SMS/call/background evidence
  from builds, mocks and local package validation.

## Owner call settings and inbox

GET /sms/overview gains `callSettings:{enabled,includeUnknown}` and `calls`.
Settings are stored separately as `sms.callSettings`, default both false;
strict booleans only, invalid persisted settings fail closed for calls. Existing
`sms.settings` shape and reminder eligibility do not change.

POST /sms/call-settings `{enabled:boolean,includeUnknown:boolean}`.
POST /sms/call-dismiss `{callId}` acknowledges a call without touching reminders
or scheduling. Calls have `{id,phone,receivedAt,name,studentId,matchStatus,status}`;
matchStatus is matched, known-contact, ambiguous or unknown. Names derive only
from current canonical records, never invented from a caller number. Limit the
owner overview to the latest200 calls. Escape all text in the owner interface.

If an owner chooses to register a call as an inquiry, reuse the canonical
inquiry schema through an explicit owner action, CAS and durable readback; do
not mutate customer/schedule data from the call event itself.

The implemented action is POST /sms/call-inquiry
`{callId,baseRevision,name,memo}`. The owner supplies a real name explicitly;
registered contacts are not duplicated as new inquiries. A durable per-call
receipt makes an identical retry idempotent. Canonical inquiry commit, receipt
and call acknowledgment occur in one transaction; success waits for the actual
host display, including an edit that starts during asynchronous journal storage.

POST /sms/options
`{baseRevision,messageId,studentId,date,startTime,endTime,preferredTime?}` returns
`{ok,revision,messageId,options:[{date,time,reason}],warnings}` without booking.
The owner enters the student's available window; every recommended 60-minute
lesson must fit entirely inside it. An exact requested time is preserved, even
at a non-grid minute such as 15:15. Other suggestions use a 30-minute grid and
rank adjacent lessons before idle gaps. Choosing a suggestion only fills the
draft; the original SMS proposal remains intact and final confirmation rechecks
the current state and duration overlaps. Unknown active legacy times hold the
operation without changing historical data.

## Device API

GET /device/pull gains `callIntake:{enabled:boolean,includeUnknown:boolean}`;
it returns no names/calendar and continues returning allowedPhoneHashes.

POST /device/call `{id:string,phone:string,receivedAt:integer,direction:'incoming'}`.
Use the existing token authentication, route/body limits and clock window.
Validate exact fields/types, normalized Korean phone, plausible future/current
timestamp and idempotency. Same device/id with different payload conflicts.
Store only when call settings enabled and phone currently allowed, or enabled
includeUnknown explicitly permits an unknown number. Recheck authentication and
settings before transactional persistence. Revoke/rotation must reject old tokens.
Call receipt never counts as an SMS reply, suppresses a reminder or books a slot.

## Native app

Keep package com.tllhouse.hlbreplay and private credential protections. Name the
app HLB 스튜디오 and provide `스튜디오 관리 열기` to the fixed HTTPS
https://hlb.tllhouse.com/ surface through a browser Custom Tab when available,
with a normal browser fallback. No WebView JavaScript bridge, cookie extraction,
secret query strings, exported credential intents or arbitrary host navigation.

The same fixed browser-launch mechanism opens the public disclosure at
https://vocal-studio-sms-relay.affinity-agent-studio.workers.dev/privacy.
Only GET/HEAD at that exact path are public; it contains no customer/calendar
data. Device and owner routes retain their authentication boundaries.

Call role selection is optional and on-device. Explain that selecting this app
changes the phone's caller-identification provider. Optional READ_CONTACTS is
only to let Android deliver calls from saved contacts; the app never queries or
uploads contacts. Without it, Android may omit calls from saved contacts. Denial
must leave SMS and web management usable.

Forward only calls observed after current connection boundary, with server call
settings plus local role consent. Private durable queue retains generation,
stable event IDs/payload across network retries. Recheck current generation,
opt-in settings and latest phone allowlist before upload. Disabled/revoked/old
events cannot flow into a new connection. The public companion/owner API uses
the existing device authentication without exposing keys in logs or URLs.

## Scheduling and release

Existing automatic SMS proposals, Monday request/Tuesday followup and manual
owner confirmation remain in force while the owner-confirmation preference is
pending. Never infer a time from alternatives, negations or unclear messages.
No actual counterpart SMS or calendar booking is used for build acceptance.

Use Play internal testing when existing account/package access and the SMS
permissions declaration allow it. Cross-device synchronization is an available
review category, not an accepted decision. Firebase/App Distribution or TWA
packaging cannot be described as bypassing Play Protect. Preserve the frozen
phone-input helper and the existing tool-policy gate.
