---
status: current
owner: platform
last_verified: 2026-08-21
source_of_truth: true
related_code:
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/CURRENT_STATE.md
  - docs/ROADMAP.md
  - docs/SESSION_HANDOFF.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# TradeOS 50-Sprint Backlog

Status vocabulary: `DONE`, `IN_REVIEW`, `READY`, `BLOCKED`, `PLANNED`, `DEFERRED`, `CANCELLED`.

This document owns current sprint status and merge evidence. Governance doctrine belongs in `docs/TRADEOS_BIBLE.md`; the sole executable startup and completion flows belong in `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`.

## Phase 1 — Governance and Execution System

### S001 — TradeOS Bible foundation

Status: DONE
Dependencies: none
Objective: Establish the canonical Bible index, numbered sprint queue, and autonomous next-sprint protocol.
Evidence: PR #31 merged 2026-07-16 as `ac72ff235db687d9cb8619820e536aec040afc6b`.

### S002 — Contractor UX research and Founder Preview specification

Status: DONE
Dependencies: none
Objective: Land verified contractor research and the Founder Preview experience specification.
Evidence: PR #27 merged 2026-07-16 as `279bdae26e2fc1856c7cc28e6756529c0ec508e7`.

### S003 — Solo-maintainer governance calibration

Status: DONE
Dependencies: none
Objective: Document and verify the solo-maintainer ruleset posture without weakening repository controls.
Evidence: PR #73 merged 2026-08-04 as `9b3ebb24233cd69d5961d3c1f3c1ea6d017e15ef`. Verification established mandatory PRs, zero required approvals, review-thread resolution, strict up-to-date required checks, and deletion/non-fast-forward protection.

### S004 — Session handoff normalization

Status: DONE
Dependencies: S001
Objective: Keep `SESSION_HANDOFF.md` concise, current, and mechanically aligned to the first eligible sprint or explicit `NONE` state.
Evidence: PR #80 merged 2026-08-06 as `f8179c739cdb7691de2cb3d776f9e7c5da34084f`.

### S005 — Agent contract consolidation

Status: DONE
Dependencies: S001
Objective: Keep one canonical startup flow and one canonical completion flow while repository-specific agent guidance links to those flows.
Evidence: PR #84 merged 2026-08-06 as `7d1c48376861468122347e19c41f0a007d7b5fc9`. The repository-specific autonomous maintenance contract was later strengthened by PR #177 without creating a competing startup/completion protocol.

## Phase 2 — RC1 Correctness and Lifecycle Normalization

### S006 — Lifecycle compatibility inventory

Status: DONE
Dependencies: S001
Objective: Inventory stored, API, shared-contract, UI, and portal lifecycle values for projects, estimates, proposals, contracts, invoices, and jobs.
Acceptance: authoritative compatibility matrix identifies canonical values, aliases, unsafe drift, source locations, and follow-up ownership for S007-S012.
Evidence: PR #95 merged 2026-08-10 as `5e59880aba24acbe943b03d1a34aa787cb7db801`.

### S007 — Project lifecycle normalization

Status: DONE
Dependencies: S006, S007
Objective: Normalize Project lifecycle values across persistence, APIs, shared contracts, proposal-driven Project side effects, and compatibility shims without rewriting historical rows.
Acceptance: one canonical Project lifecycle for new writes with tested compatibility reads for historical aliases and no unauthorized cross-domain lifecycle expansion.
Evidence: PR #261 merged 2026-08-21 as `e736bb6b92ce00441f2e0863ef3c4d34174571be`.

### S008 — Estimate lifecycle normalization

Status: IN_REVIEW
Dependencies: S006, S007
Objective: Normalize estimate lifecycle values and transition rules.
Acceptance: consistent stored, API, and displayed estimate states.

### S009 — Proposal lifecycle normalization

Status: PLANNED
Dependencies: S006
Objective: Normalize proposal lifecycle values and customer-facing labels.
Acceptance: proposal workflow and portal display use the same canonical contract.

### S010 — Contract lifecycle normalization

Status: PLANNED
Dependencies: S006
Objective: Normalize contract lifecycle and signing-state compatibility.
Acceptance: contract state transitions are consistent and auditable.

### S011 — Invoice lifecycle normalization

Status: PLANNED
Dependencies: S006
Objective: Normalize invoice/payment states including partial payment and overdue behavior.
Acceptance: API, UI, and reporting agree on invoice state.

### S012 — Job lifecycle normalization

Status: PLANNED
Dependencies: S006
Objective: Normalize scheduling, dispatch, field-work, completion, and invoice-readiness states.
Acceptance: permitted transitions are enforced and documented.

## Phase 3 — Settings, Brand Studio, and Document Branding

### S013 — Persist Settings Console brand assets

