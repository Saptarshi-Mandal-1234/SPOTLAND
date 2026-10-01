# Next step: verify the deployed SPOTLAND release

Reviewed 1 October 2026 (Asia/Calcutta).

Initial Cloudflare authentication, D1 migrations, Pages/API/R2 deployment, scheduled expiry verification and production Google sign-in are complete. The old instruction to log in and create these resources is superseded. Latest frontend deployment: `bdc07c51`, https://spotland.pages.dev. This review passed lint, typecheck, 140 tests / 42 files and build; public health, Google configuration and external-events checks returned HTTP 200.

## Latest result

Production favorites, trips, reviews and photo upload/approval/hide/deletion have passed live checks. Two real Google accounts passed collection switching/logout/reload isolation. Desktop keyboard/mobile-layout checks and current page audits are recorded in reports/release-checks/launch-followup.md; full device/legal gates remain open. VAPID keys/contact are configured and receiving/private tests enabled; broadcasts remain off. Android push/device testing was deferred by the owner; iPhone and operator/legal gates remain open. See reports/release-checks/README.md and OPERATOR_REVIEW.md.

## Earlier verification order (completed items now superseded)

1. On production, verify authenticated favorites, trips and text reviews save/reopen/remove correctly, including account isolation. Earlier synthetic/local tests do not complete these browser checks.
2. Verify a private test photo uploads to R2, stays hidden pending approval, appears after moderation, and can be hidden/reported/deleted. R2 is approved and deployed; live upload verification remains open. Monitor account usage because overages are billable.
3. Resolve operator approval for a public VAPID contact, configure keys and verify a private non-emergency push notification and opt-out. Current production SOS config is `enabled:false`, `pushPublicKey:null`; do not describe push or broadcasts as connected.
4. Complete controlled Android/iPhone location, safety, PWA/offline/update and physical-device performance tests with consenting participants. Never make emergency test calls or broadcast to uninvolved people.
5. Review the latest decorative release for keyboard, screen-reader, dark-mode and reduced-motion behavior; repeat relevant audits. Earlier M9 Lighthouse scores are historical home-page lab results.
6. Complete operator/legal approval of privacy, content moderation and deletion procedures, plus logging/provider/quota review, before approving a general safety launch. A support contact is already published; approval of the procedure remains outstanding.

No new feature milestone is defined after M9. Finish these verification gates before claiming the existing release is fully ready. See STATUS_REPORT.md for current limitations and LAUNCH_CHECKLIST.md for individual gates.