# Milestone review

## M0 — local implementation reviewed; deployment pending

- React/Vite/TypeScript/Tailwind PWA, Worker health endpoint, reusable sticker component, design tokens and motion preset.
- Self-hosted licensed fonts, original landscape, light/dark mode and responsive mood demo.
- Latest lint, typecheck, five API/adapter tests, and frontend + Worker dry-run build pass.
- Browser review: 360 px layout, light/dark toggle, mood selection, and connected local API verified.
- Production manifest, icons and service worker generated; physical-device installation and offline behavior not yet verified.
- Cloudflare `wrangler whoami` reports unauthenticated. No public deployment or paid resources created.
- Before M1: finish/review free deployment and PWA install; rerun the M0 checks after changes.

## M1 — local map and nearby places reviewed

- Added lazy-loaded MapLibre raster map, configurable tiles, category markers, submitted search, location consent control, 1/2/5 km distance filters, conservative open-now filter, honest unavailable ratings, and place detail sheets.
- D1-backed provider cache and shared global cooldown; migration runs automatically in local dev. No remote database or paid services created.
- Original CC0 landmark illustrations and attribution metadata for all 36 states/UTs. Manual backdrop selection plus state detection from location-search responses.
- Final lint, typecheck, 15 tests, frontend build, and Worker dry-run pass. Build emits third-party Motion directive and lazy MapLibre chunk-size warnings.
- Live integration: Delhi geocoding works; Overpass returned 47 named places inside the selected 2 km radius.
- Browser review at 360 px: no horizontal overflow; map tiles/markers render; cafe filter shows 4 places; marker detail opens and closes; search returns Delhi; Kerala backdrop renders; open-now empty state is clear.
- M0 recheck: home demo preserved and API shows Connected after returning from Explore. Cloudflare login, public deployment, phone installation, offline verification, and real geolocation permission remain pending.
- Known M1 limits: complex opening hours are displayed without calculating open-now; ratings unavailable; public providers may be slow or unavailable; no offline tile downloads; map library loads after entering Explore.
- Next milestone is M2 only after user review and go. Recheck M0/M1 behavior and all root checks before moving on.

## M2 — routes reviewed locally

- Rechecked M1 lint, typecheck, 15 tests, production build/Worker dry-run, cafe filtering and marker details before implementation.
- Added configured FOSSGIS OSRM adapters for walk/drive/cycle, validated responses, shared D1 cooldown, 10-minute cache, route geometry, distance/duration, readable steps, and Google Maps outbound links.
- Directions starts from the selected exploration area, a submitted location search, or explicit current-location request. Coordinates rounded before routing/cache storage. Changing start/mode clears the old route; closing cancels pending requests and removes the line.
- Latest root lint/typecheck, all 21 tests, production build and Worker dry-run pass. Existing Motion directive and lazy MapLibre chunk-size build warnings remain.
- Live integration verified for all three modes. Browser verified walking and driving summaries/steps, route line, destination-prefilled Google Maps link, chosen-start search, stale-route clearing, and 360 px layout with no horizontal overflow.
- Known limits: public routing availability; no live traffic or background navigation; approximately 100 m coordinate rounding; two-point routes within India bounds and 100 km straight-line separation. Current-location permission on a real device, deployment and PWA installation remain pending.
- Next: S1 Safety map + numbers, after user review/go. Recheck M1/M2 and all root checks before moving on.

## S1 — reviewed locally

- Rechecked M2 with root checks and a browser walking route to Cafe Museo: 1.5 km, 20 minutes, steps and outbound directions link.
- Added plain safety screen, six emergency numbers with official sources and coverage notes, location consent control, submitted area search, six OSM facility categories, phone links, outbound directions and missing-place reports.
- Shared Overpass cache/cooldown; last rounded facility area saved locally with timestamp, validation and visible failure messages. No new dependencies or paid services.
- Latest lint, typecheck, all 26 tests, production frontend build and Worker dry-run pass. Existing third-party Motion and lazy-map chunk warnings remain.
- Live Delhi integration and browser review: 170 facilities within 5 km, 48 police after filtering, phone/directions links, saved-list restoration and 360 px layout without horizontal overflow.
- Physical-device calls, geolocation consent, production PWA offline behavior and public deployment remain pending. OSM coverage varies; queries cap at 300. No offline tile downloads.
- Quinlliyk free download is personal-use only; unverified web permission means Fraunces stays.
- Next: M3 Weather + best time, after user review/go.

## M3 — complete locally; M0–S1 rechecked

