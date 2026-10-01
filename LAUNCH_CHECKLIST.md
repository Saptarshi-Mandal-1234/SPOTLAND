# SPOTLAND launch gates

M9 local launch preparation and automated lab audits are complete. The public HTTPS app is deployed at https://spotland.pages.dev, with a private API, production D1/R2 bindings and verified scheduled cleanup. Production Google sign-in, reload persistence and logout revocation passed. A general safety launch remains unapproved: physical-device checks and legal review are open. VAPID contact/keys and private receiving are configured; real delivery verification remains deferred. R2 overages are billable.

## Build and release

- [x] Run `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` against the release source. A Worker dry run is not a deployment.
- [x] Run Lighthouse on the production build, mobile and desktop; retain dated reports for performance, accessibility, best practices and SEO. Fresh home-page reports are in `reports/release-checks/`: mobile 98/100/100/100, desktop 100/100/100/100. SOS is 100/100/96/100 (expected anonymous status 401); privacy passed 100/100/100/100 after its metadata fix.
- [ ] Check performance on a physical mid-range Android on a slow connection. Local Lighthouse simulation does not complete this gate.
- [x] Desktop spot checks: skip link, keyboard navigation, heading/main focus, sheet Escape, 360 px overflow, dark mode and public pages; evidence in `reports/release-checks/launch-followup.md`. Full screen-reader/reduced-motion review remains open below.
- [ ] Complete full keyboard-only navigation, visible focus, screen-reader headings/form labels/status messages, 360 px layout, dark mode and reduced motion. Check public privacy and attribution pages too.
- [ ] Verify loading, empty, permission-denied, provider timeout, offline, reconnect and failed-update states. Verify the reload fallback and Call 112 remain usable on a failed screen.
- [ ] Install the PWA, reopen offline saved places/last area, reconnect and update the app. Street tiles are online only; do not prefetch OSM tiles.

## Free infrastructure and configuration

- [ ] Confirm Workers, Pages, D1 and R2 quotas before provisioning. R2 use is approved, and a card is already attached to the operator's account; monitor usage to avoid billable overages.
- [x] Dedicated production D1 `travelapp` is configured in `worker/wrangler.production.jsonc`; all migrations through `0010_review_photos.sql` were applied. Local development intentionally retains its separate configuration. Back up production data before future schema changes.
- [x] Cloudflare CLI authenticated and `spotland-review-photos` R2 bucket created. Verify the `REVIEW_PHOTOS` binding and upload/approval/hide/delete paths on a private test deployment before public use. The Worker serves only approved photos on visible reviews.
- [x] Pages `API` is bound to `travelapp-api`, with same-origin `/api` and Worker `ALLOWED_ORIGIN=https://spotland.pages.dev`. Private secrets were confirmed absent from frontend artifacts.
- [x] Production Worker secrets include a separate random `DEVICE_SECRET`, Google public Web client ID, provider identification/contact and private moderation token.
- [x] Configure matching VAPID keys and the approved public subject; private key stays Worker-only. Receiving/private tests are enabled separately from SOS broadcasting.
- [ ] Verify real Web Push display/click/opt-out on devices. Android test was deferred by the owner; no iPhone is available.
- [ ] Production SOS broadcast is explicitly disabled (`SOS_ENABLED=false`). Enable it only after controlled safety/delivery checks and operator launch approval; a deployed SOS screen does not establish active broadcasts.
- [x] Exact HTTPS Google origin and public privacy/homepage links configured; audience In production. Real sign-in, reload persistence and sign-out revocation passed using Secure/HttpOnly cookies.
- [x] Verify production favorite/trip/review save, full reload/reopen and removal, plus anonymous access rejection. Temporary test data was removed.
- [x] Verify actual two-Google-account collection switching/logout/reload in production: the second account favorite did not appear in the original account. Approved test favorite removed. Evidence in `reports/release-checks/launch-followup.md`; multi-tab/offline and photo-reporting matrices remain separate.
- [x] Verify deployed HTTP API isolation with two disposable session fixtures: favorites, trip read/remove/overwrite, review ownership, authentication/origin rejection and logout revocation. Both accounts/content removed; evidence in `reports/release-checks/account-isolation.json`. Real Google/browser switching remains a separate check.
- [x] Five-minute production cron ran automatically; expired safety records and stale upload reservations were removed while an unexpired share remained. Synthetic fixtures were removed afterward.
- [x] Review application source for payload logging: only the static cleanup-completion message is logged. This does not inspect platform log sinks.
- [x] Deployed API and cleanup Worker settings report Logpush=false; application payload logging remains absent.
- [ ] Review account-wide log sinks and retention: existing CLI credentials return 403 for account Logpush jobs.
- [x] Recheck official provider usage policies, adapter cache/rate configuration and attribution; findings in `reports/release-checks/launch-followup.md`.
- [x] Owner confirmed non-commercial Open-Meteo use on 1 October 2026.
- [ ] Operator monitors account-wide provider/infrastructure quotas; procedures are in OPERATOR_RUNBOOK.md. Respect existing cache/rate gates; public demos are not guaranteed-capacity services. Monitor free quotas and provider errors; pause the pilot before paid infrastructure becomes necessary.

