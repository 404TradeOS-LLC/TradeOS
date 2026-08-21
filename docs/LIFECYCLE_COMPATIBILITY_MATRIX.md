---
status: current
owner: platform
last_verified: 2026-08-08
source_of_truth: true
related_code:
  - app/domain/contracts.ts
  - app/prisma/schema.prisma
  - app/modules/estimate-engine/service.ts
  - app/modules/proposals/service.ts
  - app/modules/contracts/service.ts
  - app/modules/invoices/service.ts
  - app/modules/jobs/service.ts
  - app/backend/controllers/projects.controller.ts
  - web/src/lib/api.ts
  - web/src/components/shared/status-badge.tsx
related_docs:
  - docs/WORKFLOW_LIFECYCLES.md
  - docs/DOMAIN_MODEL.md
  - docs/decisions/ADR-003-document-lifecycle-compatibility.md
  - docs/SPRINT_BACKLOG.md
---

# S006 Lifecycle Compatibility Matrix

## Purpose

This is the S006 inventory of lifecycle values currently represented across persistence, services/API behavior, shared contracts, frontend/portal consumers, and compatibility documentation. It is evidence for S007-S012; it does **not** authorize behavior or schema changes.

The six lifecycle families in scope are projects, estimates, proposals, contracts, invoices, and jobs.

## Evidence rules

- **Canonical** means the value declared by `app/domain/contracts.ts` and current lifecycle documentation.
- **Persisted/runtime** means values written, defaulted, or explicitly accepted by current service/schema behavior.
- **Alias** means a value that exists for compatibility but is not the target canonical vocabulary.
- **Unsafe drift** means the same business state has conflicting stored/API/display semantics, or generic normalization can produce a misleading result.
- UI files are evidence only for S006. This sprint does not modify `web/src/app/**` or `web/src/components/**`.

## Executive matrix

| Domain | Canonical values | Observed persisted/runtime values and aliases | Compatibility behavior | Unsafe drift | Follow-up |
|---|---|---|---|---|---|
| Project | `lead`, `estimating`, `awarded`, `active`, `on_hold`, `completed`, `archived` | Current/legacy values include `opportunity`, `estimate`, `site_visit`, `proposal`, `proposal_draft`, `proposal_sent`, `proposed`, `accepted`, `contract`, `won`, `active_job`, `field_execution`, `in_production`, `change_orders`, `closeout`, `complete`, `warranty`, `lost` | `legacyProjectStatusMap` folds aliases into the seven canonical project states; new proposal-driven project writes use canonical `estimating` or `awarded` | Existing stored aliases remain readable through DTO normalization. S007 removes the active proposal-service writes of `proposal_draft`, `proposal_sent`, and `accepted`; generic fallback still maps unknown project strings to `lead` for compatibility. | S007 |
| Estimate | `draft`, `ready`, `sent`, `viewed`, `approved`, `declined`, `expired`, `superseded` | Current lifecycle docs confirm draft-only mutation and `draft -> ready`; `rejected` is retained as a legacy synonym for `declined` | `legacyEstimateStatusMap` maps `rejected -> declined` | **Critical contract inconsistency:** `sent` is itself canonical but `legacyEstimateStatusMap` maps `sent -> ready`. Therefore `normalizeEstimateStatus("sent")` returns `ready`, contradicting the canonical enum and transition table. | S008 |
| Proposal | `draft`, `generated`, `sent`, `viewed`, `accepted`, `declined`, `expired` | Service writes `draft`, `sent`, `viewed`, `accepted`, `rejected`; project side effects write `proposal_draft`, `proposal_sent`, `accepted` to the related Project | Proposal `rejected -> declined`; project aliases normalize separately | Storage/service uses `rejected` while canonical vocabulary uses `declined`; `generated` and `expired` are canonical but not part of the currently documented persisted service path. Related Project state is advanced with legacy values rather than project canonical values. | S009 plus project side-effect cleanup coordinated with S007 |
| Contract | `draft`, `sent`, `viewed`, `signed`, `voided` | Current persistence/service compatibility uses `pending_signature` for the pre-signature phase; schema/docs identify `pending_signature` as an active stored value/default | `pending_signature -> sent` for canonical display | Stored contract state and canonical state differ by design. The compatibility layer must remain until persistence is deliberately migrated. `draft`/`viewed` are canonical contract states but current service documentation centers the `pending_signature -> signed|voided` path. | S010 |
| Invoice | `draft`, `sent`, `viewed`, `partially_paid`, `paid`, `overdue`, `voided` | Legacy values include `void` and `cancelled`; current enforced service transitions documented as `draft -> sent`, `sent|overdue -> paid`, and non-paid -> voided | `void -> voided`, `cancelled -> voided` | Canonical contract contains richer `viewed` and `partially_paid` states than the currently documented enforced transition path. Compatibility aliases remain accepted/displayable. Unknown invoice values fall back to `draft`. | S011 |
| Job | `unscheduled`, `scheduled`, `dispatched`, `traveling`, `on_site`, `paused`, `completed`, `cancelled` | Current job service/docs use the canonical vocabulary directly for scheduling/dispatch/field work. Reopen allows completed back to `unscheduled|scheduled`. | No job legacy map is currently defined in `app/domain/contracts.ts` | Job lifecycle is the least alias-heavy of the six, but its transition semantics are not represented by the same generic compatibility-map pattern as the commercial documents. `cancelled` is globally terminal while privileged reopen applies only to `completed`. | S012 |

