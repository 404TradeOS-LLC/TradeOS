---
status: current
owner: platform
last_verified: 2026-08-23
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
| Estimate | `draft`, `ready`, `sent`, `viewed`, `approved`, `declined`, `expired`, `superseded` | Current lifecycle docs confirm draft-only mutation and `draft -> ready`; `rejected` is retained as a legacy synonym for `declined` | `legacyEstimateStatusMap` maps `rejected -> declined`; canonical `sent` remains `sent` | S008 closes the prior `sent -> ready` normalization contradiction. Customer delivery/review transitions beyond `draft -> ready` remain outside this bounded slice. | S008 |
| Proposal | `draft`, `generated`, `sent`, `viewed`, `accepted`, `declined`, `expired` | New proposal persistence writes `draft`, `sent`, `viewed`, `accepted`, and canonical `declined`; historical `rejected` remains accepted for compatibility. Related Project side effects write canonical `estimating` or `awarded` | Proposal `rejected -> declined`; historical Project aliases normalize separately through `legacyProjectStatusMap` | The `/reject` route remains a compatibility name, while new storage and delivery metadata use canonical `declined`. `generated` and `expired` are canonical but not part of the currently documented persisted proposal-service path. The former Project-side-effect legacy writes are resolved by S007. | S009 |
| Contract | `draft`, `sent`, `viewed`, `signed`, `voided` | `pending_signature` is the only DB-legal pre-terminal `contracts.status` value; `signed`/`voided` are already canonical. The check constraint has never accepted `draft`, `sent`, or `viewed` | PR #276 (S010, merged `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`) normalizes `pending_signature -> sent` at the `toDTO()` API boundary | `draft`/`sent`/`viewed` are canonical-but-currently-DB-illegal, not merely under-documented — writing any of them via Prisma or raw SQL fails the check constraint. S010 makes the API surface canonical without a schema migration; persisted rows remain `pending_signature` until a future founder-approved constraint change (Option B). `viewed` remains entirely unimplemented (no `viewedAt` column, delivery table, or event type). | S010 (DONE) |
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
| `sent` | estimate, proposal, contract, invoice | `sent` | Shared raw labels remain context-sensitive; domain-specific normalizers are authoritative. |
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

### Historical non-canonical writes resolved by S007

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

S008 resolves the prior contradiction: `sent` appears in `estimateStatuses` and `estimateTransitions`, and `legacyEstimateStatusMap.sent` now remains `sent`. The estimate queue accepts `sent` independently from `ready`.

## Proposal inventory — S009 input

### Canonical

`draft`, `generated`, `sent`, `viewed`, `accepted`, `declined`, `expired`.

### Current service persistence

- create -> default/current `draft`
- send/resend -> `sent`
- mark viewed -> `viewed`
- accept -> `accepted`
- reject -> canonical `declined` (the `/reject` route remains for compatibility)

### Compatibility

`rejected -> declined`.

### Project coupling

Proposal actions still advance the related Project, but S007 normalizes those side effects to the Project contract: draft creation/duplication/decline, send, and resend write `estimating`; acceptance writes `awarded`. Historical Project aliases remain readable through `legacyProjectStatusMap`. S009 closes the proposal-specific write drift by persisting canonical `declined` while retaining historical `rejected` read compatibility; future `generated`/`expired` transition work remains separate and must not reintroduce Project compatibility writes.

## Contract inventory — S010 input

### Canonical

`draft`, `sent`, `viewed`, `signed`, `voided`.

### Compatibility persistence

`pending_signature -> sent`.

The `contracts.status` check constraint (`app/prisma/migrations/20260624100000_add_proposals_invoices_contracts/migration.sql`, unchanged since table creation) accepts only `pending_signature`, `signed`, `voided`. `draft` and `viewed` are canonical but were never DB-legal or written by any code path; they are not under-documented aliases, they are simply unreachable today. PR #276 (S010, merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`; plan at `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`) implements a zero-migration DTO-boundary normalization: `toDTO()` in `app/modules/contracts/service.ts` maps stored `pending_signature` to canonical `sent` before it reaches the API response. The `contracts` table, its default, and its check constraint are unchanged; `sign()`/`void()` guards are unchanged. Making the *persisted* value canonical (Option B in the plan) requires a separate founder decision and constraint migration — it was not attempted here.

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

1. **S008 / Estimate — high:** canonical vocabulary and compatibility handling must keep `sent` distinct from internal `ready`; customer-facing delivery/review transitions remain a separate workflow scope.
2. **S009 / Proposal — done, PR #267 merged:** new rejects persist `declined`, historical `rejected` rows remain read-compatible, and Project-side effects stay canonical under S007. Generated/expired transition work remains outside the implemented path.
3. **S010 / Contract — done, PR #276 merged as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`:** `pending_signature` is the only DB-legal pre-terminal persisted value; the API surface is normalized to canonical `sent` at the DTO boundary without a schema migration.
4. **S011 / Invoice — medium:** aliases plus documented transition coverage differ from the richer shared contract.
5. **S012 / Job — medium-low vocabulary drift, high workflow importance:** canonical values are comparatively aligned, but scheduling/dispatch transition enforcement is operationally sensitive.
6. **S007 / Project — resolved in this slice for new proposal-driven writes:** historical aliases remain read-compatible; no destructive migration is performed.

## S006 conclusions

- A single canonical vocabulary already exists in shared contracts, but persistence and service behavior are not uniformly canonical.
- Historical Project aliases remain readable, while S007 stops proposal workflows from writing new Project compatibility aliases. Proposal historical `rejected` rows and Contract `pending_signature` remain compatibility values; PR #267 (merged) stops new proposal declines from creating additional `rejected` rows, and PR #276 (merged) normalizes the Contract API surface without touching the persisted value.
- Estimate normalization contains a direct internal contradiction for `sent`.
- Context-free generic normalization is unsafe for overlapping commercial lifecycle strings.
- Job vocabulary is comparatively aligned, making S012 primarily a transition/enforcement normalization exercise rather than an alias cleanup.
- S007-S012 must preserve backwards compatibility deliberately and should not combine all six domains into one migration.

This matrix began as S006 inventory evidence and is kept current as the follow-up normalization sprints land. S007 changes Project write behavior only; it does not authorize S008-S012 behavior, schema, or migration changes.
