---
status: current
owner: platform
last_verified: 2026-08-23
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
Dependencies: S006
Objective: Normalize Project lifecycle values across persistence, APIs, shared contracts, proposal-driven Project side effects, and compatibility shims without rewriting historical rows.
Acceptance: one canonical Project lifecycle for new writes with tested compatibility reads for historical aliases and no unauthorized cross-domain lifecycle expansion.
Evidence: PR #261 merged 2026-08-21 as `e736bb6b92ce00441f2e0863ef3c4d34174571be`.

### S008 — Estimate lifecycle normalization

Status: DONE
Dependencies: S006, S007
Objective: Normalize estimate lifecycle values and transition rules.
Acceptance: consistent stored, API, and displayed estimate states.
Evidence: PR #264 merged 2026-08-22 as `dee5f98f0b46e98782b887fca80a63e55800cd65`.

### S009 — Proposal lifecycle normalization

Status: DONE
Dependencies: S006
Objective: Normalize proposal lifecycle values and customer-facing labels.
Acceptance: proposal workflow and portal display use the same canonical contract.
Evidence: PR #267 merged 2026-08-22 as `de266975a1c6eca742331530f4a53281fe9a6652`. New declines persist `declined`, historical `rejected` rows remain read-compatible, and the compatibility `/reject` route emits `proposal.declined`. S007's merged Project-side-effect normalization is preserved as a dependency boundary. The additive Proposal status-constraint migration preserves historical rows; no destructive rewrite, permission change, or infrastructure dependency was introduced. `generated`/`expired` mutation paths remain outside this slice.

### S010 — Contract lifecycle normalization

Status: DONE
Dependencies: S006
Objective: Normalize contract lifecycle and signing-state compatibility.
Acceptance: contract state transitions are consistent and auditable.
Evidence: PR #276 merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`. Implements the bounded Option A slice from `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`: `toDTO()` in `app/modules/contracts/service.ts` normalizes stored `pending_signature` to canonical `sent` using the existing `normalizeContractStatus` helper. No schema migration, default change, or `sign()`/`void()` guard change was made; persisted status remains `pending_signature`. Option B (canonical database persistence) remains a separate founder decision and migration, not attempted here. Three pre-existing runtime defects found during the audit (`void()` non-idempotency, missing transaction boundaries around status+event writes, missing optimistic-concurrency guards) are explicitly out of scope and remain unfixed as separate follow-up.

### S011 — Invoice lifecycle normalization

Status: DONE
Dependencies: S006
Objective: Normalize backend payment reconciliation and invoice follow-up classification while keeping partial-payment and overdue presentation derived.
Acceptance: eligible sent invoices and existing raw overdue invoices reconcile to persisted `paid` when recorded payments fully cover the total; concurrent final payments are serialized; payment/status/audit writes remain transactionally coherent; persisted `paid` and `voided` invoices are excluded from unpaid, partially-paid, and overdue follow-up queues; partial and new overdue states remain derived; no payment-entry UI expansion is included.
Evidence: PR #283 merged 2026-08-24 as `6ca838d39d170fe520e16141e6e5213188f6d5f8`. This completion-evidence reconciliation records the shipped behavior and verification.
Readiness contract: Founder-approved decisions record that overdue remains derived, partially-paid remains derived, payment-entry UI expansion is deferred, and S011 owns backend payment reconciliation correctness. The shipped implementation is limited to per-invoice concurrent-payment serialization, cent-safe aggregation of valid recorded payments, eligible `sent -> paid` reconciliation including existing raw overdue compatibility, existing request-scoped transaction/event behavior, service-boundary `billing.write` enforcement, and paid/terminal follow-up exclusions. No persisted partial/overdue/viewed state, payment UI, schema migration, or billing/portal redesign was introduced.
Forbidden in S011: persisted `partially_paid`, a new persisted-overdue writer, `viewed` tracking, payment-entry UI, billing/payment-processor or portal redesign, unrelated Invoice idempotency/optimistic-concurrency repairs, schema migration unless separately re-approved as unavoidable, and S012 work.
Required implementation validation: focused Invoice/payment and queue tests; concurrent PostgreSQL/RLS integration; `git diff --check`; `npm run pr:preflight -- --base origin/main`; `npm run pr:test`; `npm run docs:test`; `npm run docs:check -- --base origin/main`; `cd app && npm test`; `cd app && npm run lint`; `cd app && npm run build`; and `cd app && npm run test:integration`.

