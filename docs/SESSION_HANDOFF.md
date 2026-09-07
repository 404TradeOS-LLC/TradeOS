---
status: current
owner: platform
last_verified: 2026-09-05
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

Active bounded continuation: S027 authenticated Costbook browser evidence.
The evidence runner/workflow now covers the nine-route, four-viewport matrix
with runtime Beta authentication, deployment identity, keyboard focus, equipment
CRUD/error states, and pricing preview. Live execution and screenshot review
are pending; S027 is not yet DONE. Shared checkout dashboard edits and draft
PR #453 remain outside this worktree and mission.

S043 and S047 are DONE. The out-of-band RC dashboard/beta-evidence repair
lineage (PRs #440, #442, #443, #444, #445, #446, #449, #451, #452, #454, #455,
#456, #457, #458) is merged to `origin/main`; there is no in-progress
`fix/rc-dashboard-api-error` work left open.
S027 remains independently BLOCKED on authenticated rendered Costbook evidence;
S036 remains blocked by S027; S044/S045 remain blocked on production access.

## Current truth

- `origin/main` is `cb8469f43484ce1df6b416ebbc2f2bcb8319a07a` (#458, "promote
  validated estimate-to-invoice RC repairs"). S043 implementation PR #395 and
  S047 implementation PR #397 remain merged with completion evidence in
  `docs/architecture/S043_COMPLETION_EVIDENCE.md` and
  `docs/architecture/S047_COMPLETION_EVIDENCE.md`.
- PR #458 promoted the RC-proven browser API proxy path normalization,
  proposal-cents preservation, invoice Decimal-to-number display
  normalization, mobile `PageHeader` 390px-overflow fix, and a custom
  estimate line-item source-constraint migration
  (`20260905050000_allow_custom_estimate_line_items`). Beta Evidence run
  `33945411532` passed authentication, tenant isolation, 1440/1024/768/390
  browser capture, and the full estimate→proposal→contract→invoice path
  against a non-production RC preview correlated to deployment
  `ee2300a438311e50f6813510578c125073a1f850`.
- The dashboard "Needs attention" / "Estimates in progress" surface already
  renders a truthful per-section degraded state (`SectionError` in
  `web/src/components/dashboard/needs-attention-card.tsx`) instead of a raw
  "Internal server error," and dashboard project-detail fan-out already
  preserves healthy project data when one detail request fails (see
  `docs/CURRENT_STATE.md`). Historical task input describing that dashboard
  symptom as open is stale; verify against a fresh Vercel log/error before
  treating it as a live defect.
- S040 (tenant boundary regression suite) and S041 (RLS policy coverage
  audit) are both DONE (PR #346, PR #351); there is no known 13-table RLS gap
  on `origin/main`. Verify against `mcp__Supabase__get_advisors` /
  `list_tables` before assuming otherwise.
- Existing RC Playwright route and golden-workflow seams are the implementation
  baseline. No new product behavior, credential storage, schema, migration,
  role, permission, RLS redesign, or launch approval is authorized by S047.
- S044/S045 require production control-plane access; S046 is blocked by S045.
  S048 requires a later founder decision for beta tenants and rollout date.
- Open PRs on `origin/main` as of 2026-09-05: #453 (draft, `chore/contract-
  invoice-line-price-columns`) intentionally remains unmergeable pending
  production rollout/rehearsal evidence for the expand-phase invoice line
  price columns; #447 (dependabot, `qs` 6.15.3→6.16.0 in a nested
  `packages/knowledge-engine` example app) is pending checks and is not a
  production-code dependency.
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
Eligibility: No numbered sprint is currently READY; S022, S028, S033, S040, S041, and S047 are DONE with merged evidence. The RC dashboard/beta-evidence repair lineage through PR #458 is bounded out-of-band maintenance, not a new numbered sprint, and is fully merged (nothing left in flight). S044/S045 are blocked on production access, S046 is blocked by S045, and S048/S049/S050 are PLANNED pending their stated dependencies/founder decisions.
Dependencies: S022, S028, S033, S040, and S041 are DONE; repository implementation requires no founder decision for any currently-open lane. Draft PR #453 is intentionally held for production rollout/rehearsal evidence on the invoice line-price column drop, not repository implementation.
Overlap check: PR #397, #436, #437, #438, #440, #442-#446, #449, #451, #452, and #454-#458 are all merged. No open PR implements S027 browser evidence, S036, S044, S045, S046, or S048 work. Keep those independent of any new lane.
Startup prompt: No numbered sprint is currently eligible. The only open, non-dependabot PR is draft #453, which stays blocked until production rollout/rehearsal evidence is supplied — do not merge it or reopen the RC-repair lineage that #458 already promoted. Verify S027 authenticated Costbook browser evidence or production/Supabase access (S044/S045) before starting any new bounded lane.