Status: DONE
Dependencies: none
Objective: Replace ephemeral browser blob URLs with durable organization-scoped private storage and validated asset metadata.
Acceptance: uploaded branding survives reload, remains tenant-scoped, and is served through authenticated same-organization access.
Evidence: PR #30 merged 2026-08-04 as `2d80214a99b476e9a271c04fbe8a608eb80b3883`.

### S014 — Settings and Brand Studio architecture decision

Status: BLOCKED
Dependencies: S013
Objective: Decide whether Settings branding and Brand Studio remain separate, converge, or share an adapter.
Founder decision required: YES — choose the product-facing source of truth.
Acceptance: ADR records ownership, migration, and compatibility strategy.

### S015 — Brand profile/settings adapter

Status: PLANNED
Dependencies: S014
Objective: Implement the approved compatibility boundary between Settings and Brand Studio.
Acceptance: one clear read/write source with tested migration behavior.

### S016 — Document-brand rendering integration

Status: PLANNED
Dependencies: S014
Objective: Wire approved branding into proposal, invoice, contract, and portal document rendering.
Acceptance: generated documents use persisted organization branding consistently.

### S017 — Brand asset lifecycle and cleanup

Status: PLANNED
Dependencies: S015
Objective: Prevent or clean orphaned uploads and safely replace obsolete assets.
Acceptance: abandoned/replaced assets have documented and tested cleanup behavior.

## Phase 4 — Customer Portal and Document Workflow Hardening

### S018 — Customer portal authentication hardening

Status: PLANNED
Dependencies: S007, S009, S010, S011
Objective: Verify customer access, tenant boundaries, token expiry, and fail-closed behavior.
Acceptance: portal access is tenant-safe and covered by integration tests.

### S019 — Portal proposal acceptance flow

Status: PLANNED
Dependencies: S009, S018
Objective: Harden proposal review, acceptance, rejection, and audit events.
Acceptance: complete happy-path and failure-path coverage.

### S020 — Portal contract signing flow

Status: PLANNED
Dependencies: S010, S018
Objective: Harden contract viewing, signing, decline, and signature audit history.
Acceptance: signatures and state transitions are durable and auditable.

### S021 — Portal invoice and payment presentation

Status: PLANNED
Dependencies: S011, S018
Objective: Correct invoice totals, partial-payment state, overdue state, and customer presentation.
Acceptance: portal and internal workspace agree on balances and status.

### S022 — Document rendering reliability

Status: PLANNED
Dependencies: S016, S019, S020, S021
Objective: Verify proposal, contract, and invoice rendering across representative data and branding states.
Acceptance: deterministic documents with no broken assets or unsupported state labels.

## Phase 5 — Estimating and AI Assist Hardening

### S023 — AI Estimator engine hardening

Status: DONE
Dependencies: none
Objective: Secure review-first structured apply with signed review tokens, org validation, idempotency, and transactions.
Evidence: PR #29 merged as `10ec35e`.

### S024 — AI draft-run persistence decision

Status: PLANNED
Dependencies: S023
Objective: Decide and specify whether to persist full AI draft runs, prompts, provenance, and costs.
Founder decision required: YES — retention/privacy/cost policy.
Acceptance: ADR and data contract approved.

### S025 — AI generation persistence

Status: PLANNED
Dependencies: S024
Objective: Persist approved AI generation metadata and review provenance.
Acceptance: every generation is addressable, auditable, and tenant-scoped.

### S026 — Estimate line-item ordering concurrency

Status: PLANNED
Dependencies: S023
Objective: Eliminate remaining manual/AI line-item sort-order races.
Acceptance: concurrent inserts produce deterministic order without collisions.

### S027 — Intelligent Costbook production readiness

