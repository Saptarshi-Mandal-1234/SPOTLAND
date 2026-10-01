# SPOTLAND — release and paused-feature report

Reviewed: **1 October 2026 (Asia/Calcutta)**.

Launch-verification follow-up: production 360 px/keyboard/dark-mode spot checks and app-update flow passed. Missing privacy/credits meta descriptions were added and deployed (`bdc07c51`). Fresh Lighthouse: mobile home 98/100/100/100, desktop home 100/100/100/100, SOS 100/100/96/100 (expected anonymous consent-status 401), privacy and credits 100/100/100/100. Application-source logging and provider configuration/policies were reviewed; platform log sinks, quota monitoring, full screen-reader and device/legal gates remain open. Two real Google accounts also passed collection switching/logout/reload isolation; the approved test favorite was removed and final session signed out. Detailed evidence: `reports/release-checks/launch-followup.md`.

Account-isolation follow-up: the production HTTP API passed checks with two disposable D1 session fixtures. Favorites stayed separate for the same place; another account could not read, remove or overwrite a trip; review `mine` and removal were owner-scoped. Wrong-origin and anonymous access were rejected, logout invalidated the existing token, and both fixture accounts and their saved content were removed. Evidence: `reports/release-checks/account-isolation.json`. Repeatable runner: `node scripts/verify-production-isolation.mjs --run-production`. This verifies the deployed API; it does not repeat Google account switching or browser-cache isolation with two real accounts. Short-lived hashed rate counters retain their normal expiry.

Latest follow-up: production photo upload → pending privacy → moderator preview/approval → public display → hide → owner deletion all passed. A Chrome canvas ICC-profile rejection was fixed by stripping metadata after encoding; strict server validation remains. Temporary review, photo, favorite and trip records were removed with operator approval; the R2 key no longer exists and D1 photo budget is zero. Production Google favorites, trip stop order and review persistence passed reload/reopen checks. Anonymous favorite/trip requests returned 401; two-account collection switching was subsequently verified (see the latest follow-up above).

VAPID contact was approved and keys deployed. Production now reports `receivingEnabled:true` and a push public key, while `enabled:false` keeps SOS broadcasts off. The owner explicitly deferred Android notification/device testing; real delivery is unverified, and no iPhone is available. Operator/legal approval remains open. Latest required commands passed with **140 tests / 42 files**. Live home Lighthouse results: mobile **96/100/100/100**, desktop **100/100/100/100**, without run warnings; reports and test details are in `reports/release-checks/`. These home audits preceded the subsequent isolated photo-encoding fix and do not certify every app screen.

Earlier review before the live-test follow-up: Pages listed production deployment `5f28f35c-1322-42a3-9fb4-35091bfe2b50` (decorative add-ons), replacing `fd593164-a79c-4288-a00e-718aaafd85fe`. Production `API` is bound to `travelapp-api`; the API and scheduled cleanup configurations use the same dedicated D1 and R2 bucket. Live homepage, privacy, attributions, PWA manifest/service worker, health, Google configuration, SOS configuration and external-events endpoints returned HTTP 200. Google has a configured client ID. SOS configuration explicitly returned `enabled:false` and `pushPublicKey:null`. Lint, typecheck, all **137 tests / 41 files**, and build passed in this review. Earlier cron and authenticated Google verification remain historical evidence, not newly repeated device tests.

## Comparison and next priorities

Since the original paused-feature report, R2 photo support, production deployment, moderator access, scheduled cleanup, production Google sign-in and decorative add-ons have progressed. Deployment, cron verification and Google login no longer require initial setup. R2 upload support now has a verified public upload/approval/removal flow. Web Push keys/contact are configured, but actual delivery remains deferred and production SOS broadcast remains explicitly disabled.

Controlled production favorite/trip/review persistence and photo upload/moderation/deletion checks passed. Two-account collection switching passed; private push delivery remains required before any safety pilot. Android/iPhone safety, install/offline/update checks, physical-device performance, human accessibility, quota/logging review and operator/legal approval remain open. Do not enable production broadcast simply to remove a checklist item. The latest decorative release has not had a fresh whole-app Lighthouse/accessibility audit; the results below describe the earlier M9 home build.