- Rechecked home API connection, theme and mood controls; Explore cafe filtering/map/details; M2 walking route (1.5 km, 20 min) and stale-route clearing; S1 restored facility cache, category filters, telephone links and 360 px layout.
- Fixed non-string phone handling, corrupt cache recovery, cancelled-mount provider requests, delayed-map center initialization, and saved/offline safety messaging.
- Added lazy per-place hourly weather, day/night conditions, rain/temp/wind, indoor/outdoor preference, three two-hour visit windows and forecast cautions. IST throughout; unknown/complex hours explicitly unverified.
- Open-Meteo adapter configured through Worker vars, two-decimal coordinates, 30-minute D1 cache and shared 18-second upstream gate. No new dependencies or paid resources. Free API non-commercial restriction documented.
- Final lint, typecheck, all 41 tests, production build and Worker dry-run pass. Existing Motion directives and large lazy MapLibre chunk warnings remain.
- Live API returned 72 readings; browser showed upcoming 48 hours, changing indoor/outdoor rankings, unverified-hours notes and contained table scrolling without page overflow at 360 px.
- Cloudflare whoami remains unauthenticated. Public deployment, installed PWA/offline verification, real-device location/calls, Android performance, and launch/legal review are still pending. Forecast cautions are not official warnings or background push alerts.
- Next: M4 part 1, festivals/public holidays only, after user review/go; pause after each M4 part.

## M4 part 1 — special days reviewed locally

- Added a lazy calendar screen with 14 selected factual 2026 dates, original CC0 compilation, government source links and checked date. IST Today/This weekend/Upcoming filters with year-expiry and regional limitations.
- Browser review: five upcoming dates, empty today/weekend states, official-source links, map navigation and no horizontal overflow at 360 px. Calendar dates have no venue coordinates; no event pins are invented.
- Renamed the app SPOTLAND through one shared constant used by runtime and build. Updated metadata, manifest, branding and artwork credits; original quirky pin-character SVG and PNG install icons included.
- Final lint, typecheck, 47 tests, production build and Worker dry-run pass. Existing third-party Motion and MapLibre-size warnings remain. Manifest/title/icon paths verified in built output.
- No new dependency, external calendar runtime provider, paid service or cloud resource. Existing storage keys/deploy project names preserved. Dataset is selected 2026 dates only, not all state/UT holidays; installed PWAs may need update/reinstall for branding.
- Stop here for review. Next: M4 part 2 user-submitted events and moderation, only after go.

## M4 part 2 and requested crowd feature — local review

- Added D1 event submissions, pending/approved moderation, date-filtered list/map, validation, rate limits and a memory-only admin token UI. Moderator configuration remains operator-managed; no public deployment performed.
- Fixed JSON cross-origin preflight for configured-origin event and crowd requests.
- Added voluntary crowd reports in each nearby spot detail, historical busy percentages with minimum-history thresholds, visible insufficient-data/error states, deduplication, expiry and tests for the scoring and real SQLite access.
- Browser verified a selected National Museum detail with honest zero-history output. Lint, typecheck, 53 tests, production build and Worker dry-run passed; local crowd migration applied.
- Crowd history starts empty. No paid provider or new dependencies. Estimate is an uncalibrated community busy rate, not live occupancy. Privacy/legal review and public deployment remain pending.
- Remaining sequence starts with M4 part 3 external events, then V1 and M5; S2/S3 require the agreed plan and user approval before coding. M6/M7 are not complete.

## M4 part 3 — implementation prepared; live verification pending

- Rechecked previous version: lint, typecheck, 53 tests, production build and Worker dry-run passed before development.
- Added optional official Wikidata CC0 adapter and external-event source cards under Community events, with date filters and map integration only for explicit event coordinates. No booking-site scraping or paid service.
- Manual loading, D1 six-hour cache including empty results, global minute gate, timeouts and shared provider Retry-After backoff. Missing operator contact produces a clear disabled state without sending an upstream request.
- Fixed malformed null event submissions returning a generic error instead of a validation error; regression checked.
- Lint, typecheck, 58 tests, production build and Worker dry-run pass locally. Live Wikidata query and actual provider coverage remain unverified until a public operator contact is configured. Public deployment remains pending.
- Browser verified manual loading, missing-contact message, Today/Map controls, 52-pixel load button and no horizontal overflow at 360 px. Development servers restarted after finding the local preview stopped.
- Review this step before V1 entertainment venues. This is not an organiser-confirmed feed; sparse coverage, start-date-only display and explicit-country-only coverage are documented.

## M4 part 3 — live configuration reviewed

- Operator contact configured only in git-ignored worker/.dev.vars; no email in public source or frontend configuration. Deployment requires setting this Worker variable separately.
- Live query timed out initially. Bounded date/country candidate search (200 maximum), disabled query reordering and forward type traversal resolved it. Two upcoming Wikidata sports events returned; no event coordinates, no invented pins.
- Lint, typecheck, 58 tests, production build and Worker dry-run pass. M4 external feed enabled locally; public deployment and organiser verification remain pending.
- Next: V1 entertainment venues, after review/go.


## V1 — entertainment venues reviewed locally