## Real-device safety: Android and iPhone

Use the deployed HTTPS app and a controlled test with consenting participants and test contacts. **Never place a test call to emergency services.** Do not broadcast test emergencies to uninvolved users. Record browser/OS/date, observed result and any failure.

- [ ] Verify prominent Call 112 links without completing calls; confirm the disclaimer and large plain safety controls.
- [ ] Reject location permission: show an actionable error and no false sent state. Grant permission only on the tester's device with consent; confirm foreground updates, stale recipient warnings, expiry and Stop revocation.
- [ ] Check the five-second SOS cancellation; it must send nothing after cancellation. Test queued/not-sent/retry and “I'm safe” using an isolated test deployment or an agreed private pilot with no uninvolved recipients.
- [ ] Check SMS composer contents and selected test recipients before manually sending; SMS is never silent. Test WhatsApp/share sheet with consenting recipients only.
- [ ] Test Home/lock/background transitions, Wake Lock loss, network interruption and reopening. Do not promise background tracking or delivery. Precise location must remain confined to private share links; nearby alerts use coarse data and server-fixed 2 km.
- [ ] Verify contact persistence/removal is device-only; no contact payload goes to the Worker. Confirm iPhone Home Screen limitations are visible. Verify separate push consent, subscribe, actual private test notification display, notification click, opt-out and expiry on Android/iPhone. Check the 36-recipient pilot against actual Free CPU/query/network limits before launch; configured code is not proof of real delivery.

## Privacy, content and operations

- [ ] Have the operator/legal reviewer approve the privacy notice, emergency disclaimers, public-content moderation, retention, account/deletion process and applicable Google branding/consent requirements. The current privacy page is a development notice, not a claim of legal approval.
- [ ] The public privacy page now names the operator and support/deletion email, and Google homepage/privacy links are configured. Confirm operator approval of the published procedure and any applicable terms/branding requirements; a published email does not complete legal review.
- [ ] Confirm moderators can review reports/hide abusive content. Three-account auto-hide does not establish truth or human identity. Visits and crowd estimates are not verified attendance guarantees.
- [x] Verify controlled production photo upload, pending privacy, moderator preview/approval, public display, hiding and owner deletion. Generated test image and temporary content removed; R2 object absent and D1 budget returned to zero. Chrome ICC encoding bug fixed.
- [ ] Complete multi-account photo-reporting/device checks and ongoing R2 quota monitoring. App storage cap is 8 GiB; account overages are billable.
- [x] Optional analytics are local counters only: default off, bounded screen totals, no account/safety/location/history data, no network transmission. Verify enable, reload, counting and opt-out deletion; no external analytics provider is configured.
- [ ] Record remaining failures here, agree a limited pilot size, and obtain operator launch approval only after the concrete release and test evidence are reviewable.

## Evidence in this workspace

Automated regression and build results are recorded in `MILESTONES.md`. Final local Lighthouse reports are in reports/m9 (mobile 94/100/100/100; desktop 100/100/100/100). Public deployment, cron and Google sign-in evidence are recorded in README.md and STATUS_REPORT.md. Android/iPhone SOS delivery, physical-device performance and legal review remain unverified. Do not mark these gates complete without evidence.
