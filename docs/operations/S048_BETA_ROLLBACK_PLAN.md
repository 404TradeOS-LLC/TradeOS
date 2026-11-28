---
status: current
owner: platform
last_verified: 2026-11-28
source_of_truth: true
related_docs:
  - docs/operations/INVITED_BETA.md
  - docs/operations/S048_BETA_ONBOARDING_CHECKLIST.md
  - docs/operations/S048_BETA_SUPPORT_PATH.md
  - docs/operations/S048_BETA_FEEDBACK_CAPTURE.md
  - docs/operations/S048_BETA_ONBOARDING_EXECUTION_RECORD.md
  - docs/operations/BETA_RECOVERY_REHEARSAL.md
  - docs/operations/INVITED_BETA_MANUAL_EXPORT.md
---

# S048 — Beta Rollback Plan

How the one named beta contractor (**Mike Lockler, start December 1,
2026**) is removed from the beta without losing or leaking their data,
and what the rollback target is. This plan removes a *tenant from the
beta*; it does not roll application code back, and it never authorizes
destructive database commands.

## Rollback target

- **Target:** the production deployment in service at onboarding.
  Verified 2026-11-28 ~03:02 EST: production API
  (`https://api.404tradeos.com`) serves commit `355f0ff3`
  (= current `main`), `/ready` green, database project
  `kssaceuetdjwfqnbzhly`, schema ok. Staging serves `e99b0c89`
  (environment `preview`) and is **not** the beta target.
- **Approval:** the release operator confirms the target at onboarding
  (checklist step 8) and records the exact SHA then in service in the
  execution record. The SHA above is the verified value at authoring
  time; if production has moved by Dec 1, the execution record carries
  the Dec 1 value, not this one.
- **Code rollback is out of scope:** never roll application code back
  across incompatible schema. A code problem is repaired forward
  through the normal PR queue; tenant rollback below is the beta
  removal path.

## Triggers

Execute this plan when any of these holds:

1. **Critical incident:** suspected cross-tenant access, wrong
   financial output, lost/corrupted data, or inability to operate
   safely.
2. **Founder HOLD:** the founder records HOLD for the exact release,
   or withdraws the contractor from the beta.
3. **Contractor request:** the contractor asks to leave the beta.
4. **Failed onboarding:** the Dec 1 onboarding cannot complete
   (account/tenant setup, sign-in, or guided exercise fails and cannot
   be repaired in the session).

## Procedure

1. **Stop new invitations immediately.** No new beta tenant is invited
   while a rollback is in progress.
2. **Contact the founder at once** (support path:
   `S048_BETA_SUPPORT_PATH.md`). The founder owns incident
   disposition.
3. **Preserve redacted diagnostics.** Capture what happened (workflow
   location, expected/actual, severity) in the governed issue queue.
   Never include passwords, tokens, or unnecessary customer data.
4. **Provide the founder-approved authorized export.** Use the
   selected-journey export procedure
   (`docs/operations/INVITED_BETA_MANUAL_EXPORT.md`,
   `scripts/invited-beta-journey-export.mjs`) as the rehearsed
   mechanism for the Customer → Project → Estimate → Proposal/PDF
   journey. A real-business export is a confidential deliverable: it
   requires a separately approved data-handling procedure, recipient
   identity, and retention policy — the synthetic staging rehearsal
   does not authorize a production export by itself, and the helper
   intentionally rejects production configuration. Do not improvise
   destructive database commands.
5. **Suspend the account and revoke sessions.** Confirm account
   suspension / session-revocation behavior for the contractor's owner
   account before offboarding; record the confirmation in the
   execution record.
6. **Apply the agreed retention/deletion policy.** The founder and
   release operator agree the policy before Dec 1 (checklist step 4);
   follow it exactly. Never bulk-delete tenant data.
7. **Record the rollback.** Date, trigger, export receipt, suspension
   confirmation, and policy applied go in the execution record and the
   governed issue queue.
8. **Restart the window.** A critical incident restarts the
   seven-consecutive-day no-critical-incident window after verified
   resolution; expansion to a second or third business waits for that
   window plus a founder feedback review.

## What this plan does not cover

- Production backup / point-in-time recovery and approved RTO/RPO:
  those remain separate gates under the runbook's recovery gate, not
  closed by S048. The 2026-11-13 disposable restore rehearsal proves
  synthetic snapshot recovery mechanics only.
- A second tenant's rollback: adding a tenant is a separate founder
  decision, and its rollback is planned then.
- Any launch/GO decision: S050 owns it.
