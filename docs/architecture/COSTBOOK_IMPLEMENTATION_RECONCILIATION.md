---
status: current
owner: platform
last_verified: 2026-10-02
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

## 2026-10-06 — cross-supplier canonicalization reconciliation

Current supplier workbooks are internally normalized but do not share one canonical-key vocabulary. Source keys are therefore provenance, not identity. This slice keeps the existing `SupplierProduct.canonicalMaterialKey` persistence field and adds a TradeOS-owned code crosswalk rather than introducing a second catalog table or a migration.

The first governed family covers SPF precut studs and normalizes known Lowe's, Menards, Home Depot, and Niehaus source-key shapes into stable TradeOS identities such as `LUMBER.SPF.STUD.2X4.92_5_8IN`. Nominal size, exact length, and conflicting species/treatment are hard compatibility gates. Unknown source vocabularies stay unlinked for cross-supplier comparison.

Both pricing paths now apply that boundary. The static Terre Haute supplier-price helper groups suppliers only through the TradeOS crosswalk. The database-backed PriceResolver normalizes governed aliases before reading tenant-scoped supplier observations and includes reviewed legacy aliases in the bounded lookup so pre-existing rows remain usable. Ungoverned exact-key lookups remain backward-compatible only when all eligible evidence belongs to one supplier; if the same ungoverned key spans suppliers, resolution fails closed. SPF-stud-shaped identities outside the governed registry are rejected rather than falling through to that compatibility path.

Supplier-evidence import treats canonical identity as create-only. A new row may receive a governed crosswalk/auto-match, but later imports never change `SupplierProduct.canonicalMaterialKey`; only the existing manager review path may mutate that stored mapping. This prevents a conflicting workbook replay from erasing a human-reviewed link. Governed price groups also reject incompatible comparison units when the caller has not selected a unit.

The generated assembly pricing evidence removes the concrete 92-5/8 in. component → 104-5/8 in. supplier-product mismatch. No inferred LF↔EA conversion was added; the affected component remains unpriced until compatible evidence exists. The other generated assembly matches remain legacy name/unit matches and are not represented as a complete canonical-identity audit. This changes no schema, RLS, authentication, permissions, Material price, Estimate snapshot, or automatic repricing behavior.

## 2026-10-03 — branch-currency reconciliation

PR #628 was rebuilt onto current `main` after nine unrelated commits landed during verification. The overlapping governance documents were reconciled onto the newer S052/S066 state instead of restoring stale copies. The app-unit failure from the prior head was also repaired by (1) accepting quoted-inch product text such as `96"` in the canonical normalizer and (2) matching the existing lower-case, unquoted supplier-evidence RLS migration syntax in the tenancy contract test. No Costbook scope or persistence model changed during this currency repair.

PR #628 merged to `main` as `8d37fdbe146a4b45c40c1d58a4c1e5678eee14cf` on 2026-10-04 after exact-head branch verification, CodeRabbit reconciliation, branch-currency reconciliation, and clean post-merge main verification. This document now describes landed architecture rather than an open implementation lane.

## 2026-10-02 — Costbook Data Foundation reconciliation

This section supersedes the older repository snapshot below for current implementation decisions. Reconnaissance was performed against `main` at `6e129b0aefccc37dd3549ad31b2b836104737c34` before implementation started. The numbered sprint queue remained unchanged: S064 was recorded `IN_REVIEW`; the Costbook data-foundation work is an explicitly founder-requested out-of-band slice and does not claim to complete or advance a numbered sprint.

No open Costbook implementation PR overlapped this mission at branch start. Related stale branches were inspected rather than merged: `feature/costbook-bls-oews-ingestion-batch2` was far behind current main and its useful OEWS slice was already present on main; `feature/costbook-bls-ppi-ingestion` is separate PPI work; `ui/costbook-pricing-workspace-20261002` had no unique commits over main; and the older Costbook audit branch was not a viable implementation base. The implementation therefore extends current main on `feature/costbook-data-foundation-20261002`.

### Target specification → existing implementation → action

