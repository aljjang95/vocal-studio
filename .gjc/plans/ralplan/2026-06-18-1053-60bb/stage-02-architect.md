## Summary
Read-only assessment of `index.html` plus related modular files shows a working but high-risk single-file operations system. The highest-value upgrades are to secure the shared data store, stop automatic mutations that affect billing, and unify consultation, schedule, log, and payment models around one canonical workflow.

## Analysis
Evidence inspected: `index.html` is the runtime source with all product logic in one inline script; `js/app.js` states the modular files are unused. The modular files under `js/ui` and `js/core` are useful for intent, but they lag the runtime in important places: the modular `js/core/cycle.js` only supports 4/8 lesson cycles, while `index.html` now uses `freqNum`, `cycleSizeOf`, and `freqLabel` for N x 4 cycles. The modular `js/ui/schedule.js` lacks the runtime consult schedule menu handling present in `index.html` around `openConsultSlotMenu`.

Consultation creation: `showConsultForm` creates a consultation form with inquiry prefill, solo/group selection, fixed/flex preference, confirmed date rows, health fields, and fee calculator. `saveConsult` stores `_inquiryId`, `lessonType`, `groupMembers`, `firstDate`, `confirmedDates`, `schedPref`, `freq`, and media references. Inquiry conversion to a consultation marks the inquiry as `상담작성` and stores `consultId`, but the user still has separate lists and no funnel-state dashboard.

Student conversion: `convertFromProfile` copies basic fields into the student modal and then `saveStudent` marks the consultation `converted=true`, deep-copies it into `student.consultData`, and transfers media. The recurring lesson schedule is built from `c.days` and `c.time`, not from the authoritative `confirmedDates` used to place consultation appointments on the weekly schedule. This makes conversion the main workflow bottleneck.

Schedules: `getWeekSched` merges active students, week overrides, and unconverted consultation appointments. Fixed students default to `days/times` unless a week override key exists; flex students appear only when `weekOvr[wk][sid]` exists. `openFlexWeek`, `saveFlexWeek`, `openWE`, `saveWE`, quick slot editing, and temporary rescheduling all mutate `weekOvr`. Conflict detection is mostly display-only, and `resetWeekOvr` deletes the entire week override object.

Logs and payments: `buildTodaySchedule` calls `autoFillPastAttendance`, which writes missing past slots as automatic `출석` logs. `getCycleInfo` excludes `결석` and `연기`, but log `wn` and payment modal `wn` calculations count all logs. Payments store a saved `cycleNum` at payment time and are filtered by the current cycle, but later log edits/deletes do not recalculate payment cycles.

Operation/security risk: `initFirebase` signs in anonymously and `firestore.rules` allow all authenticated users to read and write `/studio/{docId}`. Because the web config is public and anonymous auth is enough, any anonymous user who can load the app can read/write the shared studio document unless Firebase project settings or hosting access add protections outside this repo.

## Root Cause
The system grew from a local monolith into a synced operations app without a canonical domain model or authorization boundary. Consultation appointments, recurring lesson schedules, attendance logs, and payment cycles are coupled through ad hoc fields (`confirmedDates`, `days/times`, `weekOvr`, `wn`, `cycleNum`) rather than explicit workflow state and invariants.

## Findings
1. HIGH — Security boundary — `firestore.rules` allows `request.auth != null`, and `index.html:initFirebase` signs in anonymously. Impact: shared student, phone, schedule, payment, and consultation data is readable/writable by any anonymous authenticated client. Fix: require allow-listed UIDs/custom claims, separate read/write roles, and deny client writes to whole-studio documents.

2. HIGH — Attendance and billing correctness — `buildTodaySchedule` invokes `autoFillPastAttendance`, which creates `출석` logs for missed past slots and calls `saveAll`. Impact: simply opening Today can advance lesson counts and payment due status without user review. Fix: replace automatic writes with a `미기록 검토` queue and explicit bulk confirm.

3. HIGH — Payment cycle model — `getCycleInfo` excludes `결석` and `연기`, but `openLessonRecord`, `saveLR`, `showPayModal`, and several status paths compute `wn` from all logs. Payments store `cycleNum` once and are not updated after log edits/deletes. Impact: payment cards can show wrong due cycle or hide valid payments. Fix: centralize effective lesson counting and store payments against immutable cycle ranges such as `cycleStart/cycleEnd` or derive cycle membership at render time.

4. MEDIUM — Consultation to student conversion — `getWeekSched` displays consultation `confirmedDates`, but `convertFromProfile` converts into `days/time` prefill and ignores `confirmedDates` as a lesson schedule source. Impact: a confirmed appointment can disappear from the schedule after conversion or create an unscheduled student. Fix: conversion wizard should choose whether confirmed appointments become first lesson, recurring fixed schedule, or one-week override.

5. MEDIUM — Weekly schedule editing — Flex and fixed week editors warn on slot conflicts but `saveFlexWeek` and `saveWE` still save duplicates without a conflict gate. `resetWeekOvr` deletes the whole week override, which also wipes all flex assignments because flex students only exist in `weekOvr`. Impact: overbooking and accidental loss of flex schedules. Fix: add pre-save validation with explicit overbook confirmation and split reset into fixed exceptions versus flex assignments.

6. MEDIUM — Group lesson model — Consultation form stores `lessonType=group` and `groupMembers`, but conversion creates one student record with one main phone, while schedules/logs/payments operate per student record. Impact: second member contact, attendance, makeups, and payment responsibility are unclear. Fix: create a first-class group enrollment with members, primary payer, shared schedule slot, and per-member attendance metadata.

7. LOW — Source of truth drift — `js/app.js` says the modular files are unused, while `index.html` has newer group, N-times/week, sync, and consult-slot logic. Impact: maintainers can patch modular files without changing runtime behavior, or future modularization can regress current workflows. Fix: either delete/stub the unused modules with explicit docs or move runtime to modules and load them from `index.html`.

## Recommendations
1. Lock down Firestore access before expanding use: authenticated owner allow-list, scoped roles, and write validation.
2. Make attendance finalization explicit and remove automatic log creation from page render.
3. Build a canonical lesson-cycle service used by logs, payments, dashboard, profile, today, and timeline.
4. Turn conversion into a guided handoff: consultation appointment, enrollment schedule, fee, group/member data, first payment, and inquiry closure in one checklist.
5. Add a conflict-aware weekly schedule transaction: validate duplicates, holiday/off-day placement, flex unassigned state, and reset scope.
6. Decide source of truth for modules versus monolith before implementation.

## Architectural Status
BLOCK

## Code Review Recommendation
REQUEST CHANGES

## Trade-offs
- Fast patch: add validation and guardrails inside `index.html`. Benefit: quickest risk reduction. Cost: increases monolith size.
- Proper domain refactor: extract consultation, schedule, attendance, and payment services from `index.html`. Benefit: long-term maintainability and testability. Cost: larger migration and regression risk.
- Workflow-first redesign: implement funnel and conversion checklist before internal refactor. Benefit: visible user value. Cost: may leave monolith debt temporarily.