- Rechecked M4/crowd with all four required commands; 58 tests passed. Fixed home startup/theme persistence when browser storage is blocked and aborted pending crowd-report requests on sheet unmount.
- Added OSM entertainment adapter with shared provider gate/cache, directory map/list/type filters/city search, two original factual pilot entries, call/site/directions details and labeled booking browse links in one provider config.
- Added D1 pending venue submissions and private-token moderation, price note dates/disclaimers and moderated price reports. What's on reuses M4 community/Wikidata events with visible sources. No scraped booking listings, images, prices or ratings.
- Fixed duplicate OSM/pilot entries, preserved both source links, and expanded crowd checks to seed/community venue identifiers. HTTPS link validation, origin checks, rate limits, cache/fallback, moderation and real SQLite access tested.
- Local venue migration applied. Lint, typecheck, 64 tests, production build and Worker dry-run pass. Live Delhi loaded 48 OSM venues; a transient Overpass busy response showed the working pilot fallback.
- Operator ADMIN_TOKEN configuration and public deployment remain pending. Source prices need manual correction; resolving a report does not silently change published prices. Seed entries without verified coordinates stay list-only.
- Next milestone: M5 Google accounts and per-user favorites, after user review/go.

- Final browser check at 360 px: cinema filtering, detail focus/scroll, labeled booking links, missing-price/date states, crowd check, map/cinema marker, and M4 What's on navigation with two live Wikidata cards passed; no horizontal overflow. Both views retain source labels.


## M5 — optional accounts and favorites implemented locally

- Rechecked V1: lint, typecheck, all 64 existing tests and production build/Worker dry-run passed before coding.
- Added optional Google Identity Services login, explicit SDK loading, native RS256 signature/claim verification, official-key caching/gate, single-use nonce, network sign-in limits and Secure/HttpOnly/SameSite=Strict hashed sessions with logout revocation. No Google token/email/photo persists in D1 or frontend storage.
- Added users/favorites/session/challenge D1 migration, server-scoped validated favorites, atomic 200-item cap, detail Save/Remove buttons and a collection view with saved source/directions links. Account navigation preserves the active spot/filter and restores focus. Guests still browse all existing features.
- Added same-origin Pages API service-binding proxy, API-only Pages function routes, sign-in-compatible response headers, and README Google OAuth/free hosting setup. Root build compiles both API and Pages function. No dependencies, cloud accounts, paid resources or card-based service added.
- Applied local migration. Final lint, typecheck, 71 tests (real RSA signing/verification, tampering, issuer/audience/expiry/nonce, replay, key cache/refresh failures, D1 isolation/cap, expiry/logout and Pages proxy) and production frontend/Pages function/Worker dry-run build passed.
- Browser verified missing-config honesty, no pre-consent Google script, refresh/back navigation, 52 px account buttons and no overflow at 360 px. Existing Delhi entertainment returned 48 OSM venues, cinema details/booking links/crowd data remained visible, and returning from account retained PVR Plaza and cinema filtering. Account screenshot saved outside source.
- Google client ID not supplied: user requested integration plus setup instructions. Real Google-user sign-in, authenticated browser favorites across reload/devices and secure cookie persistence on each target device are unverified. Cloudflare deployment also remains pending. Favorites are snapshots; offline collection/sync is for M7. Public consent/privacy/contact/deletion process and launch/legal review remain pending.
- Stop for user review/go. Next in the agreed order is S2 live share, which requires the short plan and user OK before coding; M6/M7 remain later.

## M5 — Google provider configuration follow-up

- Google Cloud access restored after the operator handled two-step verification. Created a dedicated SPOTLAND project (`decent-habitat-510218-n1`), accepted the explicitly approved Google User Data Policy and created SPOTLAND local web OAuth client.
- External/Testing only, operator account added as the single test user; four localhost/127.0.0.1 development origins, no redirect receiver or extra API scopes. No billing/trial/paid API activated; generated client secret was not downloaded or used.
- Public client ID stored in git-ignored worker/.dev.vars; restarted local dev. Config endpoint and live GIS button/popup work; official Google certificate endpoint returned 200 with two keys. Lint, typecheck, 71 tests and production/Pages function/Worker dry-run build pass.
- Browser automation cannot operate the Google account chooser (CDP input/screenshot timeouts); asked the operator to complete sign-in while preserving the popup. The operator completed the retry: real sign-in, secure session persistence and a saved India Habitat Centre favorite across full reload were verified on 1 October 2026. Production host/origin, remote deployment and launch privacy/branding requirements remain pending.

- Live sign-in exposed Workers rejecting fetch redirect='error'. Fixed the Google adapter to use redirect='manual' and reject redirects through the existing success-status check. Added regression assertions for the Workers-compatible request and redirected key responses. An isolated actual Workers probe returned 200/two official keys; lint, typecheck, all 71 tests and build passed again. Reopened Google sign-in for the operator to retry.

- Logout completed successfully; a full reload returned to guest state with no collection exposed. The test favorite remains saved to the operator account for next sign-in. Screenshots saved outside source. Public deployment and cross-device checks remain pending.

## Pre-S2 regression review — 1 October 2026