### S012 — Job lifecycle normalization

Status: DONE
Dependencies: S006
Objective: Normalize scheduling, dispatch, field-work, completion, and invoice-readiness states.
Acceptance: permitted transitions are enforced and documented.
Readiness contract: The authorized S012 implementation is the bounded backend normalization of the existing canonical Job transition graph across scheduling/rescheduling, dispatch, travel, arrival, pause/resume, completion, cancellation, owner/admin reopen, and completed-only invoice readiness. It must preserve current schedule/conflict validation, assignment and role boundaries, organization scoping, forced RLS, activity/audit attribution, required canonical-event behavior, completion/readiness metadata invariants, and the existing request-scoped transaction architecture. Preserve the live service rule that only `on_site` may transition to `completed`; the current `WORKFLOW_LIFECYCLES.md`/S006 wording that also lists `traveling|paused -> completed` is documented drift to resolve, not authorization to expand behavior. Dispatch attention remains derived; persisted Job statuses remain the current eight canonical values.
Evidence: PR #286 merged 2026-08-24 as `403d84cb6187b59cf468802977a19fbc847ce314`. Separate completion-evidence reconciliation records the shipped implementation and verification.
Implementation status: `DONE`; the implementation centralizes the existing transition table in `app/modules/jobs/lifecycle.ts`, preserves the live `on_site -> completed` rule, adds focused transition/service/RLS coverage, and corrects the stale workflow/matrix/API/RBAC documentation. No schema, RBAC/RLS policy, UI, billing, or later-sprint changes shipped.
Implementation evidence must cover every permitted and rejected transition, schedule/conflict behavior, role/assignment boundaries, cancellation/reopen metadata, completion and invoice-readiness gating, activity/event behavior, derived dispatch classifications, and PostgreSQL/RLS tenant isolation. Required validation: `git diff --check`; `npm run pr:preflight -- --base origin/main`; `npm run pr:test`; `npm run docs:test`; `npm run docs:check -- --base origin/main`; and `(cd app && npm test && npm run lint && npm run build && npm run test:integration)`.
Forbidden in S012: new Job statuses or aliases, schema migration, generic status patching, Dispatcher Workspace/route-optimization/GPS/notification redesign, automatic invoice creation, billing/payment changes, Project-to-Job orchestration redesign, unrelated optimistic-concurrency/idempotency repairs, RBAC/RLS policy changes, S018/S021/S027/S030/S032 work, and any other numbered sprint. See `docs/architecture/S012_JOB_LIFECYCLE_PLAN.md`.

## Phase 3 — Settings, Brand Studio, and Document Branding

### S013 — Persist Settings Console brand assets

Status: DONE
Dependencies: none
Objective: Replace ephemeral browser blob URLs with durable organization-scoped private storage and validated asset metadata.
Acceptance: uploaded branding survives reload, remains tenant-scoped, and is served through authenticated same-organization access.
Evidence: PR #30 merged 2026-08-04 as `2d80214a99b476e9a271c04fbe8a608eb80b3883`.

### S014 — Settings and Brand Studio architecture decision

Status: DONE
Dependencies: S013
Objective: Decide whether Settings branding and Brand Studio remain separate, converge, or share an adapter.
Founder decision: Accepted — Brand Studio is the canonical organization-brand source; Settings remains a compatibility and administration surface through the Brand Studio-owned adapter.
Acceptance: ADR-006 records ownership, migration-safe compatibility, fallback behavior, and explicit non-goals.
Evidence: Founder-decision reconciliation PR #301 merged on 2026-08-24; ADR-006 is the accepted S014 decision record.

### S015 — Brand profile/settings adapter

