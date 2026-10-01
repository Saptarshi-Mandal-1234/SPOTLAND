# Launch verification follow-up — 1 October 2026

Production: https://spotland.pages.dev. Frontend metadata fix deployed as `bdc07c51`.

## Desktop/browser evidence

- At 360 × 800, home, Explore, trip planner, SOS, community events, venues, safety directory, calendar, privacy and attributions had no horizontal overflow. Home dark mode toggled correctly and was restored to light.
- Skip-to-content moved focus to `app-content`. Enter activated navigation; trip entry focused its heading; SOS entry focused the main region. Escape closed the place sheet. Empty trip search focused the required input; blank itinerary and empty events supplied visible explanatory states.
- SOS showed Call 112, plain controls and separate consent. Visible SOS controls measured at least 44 px high. No GPS permission, notification, SMS, emergency call or broadcast was triggered.
- Production app update reloaded successfully and returned to the home screen with offline-shell readiness. This does not establish installed-device offline/reconnect behavior.
- An actual Overpass failure showed a retry control and dated saved-area fallback in Chrome. Saved places remained available. This is one observed provider failure, not exhaustive timeout/offline simulation.
- Privacy and attribution pages exposed a single primary heading, structured sections and working home navigation at 360 px. Added missing meta descriptions; their legal content is unchanged.

## Fresh Lighthouse results

Scores are performance / accessibility / best practices / SEO. These are laboratory checks, not screen-reader or physical-device certification.

| Target | Scores | Limits |
|---|---|---|
| Mobile home | 98 / 100 / 100 / 100 | Before the metadata-only release; app JS is unchanged |
| Desktop home | 100 / 100 / 100 / 100 | Before the metadata-only release; app JS is unchanged |
| Mobile SOS | 100 / 100 / 96 / 100 | Expected anonymous `nearby-alerts` status 401 was recorded as a console network error; no delivery test |
| Mobile privacy | 100 / 100 / 100 / 100 | After deployment; canonical `/privacy` URL |
| Mobile attributions | 100 / 100 / 100 / 100 | After deployment; canonical `/attributions` URL |

Raw JSON/HTML reports are adjacent. Initial privacy/credits scores were 91 SEO due to missing descriptions; fixed and redeployed. Use canonical Cloudflare extensionless paths when auditing to avoid `.html` redirect warnings.

## Source/configuration review

Application source has no payload logging: the scheduled cleanup emits only `Expiry cleanup completed.` This source review does not inspect Cloudflare's account-wide log sinks or platform retention; that operator gate stays open. Worker/API and cleanup use the same production D1/R2; the API has no public workers.dev route. SOS broadcasting remains false; private receiving remains configured.

Provider policies rechecked against official sources:

- [Nominatim](https://operations.osmfoundation.org/policies/nominatim/): explicit submitted search, shared 1.5-second miss reservation and daily cache; no autocomplete.
- [OSM tiles](https://operations.osmfoundation.org/policies/tiles/): visible attribution, configurable URL, normal browser caching, strict-origin-when-cross-origin referrer policy, no prefetch/offline tile downloads.
- [FOSSGIS routing](https://routing.openstreetmap.de/about.html): shared 1.5-second miss reservation, attribution, identified adapter and cached rounded coordinates. Provider logs route requests.
- [Open-Meteo](https://open-meteo.com/en/pricing): free API is non-commercial only; shared 18-second miss gate and 30-minute cache. Operator must confirm the project remains non-commercial before launch.
- [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access): optional official feed, operator identification and caching. Coverage is sparse and not organiser confirmation.

No new provider, dependency, paid service or permission was introduced. Account-wide quota/billing checks, production log-sink review, full screen-reader review, controlled safety delivery, Android/iPhone installation/offline tests, physical-device performance and legal/operator sign-off remain open. Android testing remains deferred at the owner's request.

Required checks: lint, typecheck, all 140 tests in 42 files, and build passed. Build retains existing non-fatal Vite config-loader/Motion directive warnings.

## Two real Google accounts — passed collection switching

The owner manually completed Google's chooser. Two distinct server user records existed despite identical display names. The second account saved Maa Durga Mandir (`node/8156880972`); its collection showed the favorite. Logout removed it from the browser UI. Switching to the original account showed an empty collection, including after full reload/reopen; a concurrent server read confirmed the original had zero matching favorites and the second still had one. This separates real-account/browser evidence from the earlier synthetic API ownership tests. It is not a complete two-account photo-reporting or multi-tab/offline test matrix.

With explicit owner approval, only that second-account test favorite was deleted, and a server count verified zero remaining. Both real account records were retained. The final original-account session was signed out. Evidence: `account-isolation-browser.png`. Neither credentials nor Google tokens are included in this report.