- Lint, typecheck, all 71 tests and production/Pages-function/Worker dry-run build passed before and after the fix. Existing automated coverage includes places/search, routing, safety, weather scoring, calendar/events, venues, crowds, database access and accounts.
- Fixed Account configuration failure recovery: a failed config fetch now exposes Retry sign-in configuration, with an in-flight guard and abort cleanup. Browser reproduced the failure with the local server stopped and confirmed the retry control appeared; restarted development and checked normal configuration.
- No new dependencies or paid resources. S2 implementation is awaiting explicit approval of its location-sharing plan under AGENTS.md section 2.

## S2 — live sharing implemented locally, 1 October 2026

- Built the explicitly approved S2 plan. Anonymous signed device cookies and device/network limits protect create/update/stop; no Google login, new dependency or paid service is needed.
- Added a consent-first plain/high-contrast sharing screen, 1/4/8 h expiry, cancellable start/resume, Stop with explicit uncertain-failure/retry feedback, copy/share-sheet/WhatsApp/SMS actions, recipient map, accuracy/time and 90-second stale warning. No contacts/SOS broadcast was added.
- Only latest precise position is stored. Updates run every 30 seconds while the sharing screen is visible with optional Wake Lock. Home/hidden tab/unmount pauses GPS; reload restores only metadata and requires explicit resume/consent. No stored travel history or offline precise-position cache.
- 256-bit random recipient tokens stay in URL fragments and authorization headers, with hashes in D1. Sender management is separate; readers cannot modify shares. Idempotent create and location-free retired identifiers prevent delayed create requests reviving stopped links. Expiry rejects reads immediately; scheduled five-minute/request cleanup deletes position rows. Local secret is git-ignored, remote setup documented.
- Applied migration 0006 locally. All lint/typecheck checks, 81 tests across 23 files, frontend build, Pages function compilation and Worker dry-run pass. Tests cover signed-cookie tampering/consent/origin, durations, hash-only tokens, owner isolation, latest-only updates, quotas, Stop/replay, exact expiry and scheduled cleanup, stale boundaries, API errors/abort and header-only reader secrets.
- Actual local Workers runtime created/read a synthetic Delhi fixture without Google login, confirmed Stop (200) and denied subsequent view (404). Browser verified consent gate, no overflow at 360 px, map/marker, stale warning, and stopped link showing no location. Screenshots saved outside source. The synthetic share was stopped and temporary fixtures removed.
- Known limits: real-device GPS, Wake Lock/screen locking and message/share-sheet flows remain unverified on Android/iPhone; public Cloudflare deployment and cron activation remain pending. Free quotas apply; production privacy/deletion-contact/legal review is required. Development privacy notice added. No real operator GPS was accessed.
- Await review/go. Next is S3, requiring its own short plan and explicit approval before coding.

## Pre-S3 regression review — 1 October 2026

- Rechecked S2 and existing automated coverage. Fixed a recipient-secret reuse issue after the 30-day retired-key cleanup: the server now issues an HMAC-derived recipient token bound to sender device, share ID, server expiry and a random request nonce. Choosing an old viewer secret as a new nonce cannot recreate that old viewer URL.
- Preserved idempotent create and added owner-only token recovery after an uncertain create, including recovery with the original nonce or confirmed issued token. A recipient token still cannot authorize sender writes. Stop authenticates the signed sender device; pending creates remain retired by ID.
- Added a regression that advances 31 days, removes retirement data, and attempts to reissue the old secret from another device: old link stays inaccessible. Real local Workers runtime verified issued-token reads, raw-nonce rejection, owner recovery and Stop/404 using only synthetic Delhi positions. Test fixture stopped and temporary script removed.
- Final lint, typecheck, all 82 tests and full frontend/Pages-function/Worker dry-run build passed. No dependency or paid resource was added during this review.
- Presented S3's eight-line plan and named the proposed @block65/webcrypto-web-push dependency. Operator asked whether S3 is free; explained free architecture and quotas plus possible carrier SMS charges. S3 approval remains pending; no S3 code/dependency has been added.


## S3 — local SOS pilot, 1 October 2026