Status: DONE
Dependencies: S014
Objective: Implement the approved compatibility boundary between Settings and Brand Studio.
Acceptance: one clear read/write source with tested migration behavior.
Readiness contract: Brand Studio is the canonical organization-brand source. Settings remains the compatibility/admin surface and preserves its existing route shape while branding fields are resolved from or written through the canonical BrandProfile/BrandDocumentSettings records. Legacy OrganizationSettings JSON and organization shell values are adopted lazily and non-destructively; unrelated operational Settings fields remain in OrganizationSettings. No schema migration, destructive rewrite, new asset model, payment/billing change, public marketing theming, auth/customer identity change, permission widening, RBAC/RLS redesign, or document-rendering work is authorized. See `docs/architecture/S015_BRAND_PROFILE_SETTINGS_ADAPTER_PLAN.md`.
Founder-decision boundary: S014's ADR-006 is accepted. Stop if implementation requires a new source of truth, new identity or authorization policy, destructive migration, new storage model, or public branding policy.
Required evidence: canonical-over-legacy precedence, lazy legacy adoption, explicit clear behavior, mapped Settings round trips, existing organization-shell compatibility, repeated-save safety, same-org/cross-org authorization, forced PostgreSQL RLS, and focused app/web regression coverage.
Readiness evidence: S014 is DONE through founder-decision record #301 and ADR-006; the S015 contract is explicit on the readiness branch/PR; no competing S015 implementation PR, branch, or worktree was found at readiness creation.
Implementation evidence: PR #310 merged on 2026-08-24 at `b6ec078b7bf5e5e45537ed113990c2f2d317c126` from `feature/s015-implementation`; exact-head implementation commit was `4fa0e40333210cdacd30a34972a252badfe9f988`.
Completion evidence: `docs/architecture/S015_COMPLETION_EVIDENCE.md` records the shipped behavior, tests, authorization/RLS and integration evidence, non-goals, and deferred work; this governance-only branch supplies the completion-evidence PR.
Evidence: Implementation PR #310 merged 2026-08-24 as `b6ec078b7bf5e5e45537ed113990c2f2d317c126`; completion evidence is supplied by this governance-only PR.

### S016 — Document-brand rendering integration

Status: DONE
Dependencies: S014
Objective: Wire approved branding into proposal, invoice, contract, and portal document rendering.
Acceptance: generated documents use persisted organization branding consistently.
Readiness contract: S014 is DONE through governance record #301 and ADR-006; S015 is DONE through implementation record #310 and completion evidence #312. S016 consumes canonical BrandProfile/BrandDocumentSettings through the existing document frame and PDF generator seams, preserving route shapes, lifecycle semantics, authenticated organization context, safe escaping, binary responses, and deterministic fallbacks. No new source of truth, public branding policy, schema/migration, storage model, asset lifecycle, RBAC/RLS redesign, billing/payment semantic change, document identity/legal claim, or broad UI redesign is authorized. See `docs/architecture/S016_DOCUMENT_BRAND_RENDERING_PLAN.md`.
Founder-decision boundary: Stop if implementation requires a new document renderer, public/unauthenticated branding policy, new identity/legal signature claim, destructive migration, new storage architecture, or changed authorization policy.
Required evidence: canonical branding reaches supported proposal/invoice/contract/portal documents; missing-brand fallback is deterministic; HTML/assets remain safe; same-org and cross-org access evidence passes where applicable; existing route/content-type/lifecycle contracts remain unchanged; focused App/Web/document and PostgreSQL/RLS evidence passes.
Implementation status: DONE after implementation PR #314 merged on 2026-08-24 as `e1618db5926134d4cc6ec9b4c05fd754f4b2ca2b` from `feature/s016-implementation`; exact implementation head was `26304048985020ea8f49f701550112b2f6932d0f`.
Completion evidence: `docs/architecture/S016_COMPLETION_EVIDENCE.md` records shipped behavior, local and exact-head CI verification, security boundaries, review disposition, non-goals, and deferred external evidence.
Evidence: Implementation PR #314 merged as `e1618db5926134d4cc6ec9b4c05fd754f4b2ca2b`; Verify repository #1408, Docs consistency #1335, Dependency review #354, PR branch currency #82, Live documentation reconciliation #64, and Sprint governance #63 passed for the merged head.

### S017 — Brand asset lifecycle and cleanup

