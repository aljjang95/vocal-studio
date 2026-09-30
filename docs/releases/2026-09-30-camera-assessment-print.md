# Consultation camera and assessment print correction

Base: `53b2fee0647674719d46613c293a6f95a2ad40aa` in `aljjang95/vocal-studio`.

The consultation camera previously labelled every device-start error as permission denial. The camera panel now distinguishes device-start failures, missing devices, denied permissions, unsupported browsers and document-policy restrictions. Users can explicitly select another camera, retry or choose a photo file. Video-only streams are released when closing, changing requests or receiving a late grant. This change does not change browser/OS permissions or stop another application's work.

Assessment print output previously included essential text at approximately 6.4pt. Completed assessments, lesson sheets and blank evaluation forms now use 11pt text and A4 pagination. Long feedback is preserved and can continue over pages; it is not reduced to fit a single sheet. Printed feedback is escaped, and the evaluated song is included. Installed Korean fonts are used without external print-font requests.

## Candidate validation

- 186 automated tests, including 11 focused camera/print controls; 92 invariant gates; build and Wrangler dry-run passed.
- Actual Chromium A4 output: normal completed/lesson/blank sheets use two pages with minimum text size 10.99pt (PDF rounding of 11pt), compared with 6.37pt in the previous completed sheet. Long synthetic feedback uses eight or nine pages with all 80 problem labels, 60 plan labels, a 500-character unbroken token and the final feedback marker preserved. No text extends outside the page. Final headings remain with following content and signature words are preserved.
- Local actual-button camera QA uses explicitly synthetic video: device-start error, retry, explicit device choice, photo capture/application, photo-file fallback and stopped tracks passed. These controls do not prove successful physical-webcam capture.
- Independent exact-candidate review and final release identifiers are recorded in the associated pull request before release acceptance.

## Physical-device gate and scope

The observed production browser already permits camera access and its document policy allows it. All enumerated cameras returned `NotReadableError`. The physical webcam is present and OS privacy settings permit access. An active camera-usage marker from another application may be related, but causation has not been established. Physical camera availability must be rechecked before claiming the webcam problem fully resolved.

No customer records or historical recovery copies are modified during diagnostics. Worker camera policy, synchronization protocol and original image assets are unchanged. The immediate pre-release rollback Worker is `80cee61b-64b9-4cd9-acb6-0f2e3a821510`; reassign traffic to it with Wrangler if needed, keeping device journals and backups.
