# SPOTLAND development guide

Last updated: 2026-10-02
Release status: public production site at [spotland.pages.dev](https://spotland.pages.dev); launch gates remain in [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

This is the living record for each iteration. Update the relevant sections and add one row to the iteration log in the same change that affects user experience, UI, architecture, services, deployment or release operations. `npm run docs:check` validates its required structure; every managed frontend release runs that check.

## Product and architecture

SPOTLAND is an India-first travel PWA for discovering places, planning trips and using optional safety tools. People can browse without an account; Google sign-in enables account-scoped favorites, trips, reviews and moderated photos.

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Web app | React 19, TypeScript, Vite, Tailwind and MapLibre | Responsive UI, map, PWA shell and user interactions |
| Edge frontend | Cloudflare Pages | HTTPS site and same-origin Pages Functions |
| API | Cloudflare Worker (`travelapp-api`) | Validation, privacy boundaries, provider calls, accounts and moderation APIs |
| Data | Cloudflare D1 | Places cache, accounts, favorites, trips, reviews, events, safety and moderation records |
| Media | Private Cloudflare R2 | Pending/approved review photos through signed application routes |
| Offline | Workbox through `vite-plugin-pwa` | App shell and saved-place access after a successful online visit |

The browser calls `/api`; Pages forwards it to the private Worker through the `API` service binding. Browser code never receives Worker secrets, R2 credentials, D1 credentials or moderation tokens.

## UI and UX system

The interface uses warm postcard-style surfaces, original regional illustrations, sticker details, clear focus states and reduced-motion support. City searches select a state/UT color treatment intended to reflect local culture. Fraunces is the licensed self-hosted display face; system-readable sans-serif text is used for controls and body copy.

| Area | User experience |
| --- | --- |
| Explore | City/landmark search, map movement followed by explicit “search this area”, category filters, distance filters, list/marker selection and details |
| Place detail | Directions, weather context, crowds, save/favorite, reviews, moderated photos and nearby planning actions |
| Trips and collections | Signed-in favorites and trips are scoped to the selected Google account and recover after refresh |
| Events | Community event submissions with visibility and moderation state; external event data uses verified public sources only |
| Safety | Emergency numbers, facilities map, private emergency contacts, expiring live-share links and opt-in nearby safety features |
| Reliability | Loading, empty, offline, retry, error and update states are visible; app-update failures give a recovery action/message |

Accessibility baseline: semantic controls, visible keyboard focus, 44 px touch targets, contrast-aware color tokens, responsive layouts and reduced motion. Full screen-reader and physical iPhone verification remain launch checks, not completed claims.

## Services and integrations

| Service | Purpose | Data or operating constraint |
| --- | --- | --- |
| OpenStreetMap / Nominatim / Overpass | Geocoding, maps and nearby venues | Respect rate limits, caching and provider attribution/policy |
| OSRM (FOSSGIS) | Walking, driving and cycling routes | Public best-effort service; no live traffic or offline navigation |
| Open-Meteo | Weather and best-time guidance | Non-commercial use only; SPOTLAND is non-commercial |
| Wikidata | Public event discovery | Operator contact and source verification required for live use |
| Google Identity Services | Optional basic Google sign-in | Public OAuth client ID only; privacy/terms and approved HTTPS origin required |
| Cloudflare Pages / Workers / D1 / R2 | Hosting, API, persistence and photos | Free allowances apply; R2 overages require operator monitoring |
| Web Push | Optional safety alerts | Receiving is configured; production delivery and nearby SOS broadcast are still disabled/pending device verification |

## Iteration workflow

1. Review the last completed behavior and its open risks.
2. Make one focused change.
3. Update this guide’s architecture, UX or services sections when the change affects them; add an iteration-log row.
4. Run `npm run release:verify` before a frontend production release.
5. Run `npm run deploy:web`. It snapshots the current production Pages deployment in `.release/rollback.json`, deploys the candidate and checks both production and candidate URLs.
6. Commit the updated rollback record after the release. Keep Worker and D1 changes backward-compatible until the frontend has proved stable.

### Frontend rollback

Cloudflare Pages retains successful production deployments. The managed deploy command records the previous deployment UUID and immutable URL before it changes production. If a frontend release fails later, set a local `CLOUDFLARE_API_TOKEN` with only **Pages Write** permission and run `npm run rollback:web`. The token is not stored in Git. The command calls Cloudflare’s documented Pages rollback endpoint, verifies `https://spotland.pages.dev`, then records the restoration locally.

The Dashboard fallback is **Workers & Pages → spotland → Deployments → select the URL in `.release/rollback.json` → Rollback to this deployment**. Roll back the Worker separately only if its API changed incompatibly; do not assume a Pages rollback reverses D1 migrations or R2 objects.

## Iteration log

| Date | Iteration | UI/UX, architecture or service change | Verification |
| --- | --- | --- | --- |
| 2026-10-02 | Responsive layout pass | Grouped home actions into responsive navigation tiles, simplified phone spacing, and added safe viewport sizing for maps and bottom sheets from 380 px upward. | Lint, typecheck and production build passed. |
| 2026-10-01 | Release safeguards | Added this living development guide, required documentation check, managed Pages deployment snapshot and API-based rollback command. Initial protected rollback target is the verified `cd4c6456` production deployment. | Documentation check, lint, typecheck, 142 tests, production build and both production/rollback URLs passed. |
