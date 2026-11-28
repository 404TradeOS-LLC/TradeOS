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
data-policy confirmation, support-contact confirmation, rollback-target
approval, and the release GO for the exact release SHA are facts only
the founder has. Do not invent them; complete them at the Dec 1
onboarding and record them in the execution record.

**Production gate:** the invited-beta runbook's release record is HOLD
until the founder records GO or CONDITIONAL GO for the exact release.
No production tenant is provisioned until that gate passes (step 10).
S048 prepares onboarding; it does not declare the beta launched and
does not record a GO/HOLD decision itself.

## Before Dec 1 — preparation

| # | Step | Owner | Completion evidence |
| --- | --- | --- | --- |
| 1 | Founder confirms the support contact (address/phone) for the beta and records it privately. | Founder | Support contact recorded in `S048_BETA_ONBOARDING_EXECUTION_RECORD.md`; see `S048_BETA_SUPPORT_PATH.md` for the path. |
| 2 | Founder records privately the contractor's business name and contact email. | Founder | Private record held by the founder; the execution record notes only that it exists, never the values. |
| 3 | Founder confirms consent, limitations, and data policy with Mike Lockler (free beta scope, review-before-apply/send, no automatic supplier-price or AI approval). | Founder | Private confirmation record; execution record notes date and that consent was confirmed. |
| 4 | Founder and release operator agree the retention/deletion policy that applies on offboarding. | Founder + release operator | Policy recorded privately; execution record notes it exists. |
| 5 | Release operator verifies the production deployment in service and records the rollback target: `GET https://api.404tradeos.com/health` (commit SHA) and `GET https://api.404tradeos.com/ready` (database + schema green). | Release operator | `/health` + `/ready` output retained in the execution record. Verified 2026-11-28 ~03:02 EST: production serves `355f0ff3` (= current `main`), `/ready` green, DB project `kssaceuetdjwfqnbzhly`, schema ok. |
| 6 | Engineering runs the two suites that actually exercise the release candidate — exact-head CI does **not** run either of them. Dispatch `rc-smoke.yml` (the S047 release-candidate authenticated smoke suite) against the approved non-production target, and dispatch `beta-evidence.yml` with `mode: full` for the required scenario. A `preflight` Beta Evidence run passes without capturing evidence and does not satisfy this step. | Engineering | Both workflow run URLs recorded in the execution record. `rc-smoke.yml` and `beta-evidence.yml` are `workflow_dispatch`-only; neither runs on pull requests. |
| 7 | Engineering confirms the staging test world is available for rehearsal: TEST Org with synthetic owner/admin/technician identities and the S052 synthetic members (PR #1151). | Engineering | Staging `/health` reports `e99b0c89`, environment `preview` (verified 2026-11-28 ~03:02 EST). |
| 8 | Founder + release operator create or verify the contractor's Supabase Auth identity for their email and record its subject UUID privately. Supply that UUID as `owner.authSubject` and the email as `owner.email` to `POST /organizations` at step 11. A duplicate `authSubject` or email returns 409 — resolve before retrying. `POST /organizations` accepts no password and stores none: the provisioned owner row is created with `passwordHash` undefined, and local sign-in rejects a null `passwordHash`. The contractor establishes their own password after provisioning via the existing password-reset flow (`POST /password-reset/request` → `/confirm`, which sets the local `passwordHash` and revokes outstanding refresh tokens). Never record a password in any doc, chat, or command. | Founder + release operator | `authSubject` + email recorded privately; identity-creation confirmation noted in the execution record. |
| 9 | Release operator confirms the approved rollback target from step 5. | Release operator | Approval recorded in the execution record; see `S048_BETA_ROLLBACK_PLAN.md`. |

## Dec 1 — onboarding execution

| # | Step | Owner | Completion evidence |
| --- | --- | --- | --- |
| 10 | **Release gate — founder records GO or CONDITIONAL GO for the exact release** (the production SHA verified in step 5). The runbook reserves GO/HOLD to the founder for the exact release, and its release record is HOLD until then. If the founder records HOLD, onboarding stops here — no provisioning, no sign-in, no guided exercise. | Founder | GO / CONDITIONAL GO record (release SHA + date) in the execution record. |
| 11 | Provision the beta organization and owner account on production through the existing secret-gated provisioning route (`POST /organizations`, platform provisioning secret + IP allowlist + rate limit). Use the `authSubject` + email recorded in step 8. Never paste the secret into a doc, chat, or command. | Release operator | Organization ID and owner user ID recorded privately in the execution record; never in a public document. |
| 12 | Contractor signs in with the provisioned owner account. Founder confirms the session works and the contractor can reach only their own organization's records. | Founder + contractor | Sign-in confirmation + same-org access check recorded in the execution record. |
| 13 | Guided first exercise with the contractor: Customer → Project → manual or reviewed AI-assisted Estimate → saved/reloaded and finalized Estimate → Proposal → contractor-branded PDF downloaded for delivery outside TradeOS. Explain saving/reloading, explicit retry after uncertain Apply, manual estimating, and PDF delivery. Avoid untested legacy-data imports. | Founder | Guided-exercise completion noted in the execution record with date. |
| 14 | Confirm the feedback channel and support path with the contractor: how to report a problem without sharing passwords, tokens, or unnecessary customer data. | Founder | Contractor acknowledgement recorded in the execution record. |
| 15 | Record the execution record: exact production deployment SHA in service, tenant (organization ID, privately), consent/limitations/data-policy confirmation, support-contact confirmation, rollback-target approval, release GO record, smoke + Beta Evidence run URLs, and identity confirmation. | Release operator | `S048_BETA_ONBOARDING_EXECUTION_RECORD.md` complete for the Dec 1 execution. |

## After onboarding — steady state

| # | Step | Owner | Completion evidence |
| --- | --- | --- | --- |
| 16 | Triage routine feedback every business day in the governed issue queue; see `S048_BETA_FEEDBACK_CAPTURE.md`. | Founder + engineering | Issue queue entries with workflow location, expected/actual result, severity, owner, redacted reproduction, and resolution. |
| 17 | Watch the seven-consecutive-day critical-incident window. Expand from one business to at most three only after seven consecutive days without a critical incident and a founder feedback review. A critical incident restarts the window after verified resolution. | Founder | Founder feedback-review record; expansion is a separate founder decision, not part of S048. |
| 18 | On any critical incident (suspected cross-tenant access, wrong financial output, lost/corrupted data, inability to operate safely): stop new invitations immediately, contact the founder, preserve redacted diagnostics, and follow `S048_BETA_ROLLBACK_PLAN.md`. | Founder + engineering | Incident record in the governed issue queue; rollback/offboarding record if executed. |

## What this checklist does not do

- It does not declare the beta launched or record a GO/HOLD decision.
  The founder records GO, CONDITIONAL GO, or HOLD for the exact release;
  S050 owns the launch decision. Production provisioning (step 11) is
  gated on that GO (step 10); a HOLD stops onboarding before any
  production tenant exists.
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
  not a team invitee: owner provisioning goes through step 11, not the
  team-invite route. Provisioning accepts only `owner.authSubject` +
  `owner.email` (+ optional `fullName`) and stores no password; local
  sign-in rejects a null `passwordHash`, so the contractor establishes
  their password via the password-reset flow after provisioning (step 8).
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
