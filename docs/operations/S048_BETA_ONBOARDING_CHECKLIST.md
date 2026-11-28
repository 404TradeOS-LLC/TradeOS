---
status: current
owner: platform
last_verified: 2026-11-28
source_of_truth: true
related_docs:
  - docs/architecture/S048_BETA_TENANT_ONBOARDING_PLAN.md
  - docs/operations/INVITED_BETA.md
  - docs/operations/S048_BETA_SUPPORT_PATH.md
  - docs/operations/S048_BETA_FEEDBACK_CAPTURE.md
  - docs/operations/S048_BETA_ROLLBACK_PLAN.md
  - docs/operations/S048_BETA_ONBOARDING_EXECUTION_RECORD.md
  - docs/SPRINT_BACKLOG.md
---

# S048 — Beta Tenant Onboarding Checklist

Ordered steps that take the one named beta contractor — **Mike Lockler,
start December 1, 2026** — from first sign-in to real customer work on
production. One named contractor only. No second tenant, no rollout-date
change, no launch approval (S050 owns it), no production code or
configuration change, no migration, role/permission, auth/RBAC/RLS policy,
or billing change.

Each step names its owner and the completion evidence that proves it
happened — a record, a confirmation, or a run receipt, not a claim.
Steps marked **PENDING — founder-owned** cannot be completed by
engineering: the business name, contact email, consent, limitations,
data-policy confirmation, support-contact confirmation, and rollback-target
approval are facts only the founder has. Do not invent them; complete
them at the Dec 1 onboarding and record them in the execution record.

## Before Dec 1 — preparation

