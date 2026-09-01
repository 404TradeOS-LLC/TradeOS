---
status: current
owner: platform
last_verified: 2026-09-01
source_of_truth: false
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/architecture/S043_SECURITY_EVENT_AUDIT_TRAIL_PLAN.md
  - docs/architecture/S043_COMPLETION_EVIDENCE.md
  - docs/architecture/S047_RELEASE_CANDIDATE_SMOKE_SUITE_PLAN.md
  - docs/decisions/ADR-009-solo-maintainer-founder-merge-exception.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

S043 and S047 are DONE. S047's implementation PR #397 and completion evidence
are merged. An out-of-band RC incident repair is in progress on
`fix/rc-dashboard-api-error`.
S027 remains independently BLOCKED on authenticated rendered Costbook evidence;
S036 remains blocked by S027; S044/S045 remain blocked on production access.

## Current truth

- `origin/main` is `e872fa40f6e32175a80284f44c768d3307bdc22f`; S043 implementation
  PR #395 is merged and its completion evidence is recorded in
  `docs/architecture/S043_COMPLETION_EVIDENCE.md`.
- S047 implementation PR #397 is merged and its completion evidence is recorded
  in `docs/architecture/S047_COMPLETION_EVIDENCE.md`. Its readiness contract is
  retained in `docs/architecture/S047_RELEASE_CANDIDATE_SMOKE_SUITE_PLAN.md`.
- Existing RC Playwright route and golden-workflow seams are the implementation
  baseline. No new product behavior, credential storage, schema, migration,
  role, permission, RLS redesign, or launch approval is authorized by S047.
- S044/S045 require production control-plane access; S046 is blocked by S045.
  S048 requires a later founder decision for beta tenants and rollout date.
- The 2026-09-01 RC dashboard incident was traced to production schema drift:
  the deployed Prisma client expected estimate tax and project-detail financial
  columns that were missing from the canonical RC database. The exact missing
  repository migrations were applied and their checksums reconciled in
  `public."_prisma_migrations"`; no authorization, RLS, or tenant filter was
  weakened. The remaining work is the focused application logging/readiness
  patch, merge/deployment, and authenticated browser/contractor smoke evidence.
- The founder accepted ADR-009 on 2026-08-28: with no qualified independent
  reviewer available, a PR may use the documented founder-only merge-review
  exception after all required technical gates pass. The exception does not
  waive CI, branch freshness, thread resolution, linear history, deletion or
  non-fast-forward protection, and the live ruleset still needs its narrow
  extra-approval setting updated before auto-merge can use the policy.

## S047 readiness contract

Automate and document repeatable release-candidate smoke evidence over existing
authenticated auth, customer, estimate, proposal, contract, job, invoice, and
portal flows. Reuse the existing Playwright and artifact seams without changing
product behavior, credentials, schema, migrations, RLS, or RBAC.

Forbidden: production credentials in the repository, live customer-data
mutation outside an explicitly selected smoke environment, product behavior,
schema/migrations, RLS/RBAC redesign, S027, S036, S044, S045, S046, S048, or
destructive data work.

## Next Eligible Sprint
Sprint ID: NONE
Eligibility: No numbered sprint is currently READY; S022, S028, S033, S040, and S047 are DONE with merged evidence. The RC dashboard work is bounded maintenance, not a new numbered sprint. S044/S045 are blocked on production access and S046 is blocked by S045.
Dependencies: S022, S028, S033, and S040 are DONE; repository implementation requires no founder decision or external credential. Live authenticated deployment evidence requires the existing scoped RC storage-state secret and selected deployment URL.
Overlap check: PR #397 is merged and no open S047 implementation lane remains. Keep S027, S036, S044, S045, S046, and S048 independent.
Startup prompt: No numbered sprint is currently eligible. Resume only after this bounded RC incident is closed and a lower-numbered READY sprint is promoted under `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` or after external evidence blockers are removed.
