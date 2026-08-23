---
status: current
owner: platform
last_verified: 2026-08-23
source_of_truth: true
related_code:
  - AGENTS.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/CURRENT_STATE.md
  - docs/ROADMAP.md
  - docs/SPRINT_BACKLOG.md
  - docs/SESSION_HANDOFF.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# TradeOS Bible

The TradeOS Bible is the canonical doctrine and operating index for TradeOS. It preserves why the company exists, what the product must become, how it is engineered, how work is executed, how the business grows, how founder decisions are made, and how all knowledge remains connected.

The Bible does not replace live implementation evidence or detailed supporting records. It binds them into one governed knowledge system for the founder, Claude, Codex, and future contributors.

## Operating Rule

After repository identity and worktree state are verified, every engineering or
product session starts its source-of-truth review here. The executable order is
owned by the canonical startup flow in
`docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`.

When an eligible `READY` sprint exists, the agent selects and executes it through `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`. The founder should not need to reconstruct a custom implementation prompt. If no numbered sprint is `READY`, the correct computed state is `Sprint ID: NONE`; agents must advance or repair already-authorized work, resolve blockers, or prepare a governance-only readiness promotion rather than inventing feature scope.

S005 completed the original operating-contract consolidation in PR #84, merged on
2026-08-06 as `7d1c48376861468122347e19c41f0a007d7b5fc9`. The Next Sprint
Protocol remains the sole executable owner of startup and completion; supporting
documents may define doctrine, lifecycle policy, or scoped additions only. The
repository-specific autonomous maintenance contract was strengthened later in PR #177, merged 2026-08-12 as `25ce0817b8a87a068348496fca12bd32230bfaf9`, without changing that source-of-truth hierarchy.

S006 — Lifecycle compatibility inventory is complete. PR #95 merged on
2026-08-10 as `5e59880aba24acbe943b03d1a34aa787cb7db801`, preserving an
authoritative compatibility inventory for the later S007-S012 normalization
sprints. Completion of S006 does not automatically promote any of those
`PLANNED` sprints to `READY`.

S007 — Project lifecycle normalization is complete. PR #261 merged on 2026-08-21 as `e736bb6b92ce00441f2e0863ef3c4d34174571be`, normalizing proposal-driven Project writes to the canonical lifecycle while retaining compatibility reads for historical aliases and avoiding destructive historical rewrites. S008 estimate lifecycle normalization is also complete: PR #264 merged on 2026-08-22 as `dee5f98f0b46e98782b887fca80a63e55800cd65`. S009 proposal lifecycle normalization is also complete: PR #267 merged on 2026-08-22 — new declines persist canonical `declined`, historical `rejected` rows remain compatible, and S007 Project side effects are preserved. S010 contract lifecycle normalization is complete: PR #276 merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`. `toDTO()` in `app/modules/contracts/service.ts` returns canonical `sent` in place of stored `pending_signature`, without a Contract schema migration or `sign()`/`void()` guard change — see `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`.

S011 invoice lifecycle normalization is now `READY` through a separate governance-only readiness promotion. The approved bounded implementation owns backend payment reconciliation correctness: serialize concurrent reconciliation per Invoice, aggregate valid recorded payments with cent-safe semantics, transition eligible fully covered `sent` invoices to persisted `paid` inside the existing request-scoped transaction/event boundary, and exclude persisted terminal invoices from unpaid/partially-paid/overdue follow-up queues. Overdue and partially-paid remain derived; payment-entry UI expansion is deferred; persisted `partially_paid`, a new persisted-overdue writer, `viewed` tracking, billing/payment-processor or portal redesign, unrelated Invoice mutation repairs, and S012 remain out of scope. The implementation branch must start only from refreshed `origin/main` after this readiness promotion merges.