- Operator explicitly approved S3 and the named MIT `@block65/webcrypto-web-push` dependency. Operator then requested leaving Web Push disconnected: no VAPID contact/keys configured, no notification permission requested, no live browser-service calls. Encrypted adapter tests use generated keys and mocked endpoints. Production notification/subscription UI and delivery remain deferred with push connection.
- Added a plain high-contrast SOS screen with immediate Call 112, five-second cancel, separate precise-sharing/nearby consent, up to five IndexedDB-only contacts, private link, attempted SMS composer with visible fallback, WhatsApp/share sheet, and foreground GPS updates. Contacts are never sent to the server. Sender metadata/coarse-only pending SOS supports uncertain submission retry; location resumes only after consent. “I’m safe” independently attempts alert closure and private-share deletion, preserving closing state until both confirm.
- Added anonymous signed-device SOS/nearby API and migration 0007: fixed 2 km coarse-cell radius, one-hour receiver/alert expiry, five-minute cooldown, device/network daily limits, idempotent creation, cancelled-ID retirement, help responses, unique device reports and auto-hide after three. Foreground polling is 30 seconds; pending SOS creation retries only within 15 minutes. Cleanup removes expired positions, subscriptions, reports/help and delivery jobs. Free-pilot capacity failures are visible rather than truncated silently.
- Encrypted push adapter supports approved browser-service hosts, short TTL, generic privacy-preserving content, bounded parallel dispatch, three attempts, active/expiry/opt-in rechecks and expired-subscription clearing. It remains disconnected and unverified live. No paid infrastructure was provisioned.
- Fixed creation recovery/error wording and immediate update rate-limit collision; cancelled/hidden preparation does not begin a new GPS request; device contacts remain available if server configuration fetch fails. Moved the large SOS button into the first mobile screen after consent, and fixed switching between recipient and SOS hashes.
- Final `npm run lint`, `npm run typecheck`, `npm run test` (91 tests / 27 files), and `npm run build` passed. Build includes frontend PWA/service worker, Pages function compilation and Worker dry run; existing Motion/map bundle warnings remain. Typecheck caught a Node Buffer reference in a new TypeScript test; replaced it with browser-compatible base64 encoding and reran all checks.
- Real local Worker verified synthetic Delhi SOS create/list/close, no-login receiver coarse data, cleared list after safe closure and disconnected push. Fixture private share stopped and receiver opted out. Browser verified 360 px/no horizontal overflow, cancel before GPS, consent removal, device-only fictional contact persistence across reload, then removed that contact. Mobile screenshot saved outside source. No real GPS, SMS, WhatsApp or push was sent.
- Limits: public deployment/cron pending; real Android/iPhone GPS/composer/share-sheet/background behavior unverified; legal/privacy/deletion-contact and capacity review required before launch. Web Push intentionally disconnected. Await review/go; next milestone is M6.

## S3 regression check and M6 — 1 October 2026

- Re-ran the 91-test S3 baseline before M6. Fixed a reload gap: reopening SOS now reads the signed device's still-valid nearby opt-in from the server and resumes foreground polling without requesting GPS or extending consent. Added a server status/list consistency assertion. Web Push remains disconnected by the operator request; no VAPID contact or notification permission was configured.
- Built M6: named/date/mode itinerary; first stop is the start, up to eight stops within 100 km; explicit cached search, coordinate fallback and existing coordinate favorites; visible Up/Down/Remove buttons; complete ordered route, distance/time and steps; selected-day hourly weather at the start. Out-of-range dates show unavailable and skip the forecast request. Trip edits clear stale previews. Unsaved drafts are memory-only and this is stated in the UI.
- Added migration 0008 for account-scoped trips and ordered trip_stops. Google sessions protect save/list/reopen/remove; POST origin checks, no-store responses, validation, 50-trip cap and write limits apply. D1 transactional batch prevents partial saves. Retrying the same draft reuses its save ID; originals remain unchanged and edited/reopened plans save as new trips. No new dependencies, keys, providers or paid resources were added.
- Checked current primary OSRM/provider policy and Cloudflare D1 batch documentation. Routing uses one ordered multi-stop request, existing ten-minute cache and global 1.5-second gate. Missing provider legs are rejected. Added tests for ordering/validation/IST weather dates, adapter errors/aborts, multi-stop caching/omitted legs, session/origin enforcement, cross-user isolation, retry idempotency, rollback, cap and cascade removal.
- Browser found and fixed a native date-input event issue that left the old date in state. Input and change now update the plan; verified a future date has no weather rows and returning to today clears the old route before recalculation. Also removed obsolete S2-only wording from the development privacy page and added trip retention/provider disclosures.
- Real local D1/Worker verified a synthetic three-stop save, repeated save ID, ordered reopen, other-user read denial/empty collection, no-store and deletion. Temporary test users/sessions/trips and fixture files were removed. Actual browser geocoding, three-stop walking line and hourly weather worked for public Delhi spots. Tested reorder, 360 px with no page overflow, forecast unavailable for 15 October, anonymous save gate and preserved draft on returning from Account. No real GPS, emergency message or fresh Google login was used.
- Final npm run lint, npm run typecheck, npm run test (101 tests / 30 files) and npm run build all passed. Build compiled frontend PWA, Pages function and Worker dry run; existing Motion/map/Vite warnings remain. Local dev is running with migration 0008 applied. Mobile screenshot saved outside source as m6-trip-mobile.jpg.
- Limits: weather at the starting point only, today plus two days; travel estimates omit visits/traffic; pilot max eight stops/100 km/50 saved trips. Fresh Google-sign-in-to-trip-save UI was not retested; session storage was tested through native synthetic fixtures, while M5 OAuth was verified previously. Production deployment/cron and real-device emergency delivery are still pending. Await review/go; next is M7.

## M7 — Offline saved-place pilot, 1 October 2026

