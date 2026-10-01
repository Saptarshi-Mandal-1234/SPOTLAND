# Production verification — 1 October 2026

Latest frontend: https://7390ba02.spotland.pages.dev (production alias https://spotland.pages.dev).
API version: ea7617cf-a2a1-497b-9e6d-dd7135124fa9.

Passed: real Google login; favorite save/full reload/reopen/remove; two-stop trip save/full reload/reopen with stop order/remove; review save/full reload/reopen/remove; generated JPEG upload; pending public 404; moderator preview 200; approval and public JPEG 200; UI display; moderator hide/public 404; owner removal; R2 key missing; D1 photo records/budget zero. Anonymous favorites/trips returned 401 and public reviews had mine:null. All temporary content was removed with operator approval.

Fixed: Chrome canvas JPEG may include ICC APP2 segments that strict server validation rejects. Browser encoding now removes EXIF/ICC/IPTC/comment metadata before upload. Server validation was not weakened. Regression tests preserve scan bytes and reject truncated input.

Push: approved VAPID contact and matching keys configured. Separate PUSH_ENABLED allows private receiving/subscription/tests while SOS_ENABLED=false blocks broadcasts. No live push, GPS request, emergency call or message was sent by the agent. Owner deferred Android notification/device tests. iPhone unavailable. Actual two-account browser isolation, physical-device performance/TalkBack, wider manual accessibility and legal/operator approval remain open.

Checks: lint, typecheck, 140 tests / 42 files, build passed. Mobile live-home Lighthouse 96/100/100/100; desktop 100/100/100/100; no run warnings. Home audits ran before the isolated photo-encoding fix, so they are not fresh whole-app results for every final screen. At 360px the trip layout had no horizontal overflow; coordinate disclosure worked with Space. Approved-photo screenshot is retained as evidence; its temporary test content was subsequently removed.

Browser security policy blocked automated extension-settings access. Owner enabled file-URL access manually for upload; remind owner to disable it after testing. No workaround was attempted. Chrome automation reported context-storage console errors during earlier checks; persisted account data continued to work and the isolated Lighthouse runs reported no runtime errors. Source of those Chrome-context messages was not established.

See ../../OPERATOR_REVIEW.md for the physical-device and operator/legal handoff.
## Production API isolation follow-up

The repeatable two-session fixture run passed independent favorite collections, protected trip read/remove/overwrite, review ownership, authentication/origin rejection and logout revocation. Cleanup confirmed both fixture accounts and saved content were removed. See account-isolation.json. This closes the deployed API isolation check; actual two-Google-account browser switching/cache checks remain open. Hashed rate counters follow normal expiry.

Launch follow-up: see launch-followup.md for fresh per-page audits, responsive/keyboard checks, deployed metadata fixes, logging/provider review and remaining gates.