## Cross-cutting collision: generic display normalization

`normalizeDisplayStatus(status)` is context-free and checks maps in this order:

1. project
2. estimate
3. proposal
4. contract
5. invoice

That ordering is unsafe for status strings shared by multiple domains.

### Confirmed collisions

| Input | Intended domain examples | Current generic result | Why |
|---|---|---|---|
| `sent` | estimate, proposal, contract, invoice | `ready` | Project has no `sent`; estimate map matches first and currently maps `sent -> ready`, so proposal/contract/invoice `sent` can also be mislabeled if routed through the generic helper. |
| `accepted` | proposal | `awarded` | Project compatibility map matches `accepted` before proposal compatibility map. |
| `draft` | estimate, proposal, contract, invoice | `draft` | Result text is coincidentally correct, but the estimate map claims ownership first; domain meaning is lost. |
| `viewed` | estimate, proposal, contract, invoice | `viewed` | Result text is coincidentally shared; context is still absent. |
| `expired` | estimate/proposal | `expired` | Same label, but domain ownership is ambiguous. |

The current shared frontend `StatusBadge` does **not** call `normalizeDisplayStatus`; it displays raw/normalized strings and explicitly labels selected aliases such as `pending_signature`, `proposal_draft`, and `proposal_sent`. That avoids this particular helper collision in the shared badge, but it also demonstrates that frontend presentation still knows about legacy persistence values.

**Normalization rule for S007-S012:** domain-specific normalizers must be preferred over the generic context-free helper wherever lifecycle semantics matter. Any removal or semantic change to the generic helper is implementation work, not S006 work.

## Project inventory — S007 input

### Canonical

`lead -> estimating -> awarded -> active -> completed`, with `on_hold` and `archived` compatibility paths as declared by the shared transition contract.

### Alias groups

- `lead`: `lead`, `opportunity`
- `estimating`: `estimate`, `estimating`, `site_visit`, `proposal`, `proposal_draft`, `proposal_sent`, `proposed`
- `awarded`: `accepted`, `awarded`, `contract`, `won`
- `active`: `active`, `active_job`, `field_execution`, `in_production`, `change_orders`, `closeout`
- `on_hold`: `on_hold`
- `completed`: `completed`, `complete`, `warranty`
- `archived`: `archived`, `lost`

### Confirmed runtime writes outside canonical vocabulary

Before S007, `app/modules/proposals/service.ts` wrote:

- proposal creation/duplication/rejection side effect -> Project `proposal_draft`
- proposal send/resend side effect -> Project `proposal_sent`
- proposal acceptance side effect -> Project `accepted`

S007 changes these side effects to canonical project writes:

- proposal creation/duplication/rejection -> `estimating`
- proposal send/resend -> `estimating`
- proposal acceptance -> `awarded`