- Checked the M6 baseline (101 tests) before implementation. Retained the production static app-shell precache and added an explicit waiting-update button and offline-ready/connection status. API navigations are excluded from app-shell fallback; no private API runtime caching was added.
- Added bounded, validated device snapshots: 200 favorites scoped to the last account identifier and one public browsing area with up to 500 places, coarse 0.01-degree center, radius, region and timestamp. Seven-day expiry removes snapshots when read. Unknown fields are stripped; unsafe links, corrupted/oversized data and blocked storage fail safely. No Google credentials, live-share coordinates or SOS responses enter this store.
- Cached favorite collections are read-only, never authentication. A different verified account, signed-out session or confirmed logout clears the old collection. Reconnect verifies the current session before refreshing favorites and reloads the browsing area. Provider-only outages offer explicit refresh; cached details are labelled stale. Clearing copies invalidates pending loads so late responses cannot immediately recreate cleared snapshots. Existing contacts and SOS retry storage remain separate.
- Offline maps display public place markers on a plain geographic background. Current OSM tile policy was verified: offline downloads/prefetch are prohibited, so no street tiles are downloaded or service-worker-cached. Browser HTTP caching is left intact. Added a visible street-map retry for recovery when the server failed without a browser offline/online transition.
- Browser verified the production service worker by stopping an isolated read-only fixture server and reloading: shell, lazy screens, fictional cached favorites and last-area markers reopened. Cached editing was disabled; a restored server with another fictional account did not inherit the collection. Verified copy-clear confirmation and the service-worker Update app reload. The final build also recovered street tiles and fresh places through the visible retry buttons after restoring the isolated server. New controls fit at 360 px with no horizontal overflow; dark-mode colors were checked. No real account, GPS, emergency message or notification was used. Fixture copies were cleared, and screenshot proof is saved outside source.
- Final npm run lint, npm run typecheck, npm run test (107 tests / 31 files), and npm run build passed, including Pages function compilation and Worker dry run. Six storage/connection regression tests cover bounds, sanitization, expiry, corruption, owner metadata, clearing, blocked storage and reconnect listeners. Existing Motion/map/Vite build warnings remain. No new dependency, provider, secret or paid resource was added.
- Limits: street tiles require a connection; favorite/trip writes, routing, weather and online search are not queued for offline use. Browser eviction can remove snapshots. Native airplane-mode/real-phone tests, production deployment and legal review remain pending; Web Push stays disconnected by request. Await review/go; next milestone is M8 text reviews, with photo storage requiring a separate choice.


## M7 regression check and M8 part 1 — 1 October 2026

- Re-ran the M7 baseline: 107 tests passed. Fixed a silent offline-copy deletion failure on sign-out: local storage clearing returns success/failure, and sign-out explicitly warns when revocation succeeds but browser storage prevents removing cached copies. Added a blocked-storage assertion.
- Built text reviews and ratings in Explore spot sheets and Entertainment venue details, lazy-loaded. Anyone can read the latest 20 visible reviews and the aggregate over all visible SPOTLAND ratings. Google sign-in is required to post/edit/remove/report. One review per account/place, rating 1–5, bounded Unicode plain text, safe retry, visible errors, explicit refresh and no offline write queue. Public author labels are generic Traveller; visits are not verified and no third-party ratings are copied.
- Added migration 0009 for reviews and unique account reports; applied locally. Session and origin checks protect writes; validation, per-account/network daily limits and publish cooldown apply. Owner-scoped removal cascades reports. Three distinct account reports atomically hide a review and remove its rating from the aggregate. Hidden reviews cannot be edited. Existing Worker-only ADMIN_TOKEN protects moderator listing and hiding; no admin token is shipped to the public UI. No new dependency, provider or paid service was introduced.
- New validation, adapter and real SQLite/D1-compatible DB tests cover Unicode length, bad ratings/IDs, safe retries, cooldown/daily limits, account isolation, no public identifiers/names, distinct reports, transactional rollback, auto-hide, protected moderation, deletion and no-store responses. Final npm run lint, npm run typecheck, npm run test (114 tests / 34 files), and npm run build passed, including Pages function compilation and Worker dry run. Existing Motion/map/Vite warnings remain.
- Browser checked real local Worker/venue reading and the anonymous sign-in gate. An isolated fictional account/venue server verified production UI saving, changing rating/text without duplicating the aggregate, and removal back to no ratings. The review editor was checked at 360 px with no horizontal overflow. Browser locator timing/label failures were resolved using fresh accessibility state and role-based controls; no application change was needed. Fictional data/copies and temporary server script were cleared; proof screenshot is outside source. No real Google login, public review, GPS or message was sent.
- Privacy/README now explain public text, generic labels, account-linked reports, hiding, removal, limits, memory-only drafts, no-store and moderation requirements. Limits: fresh real Google-login-to-review posting, production deployment and legal/public-content review remain pending. At this M8 checkpoint, the review-moderation dashboard had not yet been added; the Post-M9 follow-up below adds a token-protected panel. Restore, banning and audit history remain unavailable; hidden authors can remove and resubmit subject to limits.
- M8 photos are NOT built and M8 is not marked wholly complete. Asked the operator whether photos should remain disabled or which approved free/no-card storage to use, as AGENTS.md section 8 explicitly requires. No bucket, photo dependency or upload endpoint was provisioned. Await that choice/go before photo work or M9.