## Release status

M0 through M7 are implemented locally. M8 text reviews/ratings and R2 photo-review support are implemented locally. The public HTTPS frontend, private API, dedicated production D1 database, R2 binding and scheduled cleanup Worker are deployed. Production Google OAuth is published; live login, reload persistence and logout revocation are verified. M9 local polish, automated audits and release documentation are complete. Physical Android/iPhone safety checks and legal/operator approval remain separate open gates; this is not a verified general safety launch.

The app remains configured for Cloudflare's free architecture. R2 use was explicitly approved by the operator; their Cloudflare account has a card attached. R2 includes a free quota and billable overages, so the app imposes an 8 GiB stored-object cap and the operator must monitor current usage. The R2 bucket is bound to the deployed production API and cleanup Workers. Production sign-in and controlled public photo upload/moderation/deletion are verified. Running a build performs a Worker **dry run**, not a deployment.

## Deliberately disabled or paused

| Item | Current status | Reason / what would enable it |
|---|---|---|
| Photo uploads and photo reviews | Production upload, approval, hide and deletion verified | A generated test JPEG was uploaded through the signed-in UI. Pending access returned 404, moderator preview/public approval returned 200, hide returned public access to 404, and owner removal deleted the R2 key and D1 record/budget. Temporary content was removed. Chrome ICC metadata rejection was fixed and regression-tested. |
| Web Push SOS notifications | Contact/keys configured; private receiving/testing enabled; real delivery deferred | The owner approved the public VAPID email. Separate `PUSH_ENABLED=true` allows consent/subscription/private tests without enabling broadcasts. Android testing was explicitly deferred; no real push was sent. Production `SOS_ENABLED=false` remains until controlled safety and launch gates are resolved. |
|  |
| Event/venue/review operator moderation | Local operator access configured; event, venue, price-report, review and photo moderation endpoints verified. | A random private `ADMIN_TOKEN` is stored only in git-ignored Worker configuration. All five local queues accept the configured token and reject an invalid token. Paste it into the existing moderator panels; review/photo panels share the Events token. Production secrets are configured and all five production moderation queues were verified; an operator moderation process is still required. Hidden-review restore, account banning and multi-moderator audit history remain unavailable. |
| Public Cloudflare deployment | Frontend, private API and cleanup Worker deployed | https://spotland.pages.dev uses the Pages API service binding to travelapp-api, with the same remote D1 as cleanup and R2 configured. Production secrets and exact HTTPS Origin are set. Production SOS broadcast remains off pending launch checks; Web Push activation is still pending. |
| Automatic production expiry cleanup | Deployed and verified on 1 October 2026 | Scheduled-only `spotland-expiry-cleanup` runs every five minutes against the dedicated remote travelapp D1 and R2 bucket. A real automatic run succeeded; remote queries confirmed expired shares/devices/SOS and dependent records removed, receiver location/subscription cleared, stale upload reservation released, and an unexpired share retained. Synthetic fixtures were removed afterward. The public API configuration binds this same remote database; local development remains separate. |
| Public Google OAuth rollout | Published; sign-in and production saved-data persistence verified | Google shows In production. HTTPS origin, homepage and privacy URL are saved. Live token exchange, reload persistence and earlier logout revocation passed. Favorites, trips and reviews now passed production save/reload/reopen/removal checks. Two-account collection switching also passed. Custom branding and legal/privacy approval remain open. |
| Operator audience analytics | Not implemented; only device-local screen counters exist | Counters are optional, off by default, and never transmitted. No server-side audience dashboard, provider or user/session tracking is configured. This preserves the no-transmission choice; collecting operator-facing metrics would require a separate privacy decision. |
| Additional decorative interactions | Implemented | Explore has swipe cards with visible buttons, state postcard stamps, optional light haptics and animated marker-to-detail badges. Confirmed trip saves show confetti. Reduced motion disables decorative movement. Stamps describe the selected state for this visit, not verified travel history; physical-device haptics remain unverified. |

