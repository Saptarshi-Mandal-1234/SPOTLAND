# SPOTLAND operator runbook

Prepared 1 October 2026. This provides operating procedures; it is not legal approval.

## Daily content handling

1. Open Community events and the Moderator access, Traveller review moderation and Traveller photo moderation sections. Retrieve the private ADMIN_TOKEN through your existing protected local/environment configuration; never commit or email it.
2. Review pending events and venues for accurate public details, appropriate outbound links and spam. Approve only public, suitable submissions; reject unrelated or abusive entries.
3. Review reported prices and reviews, and hide abusive content. Review pending photos privately, checking permission, private details and suitability before approval. Hide inappropriate approved images. Record the action, date and reason in a private operator log without copying private location links, credentials or unnecessary personal data.
4. Clear the moderator token from the UI when finished, especially on shared devices. Assign an accountable moderator before inviting public submissions. Review restoration, bans and multiple-moderator audit history are not implemented.

## Privacy and deletion requests

Use the published operator contact. Never request passwords, Google ID tokens, session cookies or live-share links by email. Display names alone cannot establish ownership, as two accounts can share the same name.

Verify the requester through an authenticated, owner-scoped account-identification process before deletion. Establish the exact user ID and records involved; obtain the owner's specific deletion instruction and review the affected rows. The app has no self-service account-deletion endpoint. If reliable identity verification is unavailable, escalate for operator review rather than deleting a matching-name account.

For an authorized deletion, remove associated R2 review objects and upload reservations through the application's reviewed photo-removal logic before deleting dependent D1/account records. Avoid broad SQL based on names or unverified identifiers. Verify the object's absence, database removal, storage-budget release and session revocation. Record the request/result privately with minimal data and confirm completion. Account deletion and retention exceptions require operator/legal approval before this procedure can be promised as a production service.

## Infrastructure and quota review

SPOTLAND must remain non-commercial under the current free Open-Meteo provider; the owner confirmed this on 1 October 2026. Revisit the provider before monetization.

Review Workers/Pages request and CPU usage, D1 reads/writes/storage, and R2 storage and operations in the Cloudflare dashboard. Include other applications sharing the account. R2's free allowance does not impose a universal hard billing cap; its overages are billable despite the app's 8 GiB storage cap. Reduce or pause public submissions before approaching limits; do not upgrade or enable paid services without approval.

Official current references: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

API review on 1 October: travelapp-api and spotland-expiry-cleanup both report Logpush disabled; D1 file size is 385,024 bytes. Account-wide Logpush jobs and subscription reads returned HTTP 403 with existing CLI credentials. Workers account settings reported a default usage model of standard, which alone does not establish the account's subscription or whether it is being billed. An authorized operator must verify those dashboard settings. No permission expansion or plan change was performed.

## Safety launch gate

Keep SOS_ENABLED=false until controlled delivery/device checks and operator approval are recorded. Do not send test emergencies to uninvolved users or call emergency numbers during testing. Continue publishing the foreground-location, iPhone install, manual SMS and no-guaranteed-assistance limits. Android testing remains deferred; no iPhone is available.