S027 — Intelligent Costbook production readiness retains its founder-requested
readiness contract in the Sprint Backlog. Its original blockers PR #94, #95,
and #96 have merged. Its later-cited overlap, PR #128 (C004 equipment catalog
foundation) and PR #151 (Costbook hierarchy RLS/parent activity hardening), is
also resolved (#151 merged, #128 closed unmerged and superseded by merged PR #183).
Substantial further Costbook work has also merged through PR #183, PR #210, and
PR #216. PR #257 is the bounded dedicated readiness pass that reconciles that
current scope; it does not itself promote S027 to `READY`.

The dedicated S027 readiness pass is complete. PR #257 records a bounded supplier price-proposal concurrency repair: approval and rejection use an atomic, organization-scoped pending claim inside the existing transaction before Material/audit mutation. Only the successful claimant proceeds; a competing reviewer fails closed, and downstream failure restores `pending`. Supplier feeds remain review-first with no automatic Material pricing mutation, and the repair changes neither Costbook architecture nor permissions. PostgreSQL-backed integration verification closes the former RLS execution gate. PR #260 has now merged the standardized server-side catalog pagination/search/filter/sort contract. S027 remains `PARTIAL/BLOCKED` only until authenticated rendered Costbook browser evidence is captured. Re-read live GitHub state before any later promotion.

## Volume I — Vision

Canonical doctrine: `docs/bible/VOLUME_1_VISION.md`

Defines the mission, target contractor, product thesis, customer outcomes, market position, design laws, AI philosophy, and decision filters.

Supporting evidence includes:

- `docs/PRODUCT_SCOPE.md`
- `docs/product/TRADEOS_OWNER_EXPERIENCE.md`
- `docs/product/TRADEOS_UX_ADVANTAGES.md`
- `docs/product/FOUNDER_PREVIEW_EXPERIENCE_SPEC.md`
- `docs/research/CONTRACTOR_UX_RESEARCH.md`

## Volume II — Product

Canonical doctrine: `docs/bible/VOLUME_2_PRODUCT.md`

Defines roles, product domains, workflows, screen families, lifecycle expectations, AI behavior, permissions, mobile and accessibility principles, and product quality gates.

Detailed implementation truth remains in:

- `docs/CURRENT_STATE.md`
- `docs/DOMAIN_MODEL.md`
- `docs/WORKFLOW_LIFECYCLES.md`
- `docs/RBAC_MATRIX.md`
- `docs/modules/`

## Volume III — Engineering

Canonical doctrine: `docs/bible/VOLUME_3_ENGINEERING.md`

Defines architecture principles, tenancy, security, API and service boundaries, testing, deployment, observability, migration discipline, and engineering standards.

Detailed technical references remain in:

- `docs/ARCHITECTURE.md`
- `docs/API_REFERENCE.md`
- `docs/REPOSITORY_GOVERNANCE.md`
- `docs/DOC_OWNERSHIP.yml`
- `docs/decisions/`

Accepted ADRs remain active supporting references unless explicitly marked superseded, deprecated, or rejected.

## Volume IV — Execution

Canonical doctrine: `docs/bible/VOLUME_4_EXECUTION.md`

Defines how TradeOS work is selected, isolated, validated, reviewed, merged, released, handed off, recovered, and coordinated across people and AI agents.

Live execution state remains in:

- `docs/ENGINEERING_COMMAND_CENTER.md`
- `docs/ROADMAP.md`
- `docs/SPRINT_BACKLOG.md`
- `docs/SESSION_HANDOFF.md`
- `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`

The Next Sprint Protocol owns the sole executable startup and completion flows.
The legacy-named startup and completion checklists remain compatibility links,
not independent contracts.

## Volume V — Business

Canonical doctrine: `docs/bible/VOLUME_5_BUSINESS.md`

Defines market position, ideal customer, competitive differentiation, proposed pricing and packaging principles, sales, onboarding, migration, support, beta, launch, unit-economics frameworks, business risks, and founder decisions.

Research evidence must remain separate from doctrine. Final pricing, packaging, launch dates, revenue, CAC, LTV, and customer counts must not be presented as settled unless verified and approved.

## Volume VI — Founder

Canonical doctrine: `docs/bible/VOLUME_6_FOUNDER.md`

Preserves founder mission, ten-year intent, non-negotiables, trade-off rules, culture, decision boundaries, lessons, launch philosophy, manifesto, and reusable decision templates.

Founder decisions that block work must also be recorded in the affected sprint and, where architectural, in `docs/decisions/`.

## Volume VII — Knowledge Runtime

Canonical doctrine: `docs/bible/VOLUME_7_KNOWLEDGE_RUNTIME.md`

Defines how doctrine, implementation truth, research, decisions, current state, sprints, pull requests, merge evidence, and handoffs connect without duplication.

The Knowledge Runtime is review-first and read-only by default. It may retrieve, compare, trace, and recommend. It must not silently rewrite source-of-truth documents, runtime code, sprint status, or founder decisions.

## Source-of-Truth Layers

1. Bible volumes — doctrine, intent, standards, and decision boundaries.
2. `docs/CURRENT_STATE.md` — verified implementation truth now.
3. `docs/SPRINT_BACKLOG.md` — executable work queue and completion evidence.
4. `docs/ROADMAP.md` — strategic sequence and milestones.
5. `docs/ENGINEERING_COMMAND_CENTER.md` — current operating overview.
6. `docs/SESSION_HANDOFF.md` — immediate session continuity only.
7. Architecture, API, domain, RBAC, lifecycle, module, and deployment docs — detailed implementation contracts.
8. ADRs — decision rationale and status.
9. Research — supporting evidence, not product truth by itself.
10. Archive — superseded history, never current guidance.

## Conflict Rule

When two documents conflict, the agent must stop and identify which truth layer owns the subject. It must verify live repository and merged-PR evidence, correct the stale owner, and preserve unique historical evidence instead of guessing or duplicating the conclusion elsewhere.

## Maintenance Contract

- One subject has one canonical owner.
- Supporting documents link to the canonical owner instead of redefining it.
- The Next Sprint Protocol owns one universal startup flow and one universal
  completion flow; lane contracts may add requirements but may not restate or
  weaken those flows.
- One sprint runs per branch and pull request.
- Only merged evidence may mark a sprint `DONE`.
- Completing a sprint does not implicitly promote a `PLANNED` sprint to
  `READY`; readiness must be explicit in the backlog after dependency and
  overlap checks.
- A readiness promotion records scope, forbidden paths, named validation,
  dependency, pull-request, worktree, infrastructure, and founder-decision
  state so the next selection is evidence-backed rather than implied.
- Readiness promotion is a governance-only change that lands before the
  implementation branch; an implementation branch may not authorize its own
  sprint.
- Open PR overlap blocks a sprint from `READY` status.
- Every completed sprint updates its evidence and the session handoff.
- The session handoff ends with one mechanical resume contract containing
  `Sprint ID`, `Eligibility`, `Dependencies`, `Overlap check`, and `Startup
  prompt`; `Sprint ID: NONE` is explicit when no sprint is eligible, and the
  docs suite verifies the field order and computed sprint ID.
- Live external controls such as GitHub rulesets must be verified read-only
  before being described as current; their detailed evidence belongs in
  `docs/REPOSITORY_GOVERNANCE.md`.
- A zero-approval solo-maintainer posture must not weaken pull-request,
  required-check, up-to-date-branch, conversation-resolution, deletion, or
  non-fast-forward protections.
- Broad roadmap priorities do not override the numbered sprint queue.
- Agents may not invent replacement architecture when an existing source-of-truth contract applies.
- Destructive documentation consolidation requires an audit, preservation plan, and founder approval.