## Data-dependent or intentionally limited features

These are **not disabled switches**; they have honest availability limits.

| Feature | Current limitation |
|---|---|
| Crowd percentage | Community-history estimator is enabled. A percentage needs at least **15 matching reports across 3 dates** within the preceding 90 days, matching weekday/nearby IST hours. Below that, “Not enough data yet” is expected. No commercial footfall feed, live occupancy sensor or calibrated prediction model is connected. |
| Wikidata events | Enabled with the supplied public operator contact. Production `/api/external-events` returned HTTP 200 in this review. Responses can be cached; this is not evidence of complete event coverage. Coverage may be sparse, delayed or lack coordinates; listings are not an organizer-confirmed complete event feed. |
| OSM rating filter | Disabled when provider places have no ratings; no third-party ratings are invented. SPOTLAND's own review ratings display separately and do not feed the OSM filter. |
| Open-now filter | Only explicit verified `24/7` hours qualify. Complex/holiday opening schedules remain displayed without an open-now guarantee. Weather scoring supports simple schedules separately. |
| Offline street tiles | Not downloaded or service-worker-cached under the current OSM tile policy. Saved public places and last-area markers can appear over a plain geographic background. |
| Offline writes | Favorite edits, trip/review saves, routing, weather and online searches require a connection. They have no general offline write queue. SOS has its own bounded retry/status handling. |
| Trip weather/planning | Up to 8 stops within 100 km of the first; 50 saved trips/account. Forecast is at the start only, today plus two days; distant dates show unavailable. Travel times exclude traffic and time spent visiting. Unsaved drafts do not survive leaving/refreshing. |
| Background location/navigation | No reliable PWA background GPS or turn-by-turn navigation. Sharing updates require the sharing screen open/visible and consent. Wake Lock can fail or be released. |
| SMS and WhatsApp | Composer/share actions exist; sending is a user action, never silent. Carrier SMS charges can still apply independently of the free app architecture. |
| Weather warnings | In-app forecast cautions only, not official emergency warnings or background push alerts. |
| Venue booking and prices | Booking-site/venue links only. No bookings, payments, scraped listings, live ticket inventory or provider price/rating copying. Price notes require manual confirmation/correction. |
| Safety map | OSM coverage and phone fields vary; missing data is not proof that no facility exists. Telephone calls require working phone service. |
| Offline saved-place retention | Device snapshots are bounded and expire after seven days. Browser storage eviction can remove them. Cached account data is read-only and is not authentication. |
| Festival/holiday calendar | Curated 2026 dates only; future-year updates are manual, not an automatic holiday API. |
| Mood picker | Visual preview; mood selection does not change nearby search results. |

## Tests that still need real devices or operator action

- Android and iPhone: installation, real GPS grant/denial, Wake Lock/background/lock transitions, SOS cancel/retry/expiry/“I'm safe”, private recipient links, SMS/WhatsApp/share sheet with consenting test contacts. **Never make test emergency calls or broadcast test emergencies to uninvolved people.**
- Production Google-login-to-favorite/trip/review saving and removal passed. Actual two-account browser isolation remains open; synthetic fixture tests remain separate evidence.
- Public health, remote migrations, earlier Google cookie persistence and an automatic cleanup run have evidence. Cross-browser cookie behavior, free-plan capacity, provider quotas and ongoing operational monitoring remain open.
- Operator/legal approval of privacy, emergency disclaimers, content moderation, retention/deletion contact/process and Google branding/consent requirements. Current privacy text remains a development notice.
- Human screen-reader testing and performance on a physical mid-range Android. Automated desktop/mobile-emulated audits do not replace these checks.

## Final verification results

The M9 baseline passed all four required commands: npm run lint, npm run typecheck, npm run test (**117 tests / 35 files**), and npm run build (frontend PWA, Pages function and Worker dry run). After the review-moderation follow-up below, the same commands passed again with **118 tests / 35 files**.

