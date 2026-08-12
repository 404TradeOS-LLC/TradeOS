---
status: current
owner: platform
last_verified: 2026-08-12
source_of_truth: true
related_docs:
  - docs/architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md
  - docs/modules/cost-book.md
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/SESSION_HANDOFF.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
related_code:
  - app/modules/cost-database
  - app/modules/labor-database
  - app/modules/material-database
  - app/modules/equipment-database
  - app/modules/assemblies-database
  - app/modules/costbook
  - app/backend/routes/costDatabase.routes.ts
  - app/backend/routes/costbook.routes.ts
  - web/src/app/(app)/costbook
---

# Costbook Implementation Reconciliation

## Why this document exists

An implementation request arrived proposing a greenfield "Costbook Core CRUD"
build: a new `feature/costbook-core-crud` branch off `main`, new
`Division`/`Category`/`Subcategory`/`CostItem` models, and a `CostItem` shape
carrying flat `cost`, `markupPercentage`, and `vendor` fields.

Repository reconnaissance against live `origin/main` (commit `d21f8af`, fetched
2026-08-12) found that assumption is incorrect on every material point. This
document records what is actually true, reconciles it against the proposed
plan, states the architectural decision, and hands off a bounded next step
that fits the existing implementation instead of duplicating it. It is
documentation and planning only — no application code changed on this branch.

## 1. Current Costbook state

### Database models (`app/prisma/schema.prisma`, live on `main`)

- `Division`, `Category`, `Subcategory`, `CostItem` — the tenant-scoped
  estimating catalog hierarchy, present since before this reconciliation.
- `LaborRate`, `Material`, `Equipment`, `Assembly`, `AssemblyItem` — the
  supporting pricing-input tables `CostItem` composes.
- `CostbookWorkspace`, `CostbookWorkspaceEvent` — added by migration
  `20260811120000_add_costbook_workspace_foundation` (C001) as the new unified
  Costbook boundary described below.
- `labor_rates` gained foundational `role`, `description`, `hourlyCost`,
  `billRate`, `active` columns in place (migration
  `20260811140000_add_costbook_labor_rates_foundation`, C003) rather than a
  second labor table.
- All Costbook-relevant tables run under forced row-level security, consistent
  with the rest of the repository's tenancy model.

### Modules and services

Two coexisting layers, both real and both live:

- **Legacy catalog layer** — `app/modules/{cost-database,labor-database,
  material-database,equipment-database,assemblies-database}`. This is the
  original implementation: `Division`/`Category`/`Subcategory` creation and
  listing, full `CostItem` CRUD plus search, unit-cost computation, and
  assembly/labor/material/equipment management. Mounted at
  `/api/v1/{cost-database,labor-rates,materials,equipment,assemblies}/*`.
- **Costbook workspace layer** — `app/modules/costbook/{service,repository,
  types,permissions,errors,index}.ts`, added starting 2026-08-10 (PR #120-#128,
  labeled C001-C004). This is a bounded context that wraps the same underlying
  tables behind a single permission boundary (`costbook.read`/
  `costbook.write`/`costbook.manage`) and a unified route group at
  `/api/v1/costbook/*`. It does not replace the legacy layer; the legacy
  routes remain mounted and now share the same permission boundary for
  compatibility.

Both layers follow the same standard TradeOS flow: `Route -> Controller ->
Service -> Repository -> Prisma/PostgreSQL` under forced RLS, per
`docs/architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md`.

### API routes actually present today

Legacy catalog layer (`app/backend/routes/costDatabase.routes.ts` et al.):

```
GET    /api/v1/cost-database/divisions
POST   /api/v1/cost-database/divisions
POST   /api/v1/cost-database/categories
POST   /api/v1/cost-database/subcategories
GET    /api/v1/cost-database/subcategories/:subcategoryId/cost-items
GET    /api/v1/cost-database/cost-items/search
GET    /api/v1/cost-database/cost-items/:id
GET    /api/v1/cost-database/cost-items/:id/unit-cost
POST   /api/v1/cost-database/cost-items
PATCH  /api/v1/cost-database/cost-items/:id
DELETE /api/v1/cost-database/cost-items/:id
POST   /api/v1/cost-database/cost-items/bulk-import
```