Status: DONE
Dependencies: S015, S016
Objective: Prevent or clean orphaned uploads and safely replace obsolete assets.
Acceptance: abandoned/replaced assets have documented and tested cleanup behavior.
Readiness evidence: S015 and S016 are DONE with merged implementation and completion evidence; no S017 implementation PR, branch, worktree, or overlapping storage/Brand Studio change exists in live GitHub state; S017 is the lowest-numbered planned candidate after S016.
Readiness contract: S017 owns the existing organization-scoped Settings brand-upload lifecycle. It preserves upload-new-then-record-current semantics, cleans failed-upload orphans conservatively, makes explicit removal idempotent, and adds a dry-run-capable reconciliation path for stale generated objects under exact private organization/key prefixes. Current metadata remains the source of truth; arbitrary BrandAsset URLs are not deletable storage ownership evidence. See docs/architecture/S017_BRAND_ASSET_LIFECYCLE_PLAN.md.
Founder-decision boundary: Stop if implementation requires a new retention policy with customer-facing consequences, schema/history migration, new scheduler/background-job architecture, third-party storage change, production credential/configuration change, public bucket, arbitrary URL deletion, or irreversible deletion without a recoverable dry-run/review boundary.
Required evidence: replacement and remove failure paths are tested; stale generated objects are dry-run/reconciled without touching current or recent objects; malformed paths, unsupported keys, cross-org access, unauthorized roles, and secret leakage fail closed; existing private asset proxy, Settings/Brand Studio behavior, forced RLS, and document-rendering consumers remain intact.
Allowed implementation surface: existing Settings asset action/helpers, a small server-only cleanup/reconciliation helper, focused Web tests, existing API helpers, and required owner documentation. No product implementation is included in this readiness branch.
Evidence: Implementation PR #317 merged as `4b02c8257d7934a4e18d304ce9bdd8ba51878645`; corrective PR #319 merged as `8ebb1a84302eafcab529f3db2f93c63000a76ffe`; separate completion evidence is recorded in [S017_COMPLETION_EVIDENCE.md](architecture/S017_COMPLETION_EVIDENCE.md).

## Phase 4 — Customer Portal and Document Workflow Hardening

### S018 — Customer portal authentication hardening

Status: DONE
Dependencies: S007, S009, S010, S011
Objective: Verify customer access, tenant boundaries, token expiry, and fail-closed behavior.
Acceptance: portal access is tenant-safe and covered by integration tests.
Evidence: Implementation PR #290 merged on 2026-08-24 as `6f2dd254c121855fa629d19da6bc0452cc9e6de7`; completion-evidence PR #292 records the shipped outcome and exact-head verification.
Readiness evidence: S007, S009, S010, and S011 are `DONE`. The current portal uses the existing authenticated Supabase session and protected bearer-authenticated API/RLS boundary and does not have a separate customer token or identity model. See `docs/architecture/S018_CUSTOMER_PORTAL_AUTHENTICATION_PLAN.md`.
Readiness contract: Harden and prove the existing portal boundary for invalid/expired/revoked sessions, missing or inactive memberships, organization-scoped project/proposal/contract/invoice/document access, existing portal mutation permissions, and forced PostgreSQL RLS. Preserve the current server-side bearer-token architecture, request-scoped database session, route/API shapes, actor attribution, and audit behavior unless a separately approved decision authorizes a change.
Founder-decision boundary: No new customer identity/login/invitation model, public tokenized document links, auth-provider replacement, or RBAC/RLS policy redesign is authorized by this readiness promotion. Stop for a founder decision if tenant-safe customer access requires a new authentication or authorization policy.
Forbidden in S018: portal redesign, S019 proposal workflow, S020 contract signing workflow, S021 invoice/payment presentation, S022 document rendering, S027 Costbook work, unrelated security/deployment repair, schema migration, new token persistence, or any other numbered sprint. No schema migration is expected; stop and report if one is unavoidable.
Required implementation validation: focused auth/session/portal authorization tests; same-organization and cross-organization resource tests; invalid/expired/revoked/missing-membership failures; live PostgreSQL/RLS integration; `git diff --check`; `npm run pr:preflight -- --base origin/main`; `npm run pr:test`; `npm run docs:test`; `npm run docs:check -- --base origin/main`; `(cd app && npm test && npm run lint && npm run build && npm run test:integration)`; and applicable web test/lint/build lanes.

### S019 — Portal proposal acceptance flow