Status: BLOCKED
Dependencies: none
Objective: Transform Costbook into a production-ready, AI-assisted estimating system grounded in live tenant APIs, supplier/regional pricing, Knowledge Runtime retrieval, and review-first AI workflows.
Allowed paths: established Costbook/pricing/supplier/Knowledge Runtime/AI Estimate Assist backend modules and routes; matching Costbook/dashboard/estimate-assist frontend surfaces; required schema/migrations/tests when explicitly reviewed; canonical Knowledge Engine Costbook exports/metadata only when required; and required owner documentation.
Forbidden paths: broad application redesign; autonomous AI database writes; direct estimate-line writes outside `EstimateEngineService`; mock/placeholder production data; unreviewed supplier ingestion; public supplier credentials; destructive Knowledge Engine cleanup; confirmed duplicate-tree deletion; unrelated lifecycle/auth/billing/deployment/CI/dependency/environment work.
Required verification: backend unit/type/build/integration/RLS coverage; frontend unit/lint/build coverage; docs tests/ownership; focused Costbook search/browse/pricing/supplier/Knowledge Runtime/AI behavior tests; and E2E coverage for representative contractor Costbook workflows before production-readiness claims.
Acceptance: user-visible Costbook surfaces use live data; category/search/filter/sort/pagination and assemblies/labor/material/equipment/regional/supplier-backed pricing are coherent; statistics and supplier-sync state are truthful; Knowledge Runtime/semantic matching extend existing architecture; AI remains review-first for writes; loading/error/empty/accessibility/responsive behavior is production-ready.
Founder decision required: NO.
Reconciled continuation: the server-side catalog pagination/search/filter/sort blocker is closed in the stacked S027 catalog-query continuation. Canonical Costbook collection routes now use the shared bounded `{items,total,nextCursor}` contract with opaque organization/query-bound cursors, deterministic ordering, allowlisted sorting, and server-side query execution; legacy typeahead search routes remain explicitly compatibility-scoped. The remaining S027 gate is authenticated rendered browser evidence at 1440/1024/768/390px, which is an environment/evidence gate, not a founder decision.
Reconciled evidence: the original 2026-08-09 and 2026-08-12 blockers are resolved—PR #94 (`ab89268...`), PR #95 (`5e59880...`), PR #96 (`7b80ec...`), hierarchy hardening via PR #151 ancestry/merge commit `c948998c1`, equipment catalog via merged PR #183, and issue #153 completed 2026-08-14. Current merged scope includes C005 hierarchy, CostItem management via PR #210, and assemblies/pricing-preview/price-history/supplier-feed work via PR #216. PR #257's readiness verification also closes the former PostgreSQL/RLS execution gate with a passing PostgreSQL-backed integration rehearsal. The dedicated evidence matrix is `docs/architecture/COSTBOOK_S027_READINESS.md`; S027 remains `BLOCKED` until the remaining browser-evidence gate is closed.

### S028 — Estimate-to-proposal workflow verification

Status: PLANNED
Dependencies: S008, S009
Objective: Verify the full estimate approval and proposal generation path.
Acceptance: totals, statuses, documents, and audit events remain consistent.

## Phase 6 — Scheduling, Dispatch, and Field Work

### S029 — Scheduling engine baseline verification

Status: DONE
Dependencies: none
Objective: Establish job scheduling and document lifecycle baseline.
Evidence: PR #20 merged.

### S030 — Dispatcher workspace end-to-end verification

Status: PLANNED
Dependencies: S012
Objective: Verify scheduled/unscheduled work, assignment, rescheduling, conflicts, and job state transitions.
Acceptance: dispatcher critical path works across UI, API, and persistence.

### S031 — Scheduling conflict rules

Status: PLANNED
Dependencies: S030
Objective: Define and enforce technician, time, duration, and overlap conflicts.
Acceptance: conflicts are deterministic, visible, and tested.

### S032 — Field technician daily workflow

Status: PLANNED
Dependencies: S012, S030
Objective: Harden technician day view, job details, status updates, notes, and completion.
Acceptance: mobile workflow supports the permitted job lifecycle.

### S033 — Ready-to-invoice handoff

Status: PLANNED
Dependencies: S011, S012, S032
Objective: Make field completion reliably produce invoice-ready work with audit evidence.
Acceptance: no silent gap between completed job and invoice preparation.

### S034 — Dispatch observability

Status: PLANNED
Dependencies: S030, S031
Objective: Add operational visibility for assignment failures, conflicts, and stale work.
Acceptance: owners can identify and diagnose dispatch issues.

## Phase 7 — Performance, Observability, and Database Reliability

### S035 — Query performance inventory

Status: PLANNED
Dependencies: S007, S008, S009, S010, S011, S012
Objective: Capture slow/high-frequency query paths and representative plans.
Acceptance: prioritized evidence-based optimization list.

### S036 — Database index hardening

Status: PLANNED
Dependencies: S027, S035
Objective: Add only verified indexes with migration and rollback evidence.
Acceptance: improved plans without excessive write/index cost.

### S037 — Application observability baseline

Status: PLANNED
Dependencies: none
Objective: Define and extend structured logs, correlation IDs, error boundaries, health/readiness signals, and operational events.
Acceptance: critical request flows are traceable without leaking secrets.
Current foundation: PR #178 merged 2026-08-12 as `834fb3433604045a46dfe377df47fa08cee499d8`, adding separate `/health` liveness and `/ready` database-readiness signals; S037 remains broader than that foundation and is not implicitly `READY`.

### S038 — Background and retry semantics

Status: PLANNED
Dependencies: S037
Objective: Standardize retries, idempotency, and failure recording for asynchronous work.
Acceptance: no duplicate side effects under retry.

### S039 — Backup and recovery verification