| Spec requirement | Existing TradeOS implementation | Action |
| --- | --- | --- |
| Canonical items | Production identity already lives in the existing `Material`/`CostItem` catalog plus `SupplierProduct.canonicalMaterialKey`; no authoritative global `canonical_item` table exists. | **MODIFY, not CREATE** — add a governed 12-item pilot key registry and deterministic matching helpers around `canonicalMaterialKey`; do not create a second catalog table. |
| Suppliers | Existing tenant-scoped `Supplier` model, CRUD, supplier-integration review flow, and forced RLS. | **REUSE**. |
| Supplier products | Existing `SupplierProduct` stores supplier key/SKU, MPN, package/UOM, availability, optional Material link, source file, and `canonicalMaterialKey`. | **REUSE + MODIFY behavior** — keep the table; use the new deterministic matcher to establish/review canonical keys. |
| Supplier offers | There is no separate `SupplierOffer` model. Current MVP evidence already records product + store/market + observed prices in `SupplierPriceObservation`. | **REUSE for this MVP** — do not create an offer abstraction until an account-pricing connector (ABC/QBO or equivalent) proves the extra tier/location lifecycle is necessary. |
| Price observations | Existing `SupplierPriceObservation` is dated, tenant-scoped, source-backed and forced-RLS protected, but the service previously upserted changes into an existing observation key. | **MODIFY** — exact replays remain idempotent; changed evidence under the same key now fails closed so price history is append-oriented. PriceResolver reads this existing evidence. |
| Labor rates | Existing `LaborRate` is organization-specific loaded cost + bill rate. Existing BLS OEWS adapter already creates research candidates and deliberately does not populate promotable bill-rate fields. | **REUSE + MODIFY** — keep BLS as benchmark evidence/review input, add the verified core-trade mean/median set, explicit MSA → Indiana → national fallback, and transparent ECEC burden derivation. Never turn a BLS wage directly into `LaborRate.billRate`. |
| Pricing provenance | Existing layers include research-candidate provenance, `MaterialPriceAudit`, supplier observation source/location/date/confidence fields, and Estimate source IDs/snapshots. | **MODIFY** — expose a single resolver trust contract containing source, supplier/location, observation time, confidence, freshness, observed-vs-inferred state, alternatives, and a human-readable selection reason. |
| Assemblies | Existing `Assembly`/`AssemblyItem`, starter catalog, recursive unit-cost resolver, and S064 embedded Estimate picker are authoritative. | **REUSE** — no second assembly/version system in this slice. |
| Estimate snapshots | Existing `EstimateLineItem.costItemId`/`assemblyId` plus persisted `unitCost` and `lineCost` already freeze consumed pricing; price history reads those snapshots separately from catalog audits. | **REUSE** — no new estimate snapshot table. |
| Matcher infrastructure | Existing `candidateMatch.ts` analyzes researched Costbook candidates against production CostItems; supplier-product canonical matching is not implemented. | **MODIFY** — add a pure precision-first supplier-product matcher with the 0.97 auto-link / 0.88 review boundary and hard dimension conflicts; keep the research-candidate matcher intact. |
| Tenant pricing | `SupplierProduct` and `SupplierPriceObservation` already carry `orgId`, explicit service scoping, and forced PostgreSQL RLS; the integration suite already seeds two organizations and cross-org supplier evidence. | **REUSE** — resolver queries retain explicit `orgId` and the database remains the second boundary. No shared contractor-account price pool is introduced. |
| Costbook UI/API trust contract | Existing web Costbook client and `PricingProvenance` component distinguish ordinary catalog facts from governed research evidence, but no canonical resolved-price DTO exists. | **MODIFY** — add `GET /api/v1/costbook/pricing/resolve` and a web DTO/helper; ordinary Material rows are not silently upgraded to verified/current pricing. |

### Bounded implementation decision

The first slice intentionally adds **no Prisma model and no migration**. That is a result of reconciliation, not missing work: the current schema already contains the tenant-scoped supplier-product/observation evidence, Costbook catalog, labor-rate, assembly, RLS, and Estimate snapshot primitives needed to prove the vertical slice. Creating `canonical_item`, `supplier_offer`, another assembly schema, or another price-history table now would duplicate live systems.

The implemented boundary is:

```text
SupplierProduct.canonicalMaterialKey
  + immutable SupplierPriceObservation evidence
  -> trust-first PriceResolver
  -> /api/v1/costbook/pricing/resolve
  -> web Costbook resolved-price DTO

BLS OEWS source evidence
  -> existing Costbook research-candidate queue
  + explicit benchmark fallback / ECEC derivation
  -> future organization-specific labor-pricing decision
```

The resolver's higher-trust tiers for actual purchases, negotiated/account prices, authorized local supplier data, commercial county data, and modeled values are adapter contracts only in this slice. QBO, ABC, 1build, automated retail scraping, and automatic estimate repricing are deliberately not implemented.


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
- [ ] Documentation checks (`npm run docs:test`, `npm run docs:check --
      base origin/main`) — run and recorded in the pull request