Existing persisted aliases remain readable through `legacyProjectStatusMap`; this slice does not perform a destructive data migration.

## Estimate inventory — S008 input

### Canonical

`draft`, `ready`, `sent`, `viewed`, `approved`, `declined`, `expired`, `superseded`.

### Compatibility

- `rejected -> declined`
- current service documentation enforces `draft -> ready`
- draft-only mutations are blocked after leaving `draft`

### Unsafe drift

`sent` appears in `estimateStatuses` and in `estimateTransitions`, but `legacyEstimateStatusMap.sent` is `ready`. This is internally contradictory and must be resolved explicitly in S008 rather than silently preserved.

## Proposal inventory — S009 input

### Canonical

`draft`, `generated`, `sent`, `viewed`, `accepted`, `declined`, `expired`.

### Current service persistence

- create -> default/current `draft`
- send/resend -> `sent`
- mark viewed -> `viewed`
- accept -> `accepted`
- reject -> `rejected`

### Compatibility

`rejected -> declined`.

### Project coupling

Proposal actions also mutate Project.status using `proposal_draft`, `proposal_sent`, or `accepted`. S009 must not normalize those side effects independently of S007's project contract.

## Contract inventory — S010 input

### Canonical

`draft`, `sent`, `viewed`, `signed`, `voided`.

### Compatibility persistence

`pending_signature -> sent`.

Current lifecycle documentation states the database defaults to `pending_signature` and service transitions operate around `pending_signature -> signed|voided`. This is a storage/canonical split, not merely a stale label.

## Invoice inventory — S011 input

### Canonical

`draft`, `sent`, `viewed`, `partially_paid`, `paid`, `overdue`, `voided`.

### Aliases

- `void -> voided`
- `cancelled -> voided`

### Drift to resolve

The shared transition contract describes `viewed` and `partially_paid`, while current workflow documentation lists a narrower set of enforced service transitions. S011 must determine which transitions are implemented, derived, or aspirational before changing persistence.

## Job inventory — S012 input

### Canonical/current

`unscheduled`, `scheduled`, `dispatched`, `traveling`, `on_site`, `paused`, `completed`, `cancelled`.

Current documented transitions:

- create without schedule -> `unscheduled`
- create with schedule -> `scheduled`
- `scheduled -> dispatched -> traveling -> on_site`
- `on_site -> paused -> on_site`
- `traveling|on_site|paused -> completed`
- `scheduled|dispatched|paused -> cancelled`
- owner/admin reopen: `completed -> unscheduled|scheduled`

`needs attention` in Dispatch is derived and is **not** a persisted lifecycle state.

## Risk ranking for normalization work

1. **S008 / Estimate — high:** canonical `sent` currently normalizes to `ready`.
2. **S007 / Project — high:** active service code writes multiple legacy project statuses and downstream workflows depend on them.
3. **S009 / Proposal — high:** `rejected` storage differs from canonical `declined`, and proposal actions directly write project compatibility states.
4. **S010 / Contract — medium-high:** `pending_signature` is an active persisted compatibility state rather than a cosmetic alias.
5. **S011 / Invoice — medium:** aliases plus documented transition coverage differ from the richer shared contract.
6. **S012 / Job — medium-low vocabulary drift, high workflow importance:** canonical values are comparatively aligned, but scheduling/dispatch transition enforcement is operationally sensitive.

## S006 conclusions

- A single canonical vocabulary already exists in shared contracts, but persistence and service behavior are not uniformly canonical.
- Project, proposal, and contract compatibility values are still actively written; they cannot be removed as dead aliases.
- Estimate normalization contains a direct internal contradiction for `sent`.
- Context-free generic normalization is unsafe for overlapping commercial lifecycle strings.
- Job vocabulary is comparatively aligned, making S012 primarily a transition/enforcement normalization exercise rather than an alias cleanup.
- S007-S012 must preserve backwards compatibility deliberately and should not combine all six domains into one migration.

S006 records these facts only. No lifecycle behavior, persistence, API response, schema, transition, or UI behavior is changed by this inventory.