| # | Step | Owner | Completion evidence |
| --- | --- | --- | --- |
| 1 | Founder confirms the support contact (address/phone) for the beta and records it privately. | Founder | Support contact recorded in `S048_BETA_ONBOARDING_EXECUTION_RECORD.md`; see `S048_BETA_SUPPORT_PATH.md` for the path. |
| 2 | Founder records privately the contractor's business name and contact email. | Founder | Private record held by the founder; the execution record notes only that it exists, never the values. |
| 3 | Founder confirms consent, limitations, and data policy with Mike Lockler (free beta scope, review-before-apply/send, no automatic supplier-price or AI approval). | Founder | Private confirmation record; execution record notes date and that consent was confirmed. |
| 4 | Founder and release operator agree the retention/deletion policy that applies on offboarding. | Founder + release operator | Policy recorded privately; execution record notes it exists. |
| 5 | Release operator verifies the production deployment in service and records the rollback target: `GET https://api.404tradeos.com/health` (commit SHA) and `GET https://api.404tradeos.com/ready` (database + schema green). | Release operator | `/health` + `/ready` output retained in the execution record. Verified 2026-11-28 ~03:02 EST: production serves `355f0ff3` (= current `main`), `/ready` green, DB project `kssaceuetdjwfqnbzhly`, schema ok. |
| 6 | Engineering verifies the S047 smoke suite and the Beta Evidence harness are green on current `main`. | Engineering | Exact-head CI run on the S048 implementation PR; S047 evidence in `docs/architecture/S047_COMPLETION_EVIDENCE.md`. |
| 7 | Engineering confirms the staging test world is available for rehearsal: TEST Org with synthetic owner/admin/technician identities and the S052 synthetic members (PR #1151). | Engineering | Staging `/health` reports `e99b0c89`, environment `preview` (verified 2026-11-28 ~03:02 EST). |
| 8 | Release operator confirms the approved rollback target from step 5. | Release operator | Approval recorded in the execution record; see `S048_BETA_ROLLBACK_PLAN.md`. |

## Dec 1 — onboarding execution

| # | Step | Owner | Completion evidence |
| --- | --- | --- | --- |
| 9 | Provision the beta organization and owner account on production through the existing secret-gated provisioning route (`POST /organizations`, platform provisioning secret + IP allowlist + rate limit). Never paste the secret into a doc, chat, or command. | Release operator | Organization ID and owner user ID recorded privately in the execution record; never in a public document. |
| 10 | Contractor signs in with the provisioned owner account. Founder confirms the session works and the contractor can reach only their own organization's records. | Founder + contractor | Sign-in confirmation + same-org access check recorded in the execution record. |
| 11 | Guided first exercise with the contractor: Customer → Project → manual or reviewed AI-assisted Estimate → saved/reloaded and finalized Estimate → Proposal → contractor-branded PDF downloaded for delivery outside TradeOS. Explain saving/reloading, explicit retry after uncertain Apply, manual estimating, and PDF delivery. Avoid untested legacy-data imports. | Founder | Guided-exercise completion noted in the execution record with date. |
| 12 | Confirm the feedback channel and support path with the contractor: how to report a problem without sharing passwords, tokens, or unnecessary customer data. | Founder | Contractor acknowledgement recorded in the execution record. |
| 13 | Record the execution record: exact production deployment SHA in service, tenant (organization ID, privately), consent/limitations/data-policy confirmation, support-contact confirmation, and rollback-target approval. | Release operator | `S048_BETA_ONBOARDING_EXECUTION_RECORD.md` complete for the Dec 1 execution. |

## After onboarding — steady state

| # | Step | Owner | Completion evidence |
| --- | --- | --- | --- |
| 14 | Triage routine feedback every business day in the governed issue queue; see `S048_BETA_FEEDBACK_CAPTURE.md`. | Founder + engineering | Issue queue entries with workflow location, expected/actual result, severity, owner, redacted reproduction, and resolution. |
| 15 | Watch the seven-consecutive-day critical-incident window. Expand from one business to at most three only after seven consecutive days without a critical incident and a founder feedback review. A critical incident restarts the window after verified resolution. | Founder | Founder feedback-review record; expansion is a separate founder decision, not part of S048. |
| 16 | On any critical incident (suspected cross-tenant access, wrong financial output, lost/corrupted data, inability to operate safely): stop new invitations immediately, contact the founder, preserve redacted diagnostics, and follow `S048_BETA_ROLLBACK_PLAN.md`. | Founder + engineering | Incident record in the governed issue queue; rollback/offboarding record if executed. |

## What this checklist does not do

- It does not declare the beta launched or record a GO/HOLD decision.
  The founder records GO, CONDITIONAL GO, or HOLD for the exact release;
  S050 owns the launch decision.
- It does not close the runbook's release-certification gates: S052
  roles, clarification answer/regeneration, financial discrepancies,
  and recovery rehearsal remain open under their own sprints.
- It does not authorize a second tenant, a date change, a production
  change, or any change to which environments count as approved beta
  targets.

## Existing onboarding surfaces traced (2026-11-28, main `355f0ff3`)

- **Invitation:** `POST /invites` (`inviteTeamMember`) — dispatcher and
  technician roles only, 7-day opaque token (hashed at rest), email via
  Resend with a delivery journal. The beta contractor is an org *owner*,
  not a team invitee: owner provisioning goes through step 9, not the
  team-invite route.
- **Sign-up / org bootstrap:** `POST /signup` (rate-limited) bootstraps
  a brand-new organization on login when required.
- **Recovery:** `POST /password-reset/request` and
  `POST /password-reset/confirm` (rate-limited).
- **Private file access:** organization-scoped private storage served
  through authenticated access; arbitrary URLs are not storage-ownership
  evidence.
- **Export / offboarding:** bounded synthetic staging rehearsal in
  `docs/operations/INVITED_BETA_MANUAL_EXPORT.md` (`scripts/invited-beta-journey-export.mjs`,
  five files, synthetic staging only — it rejects production). A real
  business export needs a separately approved data-handling procedure,
  recipient identity, and retention policy; see the rollback plan.
- **Recovery rehearsal:** a disposable PostgreSQL/private-S3 restore was
  actually executed 2026-11-13 (`docs/operations/BETA_RECOVERY_REHEARSAL.md`
  + receipt). It proves synthetic snapshot recovery mechanics only; it
  does not close production backup/PITR, rollback, alerting, or
  support-owner requirements.