Status: DONE
Dependencies: S009, S018
Objective: Harden proposal review, acceptance, rejection, and audit events.
Acceptance: complete happy-path and failure-path coverage.
Evidence: Implementation PR #296 merged on 2026-08-24 as `9291ccd58624326b1bb142d47d50f97f85b413e3`; this separate completion-evidence reconciliation records the shipped outcome.
Readiness evidence: S009 and S018 are `DONE` with merged implementation and completion evidence. The existing portal proposal page, server-side session-token fetching, proposal API routes, service-layer organization scoping, existing mutation permissions, project side effects, and proposal delivery events were revalidated against current `origin/main`. No competing S019 implementation lane existed; implementation PR #296 was the sole S019 implementation lane after governance-only readiness promotion PR #295.
Readiness contract: Harden and prove the existing authenticated portal proposal review, viewed, acceptance, decline, and audit/event boundary. Preserve the existing Supabase session, protected bearer API, server-derived organization context, request-scoped database session, forced PostgreSQL RLS, route/API shapes, actor/org attribution, proposal delivery events, project side effects, and current permissions. The current read-then-unconditional-update mutation pattern is a known concurrency-risk baseline; S019 must reproduce competing view/accept/decline requests and repair the race with an atomic conditional transition or equivalent serialization inside the existing transaction architecture. Add behavioral evidence for malformed/invalid/expired sessions, missing/inactive membership, same-organization access, cross-organization denial, invalid lifecycle transitions, mutation authorization, concurrent transition integrity, and forced-RLS tenant isolation. See `docs/architecture/S019_PORTAL_PROPOSAL_ACCEPTANCE_PLAN.md`.
Implementation status: `DONE` after implementation PR #296 merged on 2026-08-24 as `9291ccd58624326b1bb142d47d50f97f85b413e3`. The implementation adds organization-scoped conditional transition writes, fail-closed competing mutations, preserved event/project side effects, and bounded portal pending/error/decline controls. Separate completion-evidence reconciliation records the shipped outcome.
Founder-decision boundary: Do not invent a customer identity, public link, portal token, customer-specific permission, new authorization policy, auth-provider change, RBAC/RLS redesign, schema migration, or legal-signature policy. If intended customer self-service acceptance requires any of those changes, stop and prepare a founder-decision packet.
Forbidden in S019: new customer login/invitation or magic-link product, public unauthenticated proposal links, token persistence, Supabase replacement, permission widening, contract signing, invoice/payment behavior, document rendering, portal redesign, S020/S021/S022/S027 work, or any other numbered sprint.
Completed validation: exact-head Verify repository #1358 passed app unit/typecheck/build/integration and PostgreSQL/RLS migration rehearsal, web unit/lint/build, Athena contracts/smoke, and dependency audits; Docs consistency #1267, Dependency review #317, PR branch currency #36, Live documentation reconciliation #32, and Sprint governance #31 passed. The implementation also passed `git diff --check` and the canonical backlog selector tests before merge.

### S020 — Portal contract signing flow

Status: READY
Dependencies: S010, S018
Objective: Harden contract viewing, signing, decline, and signature audit history.
Acceptance: signatures and state transitions are durable and auditable.
Readiness boundary: The existing flow is an authenticated internal `documents.manage` mutation that captures a client-supplied typed name/drawn signature, server timestamp, request IP, and contract event. It does not establish customer identity, identity verification, or immutable signed-document evidence. ADR-007 resolves the founder-approved meaning for S020 as bounded authenticated in-app contract acceptance/signature evidence; do not invent stronger legal-signature semantics or a new auth model.
Founder decision: Accepted through ADR-007 — S020 remains authenticated in-app contract acceptance/signature evidence and must not claim certificate-backed, identity-verified, notarized, or standalone legal e-signature semantics. S020 readiness may now be prepared, subject to the canonical selector.
Readiness evidence: S010 and S018 are DONE with merged implementation and completion evidence; ADR-007 resolves the founder/legal boundary; no open S020 implementation or readiness overlap exists. See [S020_PORTAL_CONTRACT_SIGNING_PLAN.md](architecture/S020_PORTAL_CONTRACT_SIGNING_PLAN.md).
Required implementation validation: focused contract service/controller tests; same-organization, cross-organization, unauthorized-role, malformed-ID, and unauthenticated denial evidence; PostgreSQL/RLS and concurrent transition coverage; typecheck/lint/build; `git diff --check`; `npm run pr:preflight -- --base origin/main`; `npm run pr:test`; `npm run docs:test`; `npm run docs:check -- --base origin/main`; and applicable App/Web suites.

### S021 — Portal invoice and payment presentation

