---
status: current
owner: platform
last_verified: 2026-08-09
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

Only merged evidence may set `DONE`. Open PR overlap forces `IN_REVIEW` or `BLOCKED`. Agents execute one sprint per branch and PR.

## Phase 1 — Governance and Execution System

### S001 — TradeOS Bible foundation
Status: DONE
Dependencies: none
Objective: Establish the canonical Bible index, numbered sprint queue, and autonomous next-sprint protocol.
Allowed paths: `docs/**`, `AGENTS.md` if required.
Forbidden paths: runtime code, schema, dependencies, CI behavior.
Acceptance: draft PR exists; docs checks pass; next sprint is mechanically selectable.
Evidence: PR #31 merged 2026-07-16 as `ac72ff235db687d9cb8619820e536aec040afc6b`, branch `docs/tradeos-bible-foundation`.

### S002 — Contractor UX research and Founder Preview specification
Status: DONE
Dependencies: none
Objective: Land the verified contractor research and Founder Preview experience specification.
Allowed paths: PR #27 documentation scope only.
Forbidden paths: runtime code.
Acceptance: PR #27 merged with green checks and no source-of-truth conflicts.
Evidence: PR #27 merged on 2026-07-16 as `279bdae26e2fc1856c7cc28e6756529c0ec508e7`.

### S003 — Solo-maintainer governance calibration
Status: DONE
Dependencies: none
Objective: Document and verify the current solo-maintainer ruleset posture without changing GitHub settings.
Allowed paths: governance docs, sprint evidence, and the existing sprint-backlog selector test only.
Forbidden paths: GitHub ruleset changes, disabling PRs, required checks, force-push protection, or deletion protection.
Acceptance: `main` requires PRs, required checks, up-to-date branches, conversation resolution, and zero approvals.
Founder decision required: NO.
Evidence: PR #73 merged on 2026-08-04 as
`9b3ebb24233cd69d5961d3c1f3c1ea6d017e15ef`. Its read-only GitHub verification
confirmed active default-branch rulesets #18958081 and #19465256, mandatory
pull requests, zero required approvals, review-thread resolution, strict
up-to-date status checks, deletion and non-fast-forward protection, and the
four expected required check names. No GitHub setting changed. The merged
selector test validates the computed current backlog result instead of
permanently hard-coding S003 as `READY`.

### S004 — Session handoff normalization
Status: DONE
Dependencies: S001
Objective: Make `SESSION_HANDOFF.md` concise, current, and mechanically identify the next eligible sprint.
Allowed paths: docs and docs tests.
Acceptance: handoff ends with sprint ID, eligibility, dependencies, overlap check, and startup prompt.
Founder decision required: NO.
Readiness evidence: Verified 2026-08-06 against `main` commit `0afc6f91`:
S001 is `DONE`; PR #75 is the sole open pull request and owns only this
readiness update; every dependency PR from the prior audit is merged, closed,
or superseded, leaving no external PR overlap with S004's docs/docs-test scope;
the only other active worktree modifies `packages/knowledge-engine/**` and does
not overlap S004; no external infrastructure is required; and no founder
decision is unresolved.
Implementation evidence: `docs/s004-session-handoff` normalized the handoff's
terminal resume contract and added a mechanical docs test in PR #80, initially
published at head `0d419aa1` and later merged.
Evidence: PR #80 merged on 2026-08-06 as
`f8179c739cdb7691de2cb3d776f9e7c5da34084f`. The merged handoff is concise,
ends with the required five-field resume contract, and is mechanically checked
against the first eligible `READY` sprint or explicit `NONE` state.

### S005 — Agent contract consolidation
Status: DONE
Dependencies: S001
Objective: Remove duplicated or conflicting startup/completion rules and point all agents to the Bible and sprint protocol.
Allowed paths: `AGENTS.md`, `docs/agent-prompts/**`, governance docs.
Forbidden paths: runtime code, database schema or migrations, dependencies and lockfiles, CI/workflows, repository settings, and `packages/**`.
Required tests: `npm run docs:test`; `npm run docs:check -- --base origin/main`; `git diff --check`; and a contract-link audit confirming only `NEXT_SPRINT_PROTOCOL.md` defines the canonical startup and completion flows.
Acceptance: one canonical startup flow and one canonical completion flow.
Founder decision required: NO.
Readiness evidence: Verified 2026-08-06 against `main` commit `5efa9835`:
S001 is `DONE`; no pull requests were open before this isolated readiness
branch was created; the only other active worktree modifies
`packages/knowledge-engine/**` and does not overlap S005's `AGENTS.md`,
`docs/agent-prompts/**`, or governance-doc scope; no external infrastructure is
required; and no founder decision is unresolved. This readiness branch may own
only the governance promotion and must merge before S005 implementation starts
in a separate branch. After publication, draft PR #82 is the sole open pull
request and owns only that readiness promotion.
Readiness correction: A pre-implementation audit found that the original
promotion omitted explicit forbidden paths and named tests required by the
Bible's Definition of Ready. This governance-only correction adds those gates
without expanding S005 into `scripts/**` or runtime changes. PR #83 merged that
correction on 2026-08-06 as `ee5000b4eb62ebda1dd42d2a51572c41b98443d4`.
Implementation is isolated on `agent/s005-agent-contracts`, based on that
corrected `main`; it consolidates the contracts without adding a new test file.
Evidence: PR #84 merged on 2026-08-06 as
`7d1c48376861468122347e19c41f0a007d7b5fc9`. The protocol is now the
sole executable owner of startup and completion; supporting checklists and lane
contracts preserve their paths while linking to the canonical anchors. The
implementation passed 39/39 documentation tests, ownership validation,
`git diff --check`, the broadened contract-link audit, both required GitHub
workflows, and two independent exact-head review passes.

