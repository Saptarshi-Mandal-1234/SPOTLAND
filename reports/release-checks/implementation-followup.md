# Implementation and operations follow-up — 1 October 2026

Fixed a confirmed app-update failure: a rejected service-worker update previously had no visible recovery message. Updates now expose applying/failed/requested status, disallow repeated activation while applying and disable activation offline. Failure/retry and synchronous-adapter failure have regression tests. No new dependency or provider was added.

The owner confirmed SPOTLAND stays non-commercial. Production Worker settings were read through refreshed existing Wrangler credentials: both API and cleanup report Logpush=false, and D1 is 385,024 bytes. Account-wide Logpush/subscription reads returned 403; current subscription, account usage and other log sinks remain unverified. Workers default usage model standard is not proof of billing status. No permission/plan changes were made.

OPERATOR_RUNBOOK.md now provides moderation, privacy-request/deletion, quota-review and safety-launch procedures. It does not claim that an operator has been assigned, a legal review has occurred, or a self-service deletion feature exists. Account deletion requires reliable authenticated ownership verification, specific approval, scoped R2/D1 removal and completion checks.

Existing device/push/accessibility tests remain deferred or pending as documented. SOS broadcast remains disabled. Legal/operator approval and account-wide billing/log review are the remaining non-testing gates; they cannot be signed off by the implementation agent.

Validation: npm run lint, npm run typecheck, npm run test (142 tests / 43 files) and npm run build passed. The build retains the previously documented non-fatal warnings.