Status: DONE
Dependencies: S011, S018
Objective: Correct invoice totals, partial-payment state, overdue state, and customer presentation.
Acceptance: portal and internal workspace agree on balances and status.
Readiness evidence: S011 and S018 are DONE with merged implementation and completion evidence. Existing invoice amount, recorded Payment aggregation, derived balance/partial/overdue semantics, organization-scoped portal reads, `billing.read`, request-scoped sessions, and forced PostgreSQL RLS were revalidated on origin/main. At the readiness-promotion snapshot, no open/draft S021 PR, remote S021 implementation/readiness branch, or competing worktree existed; implementation PR #299 was the sole S021 lane. S020 remains independently planned and is not a dependency of S021; its founder/legal boundary is now resolved by ADR-007.
Readiness contract: S021 is presentation-centric. It may prove and harden existing portal display of authoritative invoice amount, paid amount, balance due, due date, payment history, paid/unpaid/partially-paid/overdue/voided state, and bounded loading/error states. Preserve the current Invoice and Payment source of truth, recorded-payment filtering, billing permissions, server-derived organization context, request-scoped database session, forced RLS, route/API shapes, and audit behavior. See `docs/architecture/S021_PORTAL_INVOICE_PRESENTATION_PLAN.md`.
Implementation status: `DONE` after implementation PR #299 merged on 2026-08-24 as `514c94900263744ac8cf498c6b06da336e097512`. The bounded implementation adds server-derived paid/balance projections, sanitized recorded-payment history, billing-read authorization on invoice reads, and customer portal invoice presentation. Separate completion-evidence PR #300 records the exact shipped behavior and validation.
Evidence: Implementation PR #299 merged; completion-evidence PR #300 records the shipped result and exact-head validation.
Founder-decision boundary: Stop if implementation requires a new payment processor, checkout or public payment link, ledger or payment status, refund/reversal semantics, billing policy, customer identity/authorization model, schema migration, or RLS/RBAC redesign.
Forbidden in S021: payment processing, payment-entry architecture, new money movement, payment-provider integration, persisted partial-payment or overdue writers, billing redesign, contract signing, document rendering redesign, S022/S024/S027 work, or any other numbered sprint.
Required implementation validation: same-organization/cross-organization invoice and payment/RLS tests; authoritative balance and no-duplication tests for paid, unpaid, partial, overdue, and voided cases; portal loading/error/empty-state coverage; `git diff --check`; `npm run pr:preflight -- --base origin/main`; `npm run pr:test`; `npm run docs:test`; `npm run docs:check -- --base origin/main`; `(cd app && npm test && npm run lint && npm run build && npm run test:integration)`; and applicable web test/lint/build lanes.

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

Status: DONE
Dependencies: S023
Objective: Decide and specify whether to persist full AI draft runs, prompts, provenance, and costs.
Founder decision: Accepted through ADR-008 — metadata-first retention, no raw prompt/output/tool content by default, 90-day operational metadata retention, tenant/actor isolation, data minimization, and reversible organization usage ceilings.
Acceptance: ADR-008 records the approved retention/privacy/cost data contract and explicit non-goals.
Evidence: Founder-decision reconciliation PR #301 merged on 2026-08-24; ADR-008 is the accepted S024 decision and data-contract record.

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

## Active Sprint and Next Eligibility

Selection is determined by `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` after checking live dependencies, open PRs, worktrees, infrastructure, and founder decisions.

Active Sprint: S020
Completion status: S017 is `DONE` after implementation PR #317 and corrective PR #319 merged; completion evidence is recorded in [S017_COMPLETION_EVIDENCE.md](architecture/S017_COMPLETION_EVIDENCE.md). S020 is promoted `READY` through this governance-only contract; no implementation lane is active.
Dependencies: S010 and S018 are DONE; ADR-007 resolves S020's legal-signature boundary. S022 remains ordered behind S020; S027 remains environment-evidence blocked.
Protected boundary: Exactly one numbered implementation lane may exist. This branch is governance-only; create only one isolated S020 implementation lane after this promotion merges and live eligibility is reconfirmed.

## Next Eligible Sprint

Sprint ID: S020
Eligibility: S020 is READY through this governance-only promotion; implementation remains unstarted until this PR merges and live eligibility is reconfirmed.
Dependencies: S010 and S018 are DONE; ADR-007 resolves the founder/legal boundary; no S020 overlap is present.
Overlap check: No S020 implementation PR or branch exists; this branch changes governance/readiness documentation only and S022 remains read-only.
Startup prompt: After this readiness PR merges, refresh origin/main, run the canonical selector and live overlap checks, then create one isolated feature/s020-implementation lane; do not implement S022 concurrently.