## Phase 2 — RC1 Correctness and Lifecycle Normalization

### S006 — Lifecycle compatibility inventory
Status: READY
Dependencies: S001
Objective: Inventory every stored, API, shared-contract, UI, and portal lifecycle value for projects, estimates, proposals, contracts, invoices, and jobs.
Allowed paths: `docs/**`, `app/domain/**`, and narrow lifecycle-inventory tests that do not change runtime behavior.
Forbidden paths: behavior changes; database schema or migrations; `app/backend/**`; `app/modules/**`; `web/src/app/**`; `web/src/components/**`; dependencies and lockfiles; CI/workflows; environment files; repository settings; and `packages/**`.
Required tests: `npm run docs:test`; `npm run docs:check -- --base origin/main`; `git diff --check`; plus any narrow lifecycle inventory/contract tests introduced by S006.
Acceptance: authoritative compatibility matrix identifies canonical values, aliases, and unsafe drift for projects, estimates, proposals, contracts, invoices, and jobs, with source locations and follow-up ownership for S007-S012.
Founder decision required: NO.
Readiness evidence: Verified 2026-08-08 against `main` commit `477fb2e919d4001772628c6a91fcded07555ba74`: S001 is `DONE`; the live GitHub check found zero open pull requests before this readiness branch was published; the founder separately identified concurrent UI-sprint work being handled by Claude, so S006 is explicitly fenced away from `web/src/app/**` and `web/src/components/**` and may inspect those files read-only only; repository search confirms lifecycle values are distributed across shared contracts, backend/controller surfaces, UI, portal-facing code, current lifecycle docs, and legacy lifecycle references; no external infrastructure is required; and no founder decision is unresolved. This governance-only branch owns only the readiness promotion and continuity update and must merge before S006 implementation begins on a separate branch.

### S007 — Project lifecycle normalization
Status: PLANNED
Dependencies: S006
Objective: Normalize project lifecycle values across persistence, APIs, contracts, UI, and portal compatibility shims.
Acceptance: one canonical project lifecycle with tested compatibility behavior.

