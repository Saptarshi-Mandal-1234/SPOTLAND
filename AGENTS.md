# MASTER PROMPT: Travel PWA (for Codex)

Save this file as `AGENTS.md` in the project root (Codex reads it automatically). Start a NEW Codex session after saving or editing it.

## 1. Product
Mobile-first PWA for travellers, India first: map of nearby spots and entertainment venues, routes, hourly weather + "best time to go", festivals/events, safety tools (SOS, live share, emergency places), optional Google login. App name undecided: use one constant `APP_NAME = "TravelApp"`.

## 2. Workflow
- Layout: `web/` (React PWA), `worker/` (Cloudflare Worker API + D1). Root npm scripts (created in M0, keep them working): `npm run dev`, `lint`, `typecheck`, `test`, `build`.
- One task = one milestone from section 8. Read only the milestone I name.
- S2 and S3 (location, alerts): show a plan of at most 8 lines and wait for my OK before coding. Other milestones: just build.
- Done = lint, typecheck, tests, and build all pass. Run them. Never say "done" without running them; if something can't run here, say exactly what.
- Final reply, max 10 lines: what was built, commands run + results, how to try it, known limits. Then stop and wait for "go".
- Minimal diffs. No unrelated refactors, extra features, or new dependencies without asking (name the candidate first). Simple readable code, short comments only where non-obvious. Do not re-read the whole repo.
- Tests for scoring logic, API adapters, and DB access.

## 3. Hard constraints
- Free only: no card, no paid APIs, no paid SMS, no Google Maps APIs (only an "Open in Google Maps" link). If a service might need a card or bill, stop and ask.
- Every external provider sits behind a small adapter with env config. Cache responses, debounce searches, stay within free limits.
- Follow each API's usage policy. Show OpenStreetMap attribution. Never scrape sites that forbid it. Never copy BookMyShow/District data: outbound links only.
- Secrets only in env vars; `.env` git-ignored; maintain `.env.example`. Never put secrets in this file.
- R2 photo storage is undecided: ask before using it.

## 4. Stack (change only with my approval)
React + Vite + TypeScript + Tailwind, `vite-plugin-pwa`, Motion, MapLibre GL JS (tile source configurable), OSM data via cached Overpass, free geocoder (Nominatim rules) and free routing (OSRM/OpenRouteService) via adapters, Open-Meteo weather, Cloudflare Pages + Workers + D1, Google sign-in only (verify ID token in a Worker, secure session cookie).

## 5. Data (D1)
users, favorites, trips, trip_stops, events (pending/approved), venues (booking_links JSON, price_note, price_updated_at, status), venue_reports, reviews, devices (anonymous id, coarse geohash, push sub), live_shares (token_hash, last position, expires_at), sos_alerts (geohash, status, expires_at, report_count). Emergency contacts live ONLY on the user's device (IndexedDB), never on the server.

## 6. Design (frontend)
- Gen Z, quirky collage/sticker/postcard style: tilted stickers, doodles, grain/halftone, thick outlines, hard offset shadows, passport stamps. Bold warm palette (cream, tomato, mustard, teal, lilac), per-state accent, light/dark, AA contrast.
- Never: purple-blue gradients, default glassmorphism, Inter/Roboto, stock icon decoration, default component-library look. Build a small custom design system (tokens, sticker components, motion helpers).
- Fonts (one config file, self-hosted, subset, `font-display: swap`): headings "Quinlliyk Retro Serif" only if the owner has a license (font unverified), else Fraunces or Gloock. Body DM Sans or Space Grotesk. Accents Caveat or Gochi Hand.
- Microcopy: short, funny, light Hinglish, never cringe.
- State backgrounds: detect state/UT (or manual pick); iconic landmark background with duotone/halftone + overlay for legibility, soft parallax, cross-fade. `states.json`: name, landmark, image, accent, creator, source URL, license. Only free-licensed images (CC0, CC BY, CC BY-SA, Unsplash-style), downloaded and optimized at build time (WebP/AVIF, about 120 KB max, blur-up, lazy-load, service-worker cache). No free photo: use a stylised illustration. Add an Attributions page.
- Motion (Motion library, View Transitions where supported): spring bottom sheets, marker-to-sheet shared transitions, postcard/sticker page transitions, bouncing doodle markers, swipe cards ("hangout or nah"), "vibe check" mood picker, weather mascot, confetti on saved trip, passport stamp for a new city/state, light haptics, playful loaders.
- Usability: respect `prefers-reduced-motion`; animate only transform/opacity; 60 fps on mid-range Android; tap targets 44 px or larger; every gesture has a visible button; first-screen JS around 200 KB or less (lazy-load map and heavy libs); accessible (semantic HTML, focus states, alt text, labels, readable text over images); offline for saved places and last map area.
- **SOS, emergency numbers, and the safety map: plain, high-contrast, large, instant. No decorative animation.**