## M9 — Launch preparation, 1 October 2026 (launch gates open)

- Operator explicitly chose to leave photos disabled and proceed to M9; M8 is accepted as text reviews only for this release. No bucket/upload service was added. Web Push remains disconnected.
- Rechecked the 114-test baseline. Fixed review draft loss on offline/reconnect, client/server Unicode length mismatch and quota consumption on already-reported or already-removed retries. Unique reports still hide at three; existing transaction/auth/origin tests continue passing.
- Added an app error boundary with reload/home and Call 112, bounded/no-store connection checks that refresh on reconnect, one main landmark across screens, a global skip link, navigation focus management and explicit form focus styles. Removed the obsolete M0 setup label from the home screen.
- Added optional bounded device-only browsing-screen counters, default off with explicit opt-in/deletion and storage-failure messages. They contain no identities, timestamps, URLs, locations or safety/account actions and have no network transport. Three tests cover privacy field stripping, bounds/corruption and blocked storage. Updated the privacy title/disclosures; existing attributions remain available.
- Added LAUNCH_CHECKLIST.md with free-plan/no-card configuration, all nine migrations, HTTPS/Google/session/provider checks, moderation/deletion/legal review, real-device safety tests and deployment cleanup evidence. No dependency or paid resource was added and no production deployment was performed.
- Lighthouse/Chrome DevTools audit is unavailable until an approved audit tool is supplied. Current production entry is about 238 KB raw / 75 KB gzip; this is build evidence, not a performance score. The map remains lazy-loaded. Physical Android/iPhone safety delivery and public HTTPS/cron/legal review remain unverified; M9 is not fully complete while these gates remain open.
- Final lint/typecheck/test (117 tests / 35 files) and build all passed, including Pages function compilation and Worker dry run. Browser verified a 360 px viewport with no page overflow on home/trip/privacy, one app main landmark, navigation focus, local-counter opt-in and screen totals, and confirmed opt-out deletion. Test counters were removed and the viewport reset; no GPS, messages, public review or emergency call was used. Mobile proof is saved outside source. Chrome DevTools MCP was unavailable; requested approval for the official Lighthouse audit tool instead of installing a new dependency without permission.

## M9 final local review and stop — 1 October 2026

- User requested completion, a disabled/paused-feature report and stopping. Completed all feasible local M9 work; physical-device safety tests, public deployment/cron and legal/operator review remain open launch gates rather than fabricated passes.
- Used the previously proposed temporary official Lighthouse tool, without modifying app dependencies. Initial CLI reports exposed postcard-stamp contrast and missing robots.txt, plus a Windows temporary-profile cleanup failure after successful audit generation. Fixed the app findings, fixed the stamp foreground for dark mode, and reran through the official Lighthouse Node API with isolated explicitly managed profiles; final audit processes exited 0 with no runtime errors or run warnings.
- Final Lighthouse 13.5.0 production home-page scores: mobile performance 94, accessibility 100, best practices 100, SEO 100; desktop all four 100. Mobile LCP 2.6 s / CLS 0.027; desktop LCP 0.6 s / CLS 0.001. Stored HTML/JSON reports in reports/m9. These are local lab results, not real-device, field or whole-app accessibility guarantees; about 238 KB raw entry JS exceeds the approximate 200 KB target and React/critical CSS diagnostics remain noted.
- Required lint, typecheck, test (117 tests / 35 files) and build passed. Browser verified the production waiting-update button reloaded the previous cached release to M9, dark stamp uses fixed high-contrast colors and SOS remained unsent with explicit consent, Call 112 and push-disconnected messaging. No actual permissions/location/call/message/broadcast used.
- STATUS_REPORT.md lists deliberate pauses, unconfigured moderation/public rollout, data thresholds, platform/provider restrictions, deferred decorative interactions and human/operator launch checks. Google OAuth/Wikidata are correctly identified as enabled locally; crowd estimates need sufficient history. README/checklist were updated to current evidence. Photos and Web Push remain disabled. Stop after final report; no further milestone or deployment automatically.
- Final housekeeping: automatic approval review blocked temporary Lighthouse-profile deletion, including a safer explicit-path attempt (reason: blocked by policy). Left the profiles/runner in ignored local storage and recorded the limitation in STATUS_REPORT.md; no bypass was attempted. Audit processes completed and the saved reports are unaffected.

## Post-M9 recheck and launch preflight — 1 October 2026

