# Operator review and physical-device handoff

Prepared 1 October 2026. This is a review checklist, not legal approval or a compliance certification.

## Existing public behavior to approve

- Google account identifiers/display names and private favorites/trips are retained in D1. Email and Google ID tokens are not retained. Sign-out revokes the current session; it does not delete the account.
- The privacy page publishes Saptarshi Mandal and saptarshi2005.kgp@gmail.com as operator/contact. Review that identity, purpose, retention text and provider disclosures before general launch.
- Deletion requests currently need operator handling; no self-service account-deletion endpoint is provided. Agree a method to verify the requester, locate only their records, remove associated R2 photos/account data, confirm completion and document any required exceptions. Do not request passwords, tokens or private share links by email. This procedure must be approved and exercised; publishing an email does not establish it.
- Assign a moderator to pending events, venues and photos and reported reviews/prices. Record who has the private token and how reports are handled. Hidden-review restoration and multi-moderator audit history are unavailable.
- R2 overages are billable. Monitor total account usage as well as the app's 8 GiB cap. Do not promise guaranteed free capacity.
- SOS does not replace emergency services; notification display, assistance, SMS sending and background tracking are not guaranteed. Production SOS broadcasting remains off during these checks.

## Android checks (owner has an Android device)

Record phone model, Android/Chrome versions and each observed result. Use consenting test contacts only.

1. Install the HTTPS PWA, reload, browse a place, reopen its saved copy offline, reconnect, and check app-update behavior. Street tiles require a connection.
2. Private push: in SOS consent to receiving approximate-area alerts, allow location on your own device, consent separately to notifications, subscribe and send only the test notification to this device. Confirm its actual display/click. Then opt out and verify server subscription is off. Do not start a broadcast.
3. Cancel the SOS five-second countdown before it reaches zero; confirm no share/alert was sent. Inspect Call 112 without completing a call.
4. Separately test Live share with a consenting recipient: grant/deny permission, observe stale warnings on lock/background, Stop, expiry and failed/retried updates. Do not publish the private link.
5. With consenting contacts, inspect SMS/WhatsApp/share-sheet composers. Sending is a manual owner action. Never make test emergency calls.
6. Check 360px layout, dark mode, reduced motion, TalkBack headings/labels/status, keyboard focus and target sizes on Explore, trips, reviews and safety. Record physical-device performance.

## Remaining unavailable evidence

No iPhone is available. An iPhone owner must separately verify Home Screen installation/push, consent, share/composer, lock/background and expiry behavior. Android or desktop success cannot close that gate. Operator/legal approval must come from the operator/reviewer; automated audits cannot provide it.