Status: BLOCKED
Dependencies: none
Objective: Verify backups, restore procedure, RPO/RTO expectations, and migration recovery.
Blocked by: production environment access.
Acceptance: documented restore rehearsal evidence.

## Phase 8 — Security, Tenancy, RLS, and Auditability

### S040 — Tenant boundary regression suite

Status: PLANNED
Dependencies: S007, S008, S009, S010, S011, S012
Objective: Expand cross-org denial tests across major modules.
Acceptance: every critical read/write path has tenant-boundary proof.

### S041 — RLS policy coverage audit

Status: PLANNED
Dependencies: S040
Objective: Compare schema tables, application roles, and live RLS policies for gaps.
Acceptance: no unowned table or ambiguous access path remains.

### S042 — Authentication/session hardening

Status: PLANNED
Dependencies: S018
Objective: Verify session creation, refresh, revocation, expiry, and server-action enforcement.
Acceptance: fail-closed authentication behavior across web and API.

### S043 — Security event audit trail

Status: PLANNED
Dependencies: S037, S040
Objective: Record meaningful auth, tenant, privilege, and sensitive workflow events.
Acceptance: security-relevant actions are attributable and queryable.

### S044 — Secrets and environment posture

Status: BLOCKED
Dependencies: none
Objective: Verify secret ownership, rotation, least privilege, and environment separation.
Blocked by: production environment access.
Acceptance: no tracked secrets and documented production rotation process.

## Phase 9 — Production Deployment and Operational Readiness

### S045 — Production environment inventory

Status: BLOCKED
Dependencies: none
Objective: Inventory production services, domains, environment variables, approvals, and owners.
Blocked by: live deployment access.
Acceptance: authoritative production topology and access map.

### S046 — Migration deployment gate

Status: PLANNED
Dependencies: S039, S045
Objective: Verify migration approval, ordering, rollback, and failure handling.
Acceptance: production migration runbook exercised.

### S047 — Release candidate smoke suite

Status: PLANNED
Dependencies: S022, S028, S033, S040
Objective: Automate and document founder-critical end-to-end flows.
Acceptance: repeatable RC smoke evidence for auth, customer, estimate, proposal, contract, job, invoice, and portal.

### S048 — Beta tenant onboarding

Status: PLANNED
Dependencies: S047
Objective: Prepare and execute controlled onboarding for known contractor beta users.
Founder decision required: YES — select beta tenants and rollout date.
Acceptance: onboarding checklist, support path, feedback capture, and rollback plan.

## Phase 10 — Post-RC Cleanup and Launch Stabilization

### S049 — Stale branch, PR, and worktree retirement

Status: PLANNED
Dependencies: S013
Objective: Remove stale branches/worktrees only after verifying merge, ownership, and live overlap state.
Execution condition: reverify every open PR and active worktree at promotion time; do not preserve already-merged PRs such as #30 as current blockers.
Acceptance: no misleading active branch, obsolete draft PR, or abandoned worktree remains.

### S050 — Launch stabilization and next roadmap

Status: PLANNED
Dependencies: S048, S049
Objective: Triage beta findings, stabilize launch-critical defects, and produce the next evidence-backed roadmap.
Acceptance: launch decision, known-risk register, and successor backlog approved.

## Current out-of-band authorized work

The numbered sprint queue is not the only permitted maintenance activity. Existing PRs/issues may represent directly authorized bounded work. As of the 2026-08-21 reconciliation, the S027 server-side catalog continuation has landed through PR #260 and S027 remains blocked only on authenticated rendered browser evidence. That evidence work does not occupy lifecycle-normalization scope.

The earlier 2026-08-18 cleanup resolved PR #240, #242, #243, #245, #246, #247, #249, and #250. The 2026-08-16-era list (PR #217, #225, #226, #227, #229, #230, #231) is also fully resolved: #217, #225, #226, #227, #229, and #231 merged; #230 closed unmerged. PR #237, opened to record that resolution, itself closed unmerged without landing its diff. None of those older entries remain live overlap risk.

Out-of-band work does not silently change numbered sprint status. It must still follow `AGENTS.md`, Repository Governance, CODEOWNERS routing, required CI, and protected human-decision boundaries.

## Next Eligible Sprint

Selection is determined by `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` after checking live dependencies, open PRs, worktrees, infrastructure, and founder decisions.

Sprint ID: NONE
Eligibility: S007 is `DONE` with merged evidence. S008 is `IN_REVIEW` because implementation PR #264 is open; it is not eligible for a second implementation slice until review and merge are complete.
Dependencies: S006 and S007 are `DONE`; S008 itself is `IN_REVIEW` and is not a new eligible sprint.
Overlap check: The S008 branch was created after live GitHub reconciliation; reverify the branch and open PR state before finalizing the implementation.
Startup flow: See `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow`.