| Lighthouse 13.5.0, final production home build | Performance | Accessibility | Best practices | SEO |
|---|---:|---:|---:|---:|
| Mobile simulation | 94 | 100 | 100 | 100 |
| Desktop | 100 | 100 | 100 | 100 |

Reports have no runtime errors or run warnings. Mobile LCP was 2.6 s and CLS 0.027; desktop LCP 0.6 s and CLS 0.001. These are local lab runs, not field Core Web Vitals or a whole-app/manual accessibility certification. The stamp contrast and robots.txt findings were fixed and re-audited, including an explicit dark-mode stamp color. Remaining React unused-JavaScript and render-blocking CSS recommendations are recorded in the reports; first-screen JS is about 238 KB raw / 75 KB gzip, above the approximate 200 KB raw target. No unrelated refactor was made merely to inflate scores.

HTML reports: [mobile](reports/m9/mobile.report.html), [desktop](reports/m9/desktop.report.html); machine-readable JSON sits beside each. Audit methodology follows [Google's official Lighthouse documentation](https://github.com/GoogleChrome/lighthouse/blob/main/readme.md). The temporary CLI initially hit a Windows temporary-profile cleanup error after writing its reports; the final runs used explicit isolated profiles via Lighthouse's Node API and exited successfully. The temporary tool was kept outside app dependencies.

Production browser checks verified the visible Update app reload from the previous cached release, the corrected dark stamp colors and idle SOS controls with Call 112, explicit consent, disabled sending and push-disconnected wording. No location, notification permission, emergency call, SOS broadcast or message was sent.

See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) for individual gates, [MILESTONES.md](MILESTONES.md) for development evidence and `reports/m9/` for local Lighthouse reports. The production build is audited at `http://127.0.0.1:4173/`, using an isolated anonymous browser profile; it is not a deployed HTTPS measurement.

The earlier stop was honored; the operator subsequently approved R2, deployed infrastructure and resumed feature work. Cloudflare authentication and initial deployment are complete. See LAUNCH_NEXT_STEP.md for current verification priorities. Historical follow-ups below record their status at the time and are superseded by the current tables above.

## Historical moderation-report follow-up (superseded)

The Events screen now includes a token-protected review-moderation panel, correcting an earlier statement that moderator dashboard support was absent. The panel lists at most 50 recent reviews without account IDs and supports hiding a review. Its adapter request shape is covered by tests, and the local UI was checked with no moderator token configured: protected actions remain unavailable until the operator supplies one. Since `ADMIN_TOKEN` is deliberately absent locally, listing and hiding were not exercised against a moderator-enabled Worker. Restore, account banning and multi-moderator audit history remain unavailable. The token is held in memory by the screen and is never stored in public frontend configuration.

This follow-up passed lint, typecheck, tests (**118 tests / 35 files**) and build/Worker dry run. No production deployment was performed. Photos and Web Push remain paused by the operator's earlier choices.

## Historical Web Push follow-up (superseded)

Web Push follow-up: subscription consent/opt-out, a private non-emergency test, provider receipt counts and bounded complete-pilot dispatch are now implemented. The operator's public VAPID contact approval remains pending; no live push was sent. The required lint/typecheck/test/build checks passed with 132 tests across 38 files. Local UI checks confirmed configuration/consent gates without requesting location or notifications. Production deployment, real notification display and Free CPU/quota verification remain launch gates.

## Temporary audit housekeeping

Automatic approval review rejected both the checked-path cleanup and explicit-path deletion commands, stating only “blocked by policy.” Audit-only browser profiles therefore remain in ignored `worker/.wrangler/lighthouse-mobile` and `worker/.wrangler/lighthouse-desktop`, with the temporary `m9-audit.mjs` runner. Earlier CLI temporary profiles may also remain under the Windows Temp directory. The reports are saved, audit processes exited, and no cleanup workaround was attempted after the explicit-path rejection. These are local audit artifacts, not enabled product features or a running public deployment.
