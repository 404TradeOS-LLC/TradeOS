---
status: current
owner: platform
last_verified: 2026-08-04
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

Every engineering or product session starts here, then reads the linked current-state, roadmap, sprint, governance, architecture, and handoff documents required by its mission before editing code or documentation.

When an eligible `READY` sprint exists, the agent selects and executes it through `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`. The founder should not need to reconstruct a custom implementation prompt.

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
- `docs/agent-prompts/AGENT_STARTUP_CHECKLIST.md`
- `docs/agent-prompts/AGENT_COMPLETION_CHECKLIST.md`

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
- One sprint runs per branch and pull request.
- Only merged evidence may mark a sprint `DONE`.
- Completing a sprint does not implicitly promote a `PLANNED` sprint to
  `READY`; readiness must be explicit in the backlog after dependency and
  overlap checks.
- A readiness promotion records the checked dependency, pull-request,
  worktree, infrastructure, and founder-decision state so the next selection
  is evidence-backed rather than implied.
- Open PR overlap blocks a sprint from `READY` status.
- Every completed sprint updates its evidence and the session handoff.
- The session handoff ends with one mechanical resume contract containing
  `Sprint ID`, `Eligibility`, `Dependencies`, `Overlap check`, and `Startup
  prompt`; `Sprint ID: NONE` is explicit when no sprint is eligible.
- Live external controls such as GitHub rulesets must be verified read-only
  before being described as current; their detailed evidence belongs in
  `docs/REPOSITORY_GOVERNANCE.md`.
- A zero-approval solo-maintainer posture must not weaken pull-request,
  required-check, up-to-date-branch, conversation-resolution, deletion, or
  non-fast-forward protections.
- Broad roadmap priorities do not override the numbered sprint queue.
- Agents may not invent replacement architecture when an existing source-of-truth contract applies.
- Destructive documentation consolidation requires an audit, preservation plan, and founder approval.