## 7. Safety rules
1. Never claim to replace emergency services. Always show "Call 112" and a short disclaimer.
2. Safety features work without login: anonymous signed device token, rate limits per device and IP.
3. Be honest about PWA limits: no reliable background location, iPhone push needs a home-screen install, SMS can't be sent silently. Show this in the UI.
4. Explicit consent for location, notifications, and nearby alerts. Precise location only through the contacts' share link. Nearby broadcast uses coarse geohash only. Delete data on expiry. Add a privacy policy page.
5. Broadcast abuse controls: cooldown, daily limit, false-alarm reports, auto-hide after N reports, server-fixed 2 km radius (clients cannot set it), auto-expire, "I'm safe" closes the alert.
6. SOS never fails silently: queue and retry, show sent / not sent.
7. If free limits can't support real-time alerts, stop and ask before changing the design.
8. Flag anything needing legal review before launch.

## 8. Milestones (order: M0, M1, M2, S1, M3, M4, V1, M5, S2, S3, M6, M7, M8, M9)

**M0 Setup.** Folders `web/`, `worker/`; Vite+React+TS, Tailwind, PWA basics; design system with a demo page (section 6); root npm scripts; env handling; README (run + deploy); free Cloudflare deploy of hello-world. Done: all scripts exist and pass; app installs as a PWA.

**M1 Map + nearby places.** Full-screen map, "use my location", search. Markers by category (cafe, restaurant, attraction, park, museum, temple, viewpoint). Bottom-sheet detail: name, category, address, hours. Filters: category, distance, open now, rating (if data). Cached queries, good empty/slow states. State detection + background. Done: works on a 360px viewport.

**M2 Routes.** Directions from current/chosen start; route line, distance, duration, step list; walk/drive/cycle if supported. "Open in Google Maps" with destination prefilled.

**S1 Safety map + numbers.** "Safety" tab/layer: nearest police, hospitals, pharmacies, clinics, fire stations (OSM `amenity=police|hospital|pharmacy|clinic|doctors|fire_station`), each with Call + Directions; note that OSM coverage varies; "report missing place". Offline emergency numbers (India): 112, 100 police, 101 fire, 102/108 ambulance, 1091 women helpline (verify current; one config file). Cache nearest places offline.

**M3 Weather + best time.** Hourly forecast (temp, rain chance, wind, conditions), day and night. "Best time to go" per place: score hours by rain, temperature comfort, heat, opening hours, indoor/outdoor; show top windows in plain language. Scoring in one documented, unit-tested file. Alerts for heavy rain, heat, storms.

**M4 Events + special days.** In order, pause after each: (1) festivals/public holidays from a free API or curated JSON (check license); (2) user-submitted events with pending/approved moderation; (3) external events only via official free APIs/feeds that allow it. Map + list: today / this weekend / upcoming.

**V1 Entertainment venues (link-out only).** Map layer + list: cinemas, theaters, comedy clubs, gaming cafes, workshops. Sources: OSM (`amenity=cinema|theatre|internet_cafe|community_centre|studio`, `leisure=adult_gaming_centre`, `shop=video_games`), curated seed file for pilot cities, user submissions (pending/approved), "Add a missing venue". Detail: address, hours, tap-to-call phone, website, price note (text, "last updated", "confirm on booking site", report wrong price). Labeled booking buttons (own site, BookMyShow, District, other) as outbound links or provider search/city pages only. "What's on" section linking out to BookMyShow/District city pages and venue sites, merged with M4 events with source shown. No scraping, no paid scrapers, no copying their listings, images, prices, or ratings. Providers in one config file. Do not build any official partnership integration; keep the model flexible.

**M5 Accounts + favorites.** Google sign-in only; app fully usable without login; favorites in D1 scoped per user.

**S2 Live location share (no login).** Unguessable link with expiry (1/4/8 h) and a Stop button; share via `navigator.share`/WhatsApp/SMS links. Link opens a no-login page: map, last update time, stale warning. Sender posts updates while app is open (Wake Lock when possible). Store only the latest position; delete on expiry/stop.

**S3 SOS (no login).** Large SOS button, 5-second cancel countdown, prominent "Call 112". Up to 5 emergency contacts on-device (manual or Contact Picker). On SOS: start live share and open the SMS composer with all contacts + prefilled message and link (one tap to send), plus WhatsApp/share-sheet option. Nearby broadcast: opted-in users within 2 km get the alert via free Web Push (plus 15-30 s polling while app is open): approx distance/direction, time, map link, buttons Call 112 / I can help / Report false alarm. Sender can mark "I'm safe"; alerts auto-expire (~60 min). Follow section 7.

**M6 Trip planner.** Multi-stop itinerary: add/reorder stops, full route + total time, weather for the trip day; save/reopen trips (signed in).

**M7 Offline.** Cache app shell, saved places, last map area; clear offline state; sync on reconnect.

**M8 Reviews + photos.** Text reviews + rating first (rate and length limits, report/hide). Before photo uploads, STOP and ask which storage to use.

**M9 Polish + launch.** Lighthouse pass, real-device SOS test (Android + iPhone), accessibility, error/empty states, privacy policy + attributions pages, privacy-respecting analytics, deploy checklist.

---
**Start:** Read this file, then build **M0**. After each milestone I will reply "go" with the next name.