`CostItem` already has full CRUD, search, and bulk import. `Division`,
`Category`, and `Subcategory` have only list + create — no `GET :id`, `PATCH`,
or `DELETE` exists for any of the three hierarchy levels today. This is the
one real, verified gap between the proposed plan and current reality.

Costbook workspace layer (`app/backend/routes/costbook.routes.ts`, current
through C001-C003; C004 equipment routes are in open PR #128):

```
GET    /api/v1/costbook/workspace
GET    /api/v1/costbook/materials
GET    /api/v1/costbook/materials/:id
POST   /api/v1/costbook/materials
PATCH  /api/v1/costbook/materials/:id
GET    /api/v1/costbook/labor-rates
GET    /api/v1/costbook/labor-rates/:id
POST   /api/v1/costbook/labor-rates
PATCH  /api/v1/costbook/labor-rates/:id
DELETE /api/v1/costbook/labor-rates/:id   (soft-deactivate, active=false)
```

No workspace-layer routes exist yet for `Division`, `Category`, `Subcategory`,
or `CostItem` themselves — C001-C003 covered workspace summary, materials, and
labor rates only.

### Pricing calculation flow

`CostItem` cost is **derived**, not stored as a flat field. `GET
/api/v1/cost-database/cost-items/:id/unit-cost` composes labor, material, and
equipment unit costs (via the item's `laborRateId`/`materialId`/
`equipmentId` relations) into a `UnitCostBreakdown` (`laborCostPerUnit`,
`materialCostPerUnit`, `equipmentCostPerUnit`, `totalUnitCost`). There is no
`cost`, `markupPercentage`, or `vendor` field anywhere on `CostItem` in the
live schema.

### Frontend status

`web/src/app/(app)/costbook/` exists with three live routes as of this
reconciliation: `/costbook` (workspace summary), `/costbook/materials`, and
`/costbook/labor-rates` — each with real API data, loading/error/empty
states, and permission-gated write controls. Open PR #128 adds
`/costbook/equipment`. **No hierarchy management UI exists** for Division,
Category, Subcategory, or CostItem — this is the other real, verified gap.
The owner dashboard's Costbook entry point previously carried a "Soon" badge;
that badge is now superseded by the live `/costbook` route.

## 2. Planned vs. actual comparison

| Dimension | Proposed plan assumed | Actual repository state |
|---|---|---|
| Domain existence | Greenfield — build from scratch | Live since before this reconciliation; `Division`/`Category`/`Subcategory`/`CostItem` already implemented modules |
| Branch base | New `feature/costbook-core-crud` off `main`, as if starting cold | An active, incremental build-out (C001-C004, PRs #120-#128) is already extending this exact domain from `main` |
| `CostItem` shape | Flat `cost`, `markupPercentage`, `vendor` fields | Relationship-derived cost via `LaborRate`/`Material`/`Equipment`; no flat pricing fields exist or are compatible with the derived model |
| CRUD completeness | Assumed nothing exists | `CostItem` already has full CRUD + search + bulk import; `Division`/`Category`/`Subcategory` have only list + create (real gap) |
| Frontend | Assumed nothing exists | Also assumed correctly here — no hierarchy management UI exists (real gap), though `/costbook`, `/costbook/materials`, `/costbook/labor-rates` (and soon `/costbook/equipment`) already exist for adjacent catalogs |
| Architecture pattern | Implied a new module under a suggested `app/modules/costbook/{controllers,services,repositories,validators,routes}` shape | An `app/modules/costbook/{service,repository,types,permissions,errors}` bounded context already exists and is the established current pattern (C001-C004); it wraps rather than replaces the legacy catalog modules |
| Governance | Not addressed | Further Costbook work is a tracked sprint, S027, currently recorded `BLOCKED` in `docs/SPRINT_BACKLOG.md` — see Section 4 |

## 3. Architectural decision

**The existing Costbook domain remains the authoritative pricing intelligence
model for TradeOS. Future work extends the current implementation rather than
creating parallel pricing systems.**

Specifically:

- Do not create a new `Division`/`Category`/`Subcategory`/`CostItem` domain or
  duplicate models.
- Do not introduce a flat `cost`/`markupPercentage`/`vendor` field set on
  `CostItem`. It is incompatible with the live relationship-derived
  (`LaborRate`/`Material`/`Equipment`) pricing model, which is preserved.
  `GET /cost-items/:id/unit-cost` and its `UnitCostBreakdown` contract stay as
  the source of truth for computed cost.
- Future hierarchy CRUD (Division/Category/Subcategory) and any hierarchy
  management UI extend the **existing** `app/modules/cost-database` service
  for reads/writes, exposed either directly or fronted by the
  `app/modules/costbook` workspace boundary the C-series has already
  established — not a new parallel module tree.
- The C001-C004 pattern (bounded `app/modules/costbook` context wrapping
  existing catalog tables behind `costbook.read`/`costbook.write`/
  `costbook.manage`, with the legacy `/api/v1/{cost-database,labor-rates,
  materials,equipment}/*` routes kept mounted for compatibility) is the
  current, working precedent for how new Costbook slices get added. New work
  should follow it rather than inventing a new layering convention.

## 4. Sprint governance review

Per `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`, live GitHub state is
authoritative over committed doc text, which can go stale between edits. It
did here:

- `docs/SPRINT_BACKLOG.md`'s `S027 — Intelligent Costbook production
  readiness` entry (still present verbatim on `main` as of this
  reconciliation) records: `Status: BLOCKED`, blocked by "active PR #94...
  active draft PR #95... active PR #96."
- Live GitHub state: **PR #94, #95, and #96 are all already `MERGED`**
  (`2026-08-10T03:25:50Z`, `2026-08-10T03:53:32Z`, `2026-08-10T02:37:52Z`
  respectively). The blocking condition as literally written in
  `SPRINT_BACKLOG.md` no longer holds.
- Separately, and not reflected in `docs/SESSION_HANDOFF.md` (`last_verified:
  2026-08-09`, unchanged since), a distinct C-series of Costbook PRs has been
  landing since 2026-08-10: #120 (architecture doc), #121 (C001 workspace
  foundation), #124 (C002 materials), #125 (C003 labor rates) — all merged —
  and #128 (C004 equipment) — open as of this reconciliation.
- **PR #128 itself already contains a governance update** that "clears the
  stale S027 PR-overlap claim verified against live GitHub on August 11,
  2026" and touches `docs/SPRINT_BACKLOG.md`, `docs/SESSION_HANDOFF.md`,
  `docs/CURRENT_STATE.md`, and this same architecture doc family. This
  reconciliation does not duplicate that governance edit — #128 is the
  in-flight source of truth for clearing the stale blocker text, and this
  document's scope is analysis, not sprint-record editing.

**Is Costbook work currently allowed?** As literally recorded in
`docs/SPRINT_BACKLOG.md` on `main` today, S027 still reads `BLOCKED`. As
verified against live GitHub state, the named blocking PRs are resolved and a
governance fix is already in flight in #128. Per the Next Sprint Protocol's
stop conditions ("a dependency is not `DONE` or a `READY` record is
incomplete" / "unexpected dirty work or an active PR/worktree overlaps the
mission"), a new implementation branch should not promote S027 to `READY` on
its own authority — that is exactly the kind of governance-record edit #128
is already carrying. **This document does not start implementation and does
not alter `SPRINT_BACKLOG.md` or `SESSION_HANDOFF.md`.**

Founder decision required for S027: recorded as `NO` in the current backlog
entry.

## 5. Future implementation plan

The next bounded Costbook slice is a hierarchy-management extension,
continuing the established C-series pattern rather than a standalone
"greenfield CRUD" branch. Suggested branch name:
`feature/costbook-admin-management` (or the next `C00N` slice, e.g. `C005`,
if continuing the existing numbering the founder has been using for C001-C004
— either name is compatible with the same scope described below; the
numbering choice belongs to whoever picks up the branch).

### Backend

Complete missing hierarchy management on the **existing** `Division`/
`Category`/`Subcategory` models, following the exact pattern already used for
`CostItem` in `app/modules/cost-database`:

```
GET    /divisions/:id
PATCH  /divisions/:id
DELETE /divisions/:id     (soft-deactivate, matching CostItem/LaborRate)

GET    /categories/:id
PATCH  /categories/:id
DELETE /categories/:id

GET    /subcategories/:id
PATCH  /subcategories/:id
DELETE /subcategories/:id
```

Whether these land under `/api/v1/cost-database/*` (legacy layer, matching
today's create/list routes for these three models) or get fronted by
`/api/v1/costbook/*` (matching the C001-C004 workspace convention) is an
implementation-time decision for that branch — either is consistent with
Section 3's decision as long as no new model or parallel service is created.

### Frontend

`web/src/app/(app)/costbook/` does not yet represent the hierarchy at all.
Future work adds it, following the same page-shell pattern already
established by `/costbook/materials` and `/costbook/labor-rates`: thin route
files, server-loaded authenticated data, reusable Costbook components, and
honest loading/error/empty states. The hierarchy should be represented as it
actually exists:

```
Division
  -> Category
    -> Subcategory
      -> CostItem  (composed from Labor / Material / Equipment)
```

Do not create a separate simplified pricing UI or a parallel data shape for
this. `CostItem` display/edit surfaces must use the real derived-cost model
(`UnitCostBreakdown`), not flat cost/markup/vendor fields.

## 6. Repository cleanup review

`app/.claude/skills/run-tradeos-costbook-api/` was inspected. It documents
driving a standalone "TradeOS Cost Book API" via `api/server.ts` ->
`dist/api/server.js`, a server-rendered `/admin` and `/admin/pricing-history`
UI (`api/views/adminShell.view.ts`), and `db/seed/seed.ts` reachable through
`scripts/deploy-migrations.sh`. Checked against the live `app/` tree:

- `app/api/` does not exist.
- The real build/start scripts in `app/package.json` are `tsc -p
  tsconfig.json` and `node dist/backend/start.js`, not `dist/api/server.js`.
- `app/db/seed/seed.ts` and `app/scripts/deploy-migrations.sh` do exist, so
  parts of the skill are not entirely fictional, but the `api/server.ts` /
  `api/views/adminShell.view.ts` admin-UI surface it screenshots does not
  exist anywhere in the current tree.

This skill predates the merge of the original standalone `TradeOScostbook`
project into the current `app/`/`web/` monorepo layout (consistent with
`CLAUDE.md`'s note that the prior long-form Claude session log "referenced
obsolete `app/api/**` paths" now archived to git history only) and describes
architecture that no longer exists. **Finding recorded here only — not
deleted.** Repository governance requires explicit review before removing
tooling; that decision belongs to a separate, explicitly scoped cleanup
change, not this reconciliation.

## 7. C005 merge validation summary

The `C005 — Add Costbook hierarchy management foundation` PR closed exactly
the gap Section 1 and Section 5 identified above and has merged.

**What changed:**

- `app/modules/costbook/{types,repository,service}.ts`: full CRUD
  (`list`/`get`/`create`/`update`/`deactivate`) for `Division`, `Category`,
  and `Subcategory`, following the C001-C004 bounded-context pattern rather
  than a new module. Division scopes by `orgId` directly; Category and
  Subcategory inherit organization scope through their parent join, matching
  how `CostItem` already inherits scope.
- `app/backend/{controllers,routes}/costbook.*`: new
  `GET/POST/PATCH/DELETE` routes under `/api/v1/costbook/{divisions,
  categories,subcategories}`, gated on `costbook.read`/`write`/`manage`.
- `app/backend/controllers/costDatabase.controller.ts`: the legacy
  `/api/v1/cost-database/{divisions,categories,subcategories}` create
  handlers gained an explicit `costbook.write` permission check (previously
  unguarded at the controller layer, relying solely on RLS).
- `app/prisma/schema.prisma` + migration
  `20260812120000_add_costbook_hierarchy_foundation`: adds `isActive`
  (default `true`) to `divisions`, `categories`, `subcategories`, and
  tightens `divisions_write_policy`/`categories_write_policy`/
  `subcategories_write_policy` from the generic app-wide
  `current_app_can_write()` (owner/admin/legacy-estimator) to the
  Costbook-specific `current_app_can_manage_costbook()` (owner/admin only) —
  legacy `estimator` loses direct database write access to these three
  tables.
- `web/src/app/(app)/costbook/divisions/*` and
  `web/src/components/costbook/hierarchy-catalog.tsx`: a new expandable
  Division → Category → Subcategory tree UI, linked from the Categories
  count on `/costbook`.
- `docs/{API_REFERENCE,CURRENT_STATE,DOMAIN_MODEL}.md`,
  `docs/architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md`, and
  `docs/modules/cost-book.md` updated to describe the new routes, schema
  change, and permission boundary.

**Affected TradeOS domains:** Costbook API/controllers/services/repository;
Costbook database schema and RLS policies; Costbook web workspace
(`/costbook/divisions`); legacy `cost-database` create routes. Assemblies
and supplier modules were not touched, matching Section 3's decision not to
introduce a parallel pricing system.

**Validation evidence (as reported in the merged PR description; not
independently re-run for this record):**

- `cd app && npm test` — 1581/1581 passed
- `cd app && npm run test:integration` — 74/74 passed (Docker-backed live
  Postgres, including new cross-org RLS coverage for the hierarchy tables
  and the tightened write boundary)
- `cd app && npm run lint && npm run build` — reported clean
- `cd web && npm test` — 62/62 passed
- `cd web && npm run lint && npm run build` — reported clean
  (`/costbook/divisions` present in build output)
- `npm run docs:test` — 39/39 passed
- `npm run docs:check -- --base origin/main` — reported PASS
- `git diff --check` — reported clean

No blocked or skipped checks were reported in the PR. This record does not
claim independent re-execution of the above commands, nor does it claim
production deployment or live-environment integration beyond what the PR
description states.

**Open follow-up from the PR itself:** PR #128 (C004, equipment catalog) was
still open when this branch was cut; the PR notes its migration timestamp
(`20260812120000`) sorts after C004's (`20260811150000`) with no overlap,
but flags it "worth a quick reverify if #128 lands first." That reverification
is not performed here and remains open.

## Definition of done for this document

- [x] Costbook architecture is accurately documented against live `main`
- [x] Existing implementation (legacy catalog layer + C001-C004 workspace
      layer) is recognized as source of truth
- [x] No duplicate models or parallel pricing systems are introduced or
      proposed
- [x] Sprint governance status (S027, stale `SPRINT_BACKLOG.md` blocker text,
      in-flight #128 fix) is documented
- [x] Future implementation path (`feature/costbook-admin-management` /
      next `C00N` slice) is clear and scoped to the real gaps only
- [x] Documentation checks (`npm run docs:test`, `npm run docs:check --
      base origin/main`) — run and recorded in the pull request
- [x] C005 merge validation summary recorded (Section 7) after the
      hierarchy-management PR merged
