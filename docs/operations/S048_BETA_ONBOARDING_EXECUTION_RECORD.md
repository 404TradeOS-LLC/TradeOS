---
status: current
owner: platform
last_verified: 2026-11-28
source_of_truth: true
related_docs:
  - docs/architecture/S048_BETA_TENANT_ONBOARDING_PLAN.md
  - docs/operations/INVITED_BETA.md
  - docs/operations/S048_BETA_ONBOARDING_CHECKLIST.md
  - docs/operations/S048_BETA_SUPPORT_PATH.md
  - docs/operations/S048_BETA_FEEDBACK_CAPTURE.md
  - docs/operations/S048_BETA_ROLLBACK_PLAN.md
  - docs/SPRINT_BACKLOG.md
---

# S048 — Beta Onboarding Execution Record

Execution record for the one named beta contractor. This record is
completed at the Dec 1, 2026 onboarding; fields that only the founder
can supply are marked **PENDING** until then. Contractor-identifying
values (business name, contact email, organization ID, user ID) are
recorded **privately by the founder**, never in a public document and
never in this file beyond noting that the private record exists.

## Named beta

| Field | Value |
| --- | --- |
| Contractor | Mike Lockler (founder's word 2026-11-26 ~21:58 EST) |
| Start date | December 1, 2026 (founder's word 2026-11-26 ~21:33 EST: beta starts Dec 1 with 1 outside contractor) |
| Scope | Free beta: Customer → Project → Estimate → Proposal → contractor-branded PDF delivered outside TradeOS. Jobs, dispatch, field work, invoicing, subscriptions, customer-portal acceptance deferred. |
| Business name | **PENDING — founder-owned.** Recorded privately by the founder before the first invitation. |
| Contact email | **PENDING — founder-owned.** Recorded privately by the founder before the first invitation. |

## Target deployment (verified at authoring, re-verify at onboarding)

| Field | Value |
| --- | --- |
| Beta target | Production — `https://api.404tradeos.com` / `https://app.404tradeos.com` |
| Production SHA at authoring | `355f0ff3` (= `main` `355f0ff3896c5aa6ae85a647e6f8ef0a6350bf7e`), verified live 2026-11-28 ~03:02 EST via `/health` (environment `production`); `/ready` green, database project `kssaceuetdjwfqnbzhly`, schema ok |
| Production SHA at onboarding | **PENDING — release operator records the exact SHA in service on Dec 1.** If production has moved since authoring, the Dec 1 value governs. |
| Staging SHA at authoring | `e99b0c89`, environment `preview` (verified 2026-11-28 ~03:02 EST). Staging is the rehearsal target only, not the beta target. |
| Rollback target approval | **PENDING — release operator confirms the target at onboarding** (checklist step 9). |

## Release decision (GO / CONDITIONAL GO / HOLD)

| Field | Value |
| --- | --- |
| Decision | **PENDING — founder records GO or CONDITIONAL GO for the exact release SHA at onboarding** (checklist step 10). The runbook's release record is HOLD until then. A HOLD stops onboarding before any production tenant is provisioned. |
| Release SHA | The production SHA verified in the checklist step 5, recorded here at onboarding. |

## Evidence runs (before Dec 1)

| Run | Status |
| --- | --- |
| `rc-smoke.yml` dispatch (S047 release-candidate authenticated smoke suite) against the approved non-production target | **PENDING — run URL recorded here** (checklist step 6). |
| `beta-evidence.yml` dispatch, `mode: full`, required scenario | **PENDING — run URL recorded here** (checklist step 6). A `preflight` run does not satisfy this step. |

## Founder confirmations (due at/before Dec 1)

| Item | Status |
| --- | --- |
| Support contact (address/phone) confirmed and recorded privately | **PENDING** (checklist step 1) |
| Consent confirmed with the contractor | **PENDING** (checklist step 3) |
| Limitations confirmed (free beta scope, review-before-apply/send, no automatic supplier-price or AI approval) | **PENDING** (checklist step 3) |
| Data policy confirmed | **PENDING** (checklist step 3) |
| Retention/deletion policy agreed (founder + release operator) | **PENDING** (checklist step 4) |

## Onboarding execution (Dec 1)

| Step | Evidence | Status |
| --- | --- | --- |
| Supabase Auth identity created/verified; `authSubject` + email recorded privately | Identity-creation confirmation | **PENDING — before Dec 1** (checklist step 8) |
| Release GO / CONDITIONAL GO recorded for the exact release SHA | GO record (release SHA + date) | **PENDING — Dec 1** (checklist step 10) |
| Organization + owner account provisioned on production via the existing secret-gated provisioning route | Organization ID + owner user ID recorded privately | **PENDING — Dec 1** (checklist step 11) |
| Contractor password established by the contractor (password-reset flow) and first sign-in confirmed; same-org-only access confirmed | Sign-in + access-check confirmation | **PENDING — Dec 1** (checklist step 12) |
| Guided Customer → Project → Estimate → Proposal/PDF exercise completed | Completion note with date | **PENDING — Dec 1** (checklist step 13) |
| Feedback channel + support path confirmed with contractor | Contractor acknowledgement | **PENDING — Dec 1** (checklist step 14) |

## Post-onboarding

| Item | Status |
| --- | --- |
| Daily feedback triage running | Not started — begins Dec 1 |
| Seven-day no-critical-incident window | Not started — begins Dec 1 |
| Rollback executed | No — record here if ever executed, with trigger, export receipt, suspension confirmation, and policy applied |

## What remains open after this record is completed

Completing this record does **not** close the runbook's
release-certification gates (S052 roles, clarification
answer/regeneration, financial discrepancies, recovery rehearsal) and
does **not** record a GO/HOLD decision or a launch approval. Those
belong to their own sprints and to the founder (S050 owns the launch
decision).
