# Student schedule registration and mobile day entry

Base: `63c69006bccd7c74207e243f74e833b85768b570` in `aljjang95/vocal-studio`.

Student editing now provides an `일정 확정 등록` entry into the existing date manager while retaining unsaved student fields. Saved dates move the view to their week and weekday. Weekly calendar date headings and empty areas open the existing assignment dialog with that exact date; its time selector supports half-hour slots. Existing lesson cards keep their detail/edit actions.

The existing registration-to-shared-weekly-state path was verified before this change. Repairs address cases where quick assignment unnecessarily froze unrelated students' recurring schedules, where removal of the last confirmation could expose an unchecked recurring conflict, and where proposed flexible-week rows were validated too late. Manual empty weeks, cancellations, makeup and linked consultation dates remain explicit exceptions.

## Acceptance boundaries

- Student editing and date registration must preserve unsaved fields and all previously registered dates, including dates in other weeks.
- New conflicts must reject the complete proposed mutation, including the original flexible editor week after navigating to a different week.
- Navigation indicators must agree with the displayed weekly page and its selected date.
- Date taps, keyboard activation and empty-area entry must use the viewed week. Lesson actions must not propagate into a new assignment.
- Customer records and historical recovery data are not changed by release diagnostics. Actual UI testing uses isolated synthetic state.

Final exact-candidate review, test counts, browser acceptance and release identifiers are recorded in the associated pull request. An earlier UI candidate was held after independent review identified a cross-week validation omission and stale navigation state; only a corrected and rechecked candidate can be released.

Physical-phone operation is separate from responsive Chromium browser evidence. Earlier camera hardware and transient-offline investigations remain separate from this schedule release. Print text, original notices, media assets and synchronization transport remain outside this patch.

Immediate pre-release rollback Worker: `a38121cb-37fc-4502-b6ba-64c74c1ca3f2`. Assign traffic back to that version with Wrangler if necessary, preserving device journals and backups. No GitHub Actions are enabled.
