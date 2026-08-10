---
status: draft
owner: platform
last_verified: 2026-08-10
source_of_truth: true
related_docs:
  - ../README.md
  - ../roadmap.md
  - ../09-security/README.md
  - ../12-testing/README.md
  - ../contracts/README.md
  - ../14-adrs/ADR-006-permission-enforcement-outside-llm.md
  - A1-ai-kernel-implementation-plan.md
  - A2-tool-registry-implementation-plan.md
  - A3-context-engine-implementation-plan.md
  - ../../TRADEOS_BIBLE.md
  - ../../ARCHITECTURE.md
  - ../../RBAC_MATRIX.md
---

# A4 Permission Policy Implementation Plan

Milestone: A4 - Permissions
Purpose: build the deterministic, non-LLM permission adapter described in
`docs/athena/09-security/README.md`'s "Permission Enforcement Path" -
mapping actor/role/capability/risk/resource-scope to a C007
`AthenaPermissionDecision` around the existing TradeOS RBAC (`app/domain/contracts.ts`)
and object-scope precedent (`JobsService`/`jobs_select_policy` RLS) - and close
the one real gap A2 left open: a tool's declared risk was computed but never
used to gate dispatch.
Implementation posture: backend-only, dark by default, no new autonomous
execution (A6's action engine does not exist yet), contract-test-gated.

## A3 Acceptance Summary

A4 planning starts from a verified-complete A3. `feat(athena): add A3 context
engine` (PR #108, folding in the plan originally proposed as PR #107) is
merged to `main`. Scope: two first-party providers (`knowledgeEngine`,
`dispatch`), no live kernel HTTP wiring, all other C001 sections explicitly
deferred.

The HIGH-P3 object-scope prerequisite named in A1/A2/A3 remains open and
directly bounds A4's scope: `invoices`, `proposals`, and `contracts` RLS
policies remain org-scoped only, with no assignment/ownership check. `Job`
(via `JobsService`/`scopedJobAccessWhere()`/`jobs_select_policy`) is still the
only entity with a real object-scope precedent. A4 does not resolve HIGH-P3
and does not invent new object-scope precedent for any other entity.

## A4 Scope

In scope:

- `app/modules/athena-permissions/`: a new module producing C007-shaped
  `AthenaPermissionDecision` values from `{role, capability request}`,
  reusing `app/domain/contracts.ts` (`getRolePermissions`, `normalizeRole`)
  as the sole RBAC source - no parallel permission list.
- Risk-based approval classification for `kind: "tool"` capability requests:
  `low` risk allows; `medium`/`high` risk returns `approval_required`
  (per C005's "high-risk actions require approval ID before running" -
  approval-gated, not a permanent block).
- Job object-scope resolution: elevated roles (`owner`/`admin`/`dispatcher`)
  get org-wide `member` scope; `technician` scope is only ever proven by a
  real `JobsService.getById()` call, whose failure (RLS-filtered/out of
  scope) is treated as `relationship: "none"` and denied.
- Closing the tool-registry dispatch gap: `athena-tool-registry/policy.ts`'s
  `evaluateAthenaToolPolicy` now returns `approval_required` for a
  permission-granted but non-low-risk tool, and
  `athena-tool-registry/dispatcher.ts` routes that outcome through the same
  byte-identical not-found-shaped public error already used for permission
  denials - preserving the deliberate tool-enumeration-hiding property
  (`docs/athena/roadmap/A2-tool-registry-implementation-plan.md`
  "Registry-enumeration risk"). Only the internal audit `reasonCode`
  distinguishes `authorization_denied` from `approval_required`.

Out of scope (deferred):

- Any object-scope resolution beyond `Job` - blocked on HIGH-P3.
- Wiring this module into `athena-kernel`'s live `policy_check` state or any
  HTTP path - A1's kernel never calls a tool, so it has no risk-gating gap
  to close; rewiring its intent-driven policy stage is A5 (planner) work.
- Real approval execution/routing for `approval_required` decisions - that
  is A6 (action engine). Today `approval_required` and `deny` both mean
  "does not execute."
- Any new autonomous write path - forbidden until A4 and A6 are both
  complete per the roadmap's sequencing rules.

## Contracts

`AthenaPermissionDecision` (C007, `docs/athena/contracts/README.md`) is
implemented verbatim in `app/modules/athena-permissions/types.ts`:
`version`, `orgId`, `userId`, `role`, `permissions`, `capability`,
`resourceScope?: {entityType, entityId, relationship}`, `deniedFields`,
`decision: "allow"|"deny"|"approval_required"`, `reasonCode`. A generalized
`AthenaCapabilityRequest` type is new - not part of C007 itself, but the
request shape `evaluateAthenaPermission()` accepts. It is a discriminated
union, not one interface with an optional `risk?` field: an initial review
finding on this PR correctly flagged that an optional risk field let a
`kind: "tool"` request omit risk entirely, silently defaulting to "low" and
bypassing approval classification. `AthenaToolCapabilityRequest` (`kind:
"tool"`) now requires `risk`; `AthenaNonToolCapabilityRequest` (the other
three kinds) has no risk field at all. `policy.ts` additionally fails closed
at runtime for a caller that bypasses the type system (deserialized/untyped
input) rather than defaulting a missing/invalid risk to "low".
`resourceRequest.entityType` is a closed 1-value union (`"job"`), so
extending object-scope to a new entity is a visible type change, never a
silent runtime fallthrough to a wider grant.

## Backend Seams

- `app/modules/athena-permissions/policy.ts` - `evaluateAthenaPermission()`,
  the canonical adapter. Async (unlike the three sibling `policy.ts` files)
  because job-scope resolution requires a real `JobsService.getById()` call.
- `app/modules/athena-permissions/resourceScope.ts` -
  `resolveJobResourceScope()`, delegates to `JobsService` rather than
  re-implementing RLS/scoping logic, mirroring
  `athena-context-engine/providers/dispatchProvider.ts`'s own rationale for
  not adding its own actor filter.
- `app/modules/athena-permissions/resultValidation.ts` -
  `assertValidAthenaPermissionDecision()`, the C007 runtime shape validator.
- `athena-kernel/policy.ts`, `athena-context-engine/policy.ts`: unchanged.
  The A3 context-engine policy comment anticipated this module as "a third
  consumer" before sharing logic; A4 does not retroactively rewrite either
  sibling, since neither has a risk or object-scope gap of its own to close
  right now.

## Test Requirements

- Role/permission matrix across all four canonical roles for both a
  universally-held permission and one only elevated roles hold.
- Risk-tier classification: `low` → allow, `medium`/`high` → approval_required,
  with permission denial always short-circuiting before risk is evaluated.
- Job object-scope: elevated role gets `member` with zero `JobsService`
  calls; technician gets `assignee` when `JobsService.getById()` succeeds and
  denied `none` when it throws.
- C007 contract validator: accepts conforming decisions (with and without
  `resourceScope`), rejects missing/undocumented keys, non-canonical roles,
  and unknown decision/relationship values.
- Static import-boundary test: no direct `db/client`, `db/requestSession`,
  or `@prisma/client` imports under `app/modules/athena-permissions/**`
  (`JobsService` import is the sanctioned exception, same carve-out as A3's
  provider modules).
- Dispatcher regression coverage: a medium/high-risk, permission-granted
  fixture tool is blocked with `audit.reasonCode === "approval_required"`
  and never calls `execute()`; the public error shape is byte-identical to
  an unknown-tool and a permission-denied response; a low-risk tool still
  dispatches successfully (no existing test set `risk` above `"low"`, so
  this closes a real, previously-untested gap rather than only adding new
  coverage).

## Exit Criteria

Unauthorized tool never executes: a tool a role lacks permission for is
denied; a tool with sufficient permission but medium/high risk requires
approval and does not execute, since no A6 approval executor exists to
route it to yet. Rollback: if this classification needs to be reverted,
`athena-tool-registry/policy.ts`'s risk branch can be removed to restore A2's
prior always-allow-if-permitted behavior without touching the new
`athena-permissions` module, which ships unwired from any live path.