### S008 — Estimate lifecycle normalization
Status: PLANNED
Dependencies: S006
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
Status: IN_REVIEW
Dependencies: none
Objective: Replace ephemeral blob URLs with durable public-bucket storage URLs and strict asset-key validation.
Acceptance: PR #30 merged with all checks green and public-bucket limitation documented.
Evidence: PR #30.

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
Objective: Transform the placeholder-facing Costbook experience into a production-ready, AI-powered estimating system grounded in live backend APIs, tenant costbook data, supplier pricing, regional pricing, Knowledge Runtime retrieval, and review-first AI assistant workflows.
Allowed paths: `app/modules/cost-database/**`, `app/modules/labor-database/**`, `app/modules/material-database/**`, `app/modules/equipment-database/**`, `app/modules/assemblies-database/**`, `app/modules/supplier-database/**`, `app/modules/supplier-integration/**`, `app/modules/knowledge-runtime/**`, `app/modules/ai-estimate-assist/**`, `app/backend/routes/*cost*`, `app/backend/routes/*labor*`, `app/backend/routes/*material*`, `app/backend/routes/*equipment*`, `app/backend/routes/*assembl*`, `app/backend/routes/*supplier*`, `app/backend/routes/knowledgeRuntime.routes.ts`, `app/backend/routes/aiEstimateAssist.routes.ts`, matching backend controllers where routes already use controller seams, `app/prisma/schema.prisma`, `app/prisma/migrations/**`, `app/tests/**`, `web/src/app/(app)/dashboard/**`, `web/src/app/(app)/costbook/**`, `web/src/app/(app)/projects/[id]/estimates/[estimateId]/assist/**`, `web/src/components/dashboard/**`, `web/src/components/estimate-assist/**`, new narrowly named `web/src/components/costbook/**`, `web/src/lib/api.ts`, `web/src/lib/clientApi.ts`, `packages/knowledge-engine/exports/json/costbook.json`, canonical package metadata under `packages/knowledge-engine/{README.md,PATHS.md,path-manifest.json}` only if Knowledge Engine source paths change, and required owner docs.
Forbidden paths: broad application redesign; autonomous AI database writes; direct estimate-line writes outside `EstimateEngineService`; mock or placeholder production data; unreviewed supplier ingestion; public/signed supplier credentials; destructive `packages/knowledge-engine/**` cleanup; confirmed duplicate-tree deletion; unrelated lifecycle normalization; unrelated settings, branding, portal, dispatch, auth, billing, deployment, workflow, dependency, lockfile, CI, environment, repository-settings, and marketing changes.
Required tests: `cd app && npm test`; `cd app && npm run test:integration`; `cd app && npm run lint`; `cd app && npm run build`; `cd web && npm test`; `cd web && npm run lint`; `cd web && npm run build`; `npm run docs:test`; `npm run docs:check -- --base origin/main`; `git diff --check`; plus focused backend service/controller tests for category browsing, pagination, filtering, sorting, full-text search, semantic search, assemblies, labor, materials, equipment, regional pricing, supplier pricing, statistics, Knowledge Runtime integration, and AI assistant tool behavior; focused frontend tests for dashboard Costbook wiring, Costbook loading skeletons, filters, pagination, and empty/error states; and E2E coverage for searching, browsing, selecting an item or assembly, and asking the assistant for drywall labor, flooring pricing, and cheaper alternatives.
Acceptance: dashboard Costbook entry links to live Costbook APIs; no user-visible Costbook surface depends on mock data; users can browse categories and search/filter/sort/paginate assemblies, labor, material, equipment, regional, and supplier-backed pricing records; statistics expose total assemblies, total items, last pricing update, and supplier sync status; Knowledge Runtime search and semantic matching are integrated without creating a parallel AI architecture; AI assistant answers the required contractor prompts through validated, read-only retrieval/tool seams and keeps estimate writes review-first; loading states, optimistic interactions, caching, responsive layouts, accessibility, and regression coverage are complete; docs and source-of-truth records describe the production behavior accurately.
Founder decision required: NO.
Blocked by: active PR #94 overlaps dashboard UI and shared frontend surfaces required by S027; active PR #96 overlaps Knowledge Runtime packaging and production Costbook data availability; active draft PR #95 owns S006 implementation evidence; S006 remains the lowest-numbered `READY` sprint until completed or otherwise governed.
Readiness evidence: Verified 2026-08-09 against `main` commit `378c12e86410f4e9150953dd9d677c1701a3812d`: S023 is `DONE`, preserving review-first AI estimator hardening; existing module docs confirm live cost book modules, supplier queue plumbing, Knowledge Runtime, and AI Estimate Assist seams exist and should be extended rather than rebuilt; live GitHub state shows PR #94 modifies `web/src/app/(app)/dashboard/**`, `web/src/components/dashboard/**`, shared frontend API/helpers, `docs/CURRENT_STATE.md`, and `docs/SESSION_HANDOFF.md`; PR #96 modifies `app/modules/knowledge-runtime/loader.ts` and `app/vercel.json`; PR #95 modifies S006 implementation documentation; no external infrastructure is required for readiness, but implementation must reverify local database, `psql`, Docker, and any supplier-feed credentials before claiming integration completion. This governance record intentionally keeps S027 `BLOCKED` until the named overlap clears, then it may be promoted to `READY` in a separate governance-only update.
Coordination plan: use the requested parallel subagent lanes only after S027 becomes `READY` and an isolated implementation branch exists. Backend owns APIs, search, pricing, and supplier integration; frontend owns dashboard Costbook entry, Costbook pages, filters, responsive layouts, skeletons, and caching; AI owns semantic search, Knowledge Runtime wiring, and assistant tool behavior; verification owns unit, integration, E2E, docs, regression, and final production-check evidence. The coordinator integrates all lanes, resolves conflicts, and verifies the combined tree directly before PR publication.

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
Objective: Define structured logs, correlation IDs, error boundaries, and operational events.
Acceptance: critical request flows are traceable without leaking secrets.

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
Objective: Automate and document the founder-critical end-to-end flows.
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
Objective: Remove stale branches/worktrees only after verifying merge and ownership state.
Blocked by: active RC PRs still open (PR #30 / S013, and any other open PR at execution time).
Acceptance: no misleading active branch or obsolete draft PR remains.

### S050 — Launch stabilization and next roadmap
Status: PLANNED
Dependencies: S048, S049
Objective: Triage beta findings, stabilize launch-critical defects, and produce the next evidence-backed roadmap.
Acceptance: launch decision, known-risk register, and successor backlog approved.

## Next Eligible Sprint

Selection is determined by `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` after
checking live PRs, worktrees, and dependencies. S005 is `DONE` with merge
evidence from PR #84. S006 is the lowest-numbered `READY` sprint; its S001
dependency is `DONE`, its implementation is explicitly fenced away from the
parallel UI sprint's runtime paths, and no external infrastructure or founder
decision blocks it. Draft PR #95 is the current S006 implementation evidence.
S027 has a complete Intelligent Costbook readiness contract, but remains
`BLOCKED` by active PR #94 dashboard/UI overlap, PR #96 Knowledge Runtime
packaging overlap, and the currently eligible S006 queue position.
