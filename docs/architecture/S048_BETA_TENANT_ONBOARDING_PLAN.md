---
status: ready
owner: platform
last_verified: 2026-11-27
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/TRADEOS_BIBLE.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/operations/INVITED_BETA.md
  - docs/architecture/S047_RELEASE_CANDIDATE_SMOKE_SUITE_PLAN.md
related_code:
  - .github/workflows/beta-evidence.yml
  - app/scripts/beta-evidence/run.mjs
---

# S048 — Beta Tenant Onboarding Plan

## Outcome

S048 must prepare and execute controlled onboarding for the one named beta
contractor — Mike Lockler, start December 1, 2026 — and produce the four
acceptance artifacts: onboarding checklist, support path, feedback capture,
and rollback plan.

This sprint is operations + documentation + verification work over the
onboarding surfaces that already exist on current `main`. It is **not** a
new product feature, and it does **not** authorize a production change, a
schema change, a new trust boundary, or a launch decision.

## Readiness reconciliation

- Dependencies: S047 (`DONE` through merged implementation PR #397 and
  completion evidence in
  `docs/architecture/S047_COMPLETION_EVIDENCE.md`). There is no other
  implementation dependency to satisfy.
- Current `main` at readiness start is
  `f9b2262a7b506bd47cadd8e83c16582a4dfe30a8` (docs evidence PR #1157,
  merged 2026-11-27).
- Founder decision RESOLVED: Billy's word 2026-11-26 ~21:33 EST — beta
  starts December 1 with 1 outside contractor; contractor named
  2026-11-26 ~21:58 EST — Mike Lockler. The founder decision field
  ("select beta tenants and rollout date") is answered; no further
  founder selection is needed for this sprint.
- Live GitHub overlap rechecked 2026-11-27: open PRs are #1158
  (Athena alert email delivery, disjoint scope) and draft #1148 (Figma
  token/component drift audit, disjoint scope, founder hold). No remote
  branch implements S048; no live S048 lane exists.
- What already exists on current `main` (verified in the repository):
  - The S047 release-candidate smoke suite (Playwright route smoke,
    estimate-deliverability golden workflow, artifact publication,
    deployment URL, authenticated storage-state seams).
  - The Beta Evidence harness (`.github/workflows/beta-evidence.yml`,
    `app/scripts/beta-evidence/run.mjs`, `npm run beta:evidence`), with
    the `beta_pdf` scenario and the S052 role-evidence run.
  - The invited-beta runbook (`docs/operations/INVITED_BETA.md`):
    founder owns cohort selection, onboarding, support, incident
    disposition, and GO/HOLD; engineering owns repairs and evidence.
    Its cohort gate is now named (Mike Lockler, December 1) rather than
    open.
  - The staging test world: TEST Org with synthetic owner/admin/
    technician identities and the S052 inactive/admin members
    provisioned (PR #1151).
- What is missing — the gap S048 closes:
  - The onboarding checklist itself: the ordered steps that take the
    named contractor from first sign-in to real customer work, with an
    owner and completion evidence per step.
  - The support path: who the contractor contacts, how, and what
    response to expect — the runbook names the founder as support
    owner but records no path.
  - Feedback capture: the channel and cadence by which the contractor's
    findings reach engineering, and where they are recorded.
  - The rollback plan: the trigger, the approved rollback target, and
    the procedure for removing the contractor from the beta without
    losing or leaking their data.
  - The onboarding execution for Mike Lockler: his account/tenant
    setup, consent confirmation, and limitations + data-policy
    confirmation per the runbook cohort gate.

## Authoritative scope discovery

The implementation must derive the work from current sources, not memory:

1. Start with the runbook (`docs/operations/INVITED_BETA.md`): which
   gates are UNVERIFIED or OPEN, which the founder owns vs engineering,
   and what "GO/HOLD" requires for the exact release. S048 closes the
   onboarding gates; it does not close the release-certification gates
   (S052 roles, clarification, financial discrepancies, recovery
   rehearsal) that belong to their own sprints.
2. Trace the existing onboarding surfaces: invitation, login/session
   expiry, recovery, delivery-failure handling, private file access,
   and export/offboarding — the identity/storage gate in the runbook.
   Record what each surface already does and what onboarding must
   verify for the named contractor, without changing the surfaces.
3. Trace the staging test world: TEST Org memberships, the S052
   synthetic identities, and the beta-evidence fixture lifecycle. The
   onboarding execution uses the existing approved fixture lifecycle;
   it never bulk-deletes tenant data and never uses production fixtures.
4. Trace the support and feedback ownership: the founder is support
   owner per the runbook. The implementation records the actual
   contact path and feedback channel the founder confirms — it does
   not invent them.
5. Trace the rollback target: the runbook recovery gate requires an
   approved rollback target. The implementation records the target the
   release operator approves and the procedure for using it.

## Required evidence fields

Each onboarding step must record:

- the checklist item and its owner (founder vs engineering vs release
  operator);
- completion evidence (what proves the step happened — a record, a
  confirmation, a run receipt — not a claim);
- the support path (contact, channel, response expectation) as
  confirmed by the founder;
- the feedback channel and cadence, and where findings are recorded;
- the rollback trigger, the approved rollback target, and the
  procedure;
- the contractor's consent, limitations, and data-policy confirmation
  for the named beta (Mike Lockler), recorded privately, not in a
  public document.

## Bounds

- One named beta contractor only (Mike Lockler, start December 1,
  2026). No second tenant, no wider cohort, no rollout-date change is
  authorized by this promotion.
- No migration, role/permission, auth/RBAC/RLS policy, schema, or
  production change. No billing, entitlement, or pricing change. No
  production data mutation; staging/synthetic fixtures only.
- No launch approval and no GO/HOLD decision: S050 owns the launch
  decision, and the runbook reserves GO/HOLD to the founder for the
  exact release. S048 prepares onboarding; it does not declare the
  beta launched.
- No invented contractor details: the contractor's business name,
  contact, and scope of real work come from the founder, recorded
  privately. Public docs name only what the founder has already named.
- No release-certification claim: closing S048 does not close S052
  roles, clarification, financial discrepancies, recovery rehearsal,
  or full S100 release certification.

## Founder-decision boundary

NO for the bounded onboarding preparation and execution above. YES
before adding another beta tenant, changing the rollout date or the
named contractor, any production change, any change to which
environments count as approved beta targets, or the launch/GO
decision. S050's separate launch decision is not a dependency of S048
and is not decided by this promotion.

## Required validation

- Onboarding checklist, support path, feedback capture, and rollback
  plan documents, each naming its owner and its evidence.
- Onboarding execution record for the named contractor: account/tenant
  setup, consent confirmation, and limitations + data-policy
  confirmation, with the exact deployment SHA and tenant recorded.
- `git diff --check`; `npm run pr:preflight -- --base origin/main`;
  `npm run pr:test`; `npm run docs:test`;
  `npm run docs:check -- --base origin/main`; exact-head CI.
- No app/web suites are required for the documentation artifacts;
  any implementation change the onboarding execution needs follows the
  normal queue path with its own validation.