- User resumed development and requested checking the previous work before the next step. Re-ran lint, typecheck, tests (117 / 35 files) and production build/Worker dry run; all passed. No source-code regression was identified by these checks.
- Corrected the launch checklist to mark completed local Lighthouse audits separately from the still-pending physical Android performance check. Prior audit reports remain valid because application code was unchanged.
- Confirmed installed Wrangler 4.144.0 and checked authentication: not signed in. Deployment configuration still has the local placeholder D1 ID and local-only origin. No resources, secrets or paid services were provisioned; photos and push remain disabled.
- Added LAUNCH_NEXT_STEP.md with the concrete Free HTTPS test-deployment sequence and owner sign-in/authorization step. Await Cloudflare authentication before dependent account/resource setup. Physical-device SOS and operator/legal review remain open launch gates.

## Post-M9 report correction and review moderation — 1 October 2026

- Rechecked the paused-feature report after the user asked to fix it. The README already documented the Worker moderation API, but `STATUS_REPORT.md` and an older milestone note incorrectly described the review moderation screen as absent; clarified the current status and retained the still-missing restore, account-ban and audit-history limits.
- Added a token-protected review moderation panel to the existing Events screen, reusing the private `ADMIN_TOKEN` contract. It lists up to 50 recent reviews without account IDs and supports hiding. The token stays in component memory. Added adapter tests for authenticated listing and hide requests; the existing Worker handlers remain the authority for authorization and mutation.
- Local browser smoke check confirmed both moderation disclosures render and the review action is unavailable with no local `ADMIN_TOKEN`. No fabricated token, review, or moderation action was used. Since no valid operator token is configured, authenticated list/hide flows still need verification against a moderator-enabled Worker.
- Lint and typecheck passed, 118 tests across 35 files passed, and build plus Pages/Worker dry run passed. No production deployment was performed. Photos and Web Push remain disabled as previously requested.

## M8 part 2 — R2 review photos — 1 October 2026

- User selected Cloudflare R2 and confirmed their Cloudflare account has a card attached. Implemented photo upload, private moderation, reports/auto-hide, owner removal and permanent moderator deletion. R2 binding is `REVIEW_PHOTOS`; configured bucket name is `spotland-review-photos`.
- Added migration 0010, JPEG normalization/metadata stripping in browser, Worker content validation, request and per-account/IP limits, a hard 8 GiB object-storage ceiling, and cleanup for abandoned reservations. Pending/hidden photos are served only to their owner or an authorized moderator; public reads require both photo approval and a visible parent review.
- Added Worker and browser adapter tests for upload validation, ownership, moderation visibility, reports, deletion, budget limits and migration-backed review cleanup. Targeted suite passed 12 tests across 3 files; lint and typecheck passed during implementation.
- Authenticated Wrangler to the operator's Cloudflare account and created the `spotland-review-photos` bucket. No production D1 database is configured and no deployment was performed, so live uploads are not enabled on the public app. Apply migration 0010 to a dedicated production D1 database and deploy/test privately before launch. Cloudflare's current R2 free tier includes 10 GB-month storage and monthly request quotas; overages are billable and other account usage reduces headroom. Web Push remains disconnected.

## S3 Web Push connection follow-up — 1 October 2026

- Operator requested connecting previously paused Web Push. Existing S3 approval covers this implementation; asked for the public VAPID contact because the operator previously declined disclosing their email to push services. Contact choice remains pending, so no VAPID subject was configured or transmitted and no real notification was sent.
- Added separate notification consent, gesture-triggered permission/subscription registration, notification-only opt-out, nearby-off browser cleanup, one-device non-emergency test and visible provider acceptance/queued/failure counts. No login required. One-hour nearby consent, fixed coarse 2 km area and no background location updates remain. Production service worker is required; development mode explains this restriction without prompting permissions.
- Fixed six-of-36 initial dispatch: all bounded pilot recipients are attempted in six-request waves with three-second network deadlines, bulk claiming/completion and fresh consent/active checks. Notification expiry is bounded by receiver consent as well as alert expiry. Response bodies are cancelled to release network connection slots. Alert and queue insertion is transactional; failed storage leaves no partial alert and releases the cooldown for retry. Test messages create no SOS/broadcast. Expired incoming notifications show neutral expiry text rather than a current emergency claim.
- Added key-generation setup script using native Node crypto, preserving existing matching VAPID keys and writing only to git-ignored Worker environment configuration. No new dependency, paid service, public deployment, GPS permission, emergency call or actual SOS broadcast was introduced.
- Lint, typecheck, 132 tests across 38 files and production build/Pages compilation/Worker dry run passed. Tests cover consent/denial/rollback, subscription-only opt-out, private test authorization, 36 recipients with maximum six simultaneous sends and fewer than 50 DB preparations, capacity rejection, transaction retry, generic content, notification clicks and expiry. Local browser confirms consent gates and missing configuration/production-worker messages; no permission was requested. Actual Google/Apple/Mozilla delivery, Android/iPhone and production CPU/free-quota checks remain unverified.
