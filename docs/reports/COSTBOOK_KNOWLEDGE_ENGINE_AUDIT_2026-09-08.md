---
status: current
owner: platform
last_verified: 2026-09-08
source_of_truth: false
---

# Costbook and Knowledge Engine Audit — 2026-09-08

Read-only audit. No `app/`, `web/`, schema, migration, authentication, RLS, beta-workflow, or
deployment-configuration file was modified to produce this document. Evidence was collected from
the local worktree on branch `claude/costbook-knowledge-engine-audit-0dska3`, based on
`origin/main` commit `8706afd0e59ac9968864b41bee2c5b4f7772e950` (verified identical to remote
`origin/main` HEAD at audit start; no live PR or branch overlapping this objective was found — see
§9). This document does not alter `docs/SPRINT_BACKLOG.md`, `docs/SESSION_HANDOFF.md`, or any
architecture doc it references; those remain authoritative for sprint state and stay as they were
on `main`.

## 1. Executive summary

TradeOS actually contains **two independent "Costbook" systems that do not share data**, and
conflating them is the single biggest risk to reasoning correctly about "the Costbook":

1. **The production estimating catalog** — `Division`/`Category`/`Subcategory`/`CostItem`/
   `LaborRate`/`Material`/`Equipment`/`Assembly`/`AssemblyItem` in `app/prisma/schema.prisma`,
   served through `app/modules/{cost-database,labor-database,material-database,
   equipment-database,assemblies-database,costbook}` and `/api/v1/costbook/*` (plus legacy
   `/api/v1/{cost-database,labor-rates,materials,equipment,assemblies}/*` aliases), rendered at
   `web/(app)/costbook/**`. This is tenant-scoped (forced RLS, `orgId`), each user's org
   populates it by hand through the UI/API, cost is **derived** at read time from linked
   labor/material/equipment records (region-indexed, burden-adjusted, production-rate-driven —
   `app/modules/cost-database/service.ts:165-218`), and it is the system `docs/modules/cost-book.md`
   and `docs/architecture/COSTBOOK_S027_READINESS.md` describe as production-ready pending the
   S027 browser-evidence gate. **This is the authoritative pricing source of truth for estimates.**
   This audit found no defect in it and recommends no change to it.

2. **The Knowledge Engine corpus** — `packages/knowledge-engine/exports/json/costbook.json`, a
   single global (not tenant-scoped) static file containing 1,795 flat cost items and 289
   assemblies, loaded read-only by `app/modules/knowledge-runtime/loader.ts` and served through
   `/api/v1/knowledge/*` for search, statistics, and deterministic "scope matching" used by AI
   Estimate Assist (`app/modules/ai-estimate-assist/service.ts`) to *suggest* line items. It has
   **no write path into Prisma**, is never persisted as a `CostItem`/`Assembly` row, and its flat
   `laborCost`/`materialCost`/`equipmentCost` shape is exactly the flat-field model that
   `docs/architecture/COSTBOOK_IMPLEMENTATION_RECONCILIATION.md` explicitly rejected for the real
   `CostItem` schema. **This is a separate, advisory-only reference corpus, not a second copy of
   the tenant catalog.**

The most consequential and previously undocumented finding from this audit (§5, §6) is a
**provenance split inside the Knowledge Engine corpus itself**: 1,770 of the 1,795 cost items
(98.6%, spanning 24 "Stable"/"100% coverage" trades per `trade-progress.json`) exist **only** as
literal Python dict literals in `pipelines/generation/seeds/**/*.py` (e.g.
`pipelines/generation/seeds/structural/framing_agent.py`, docstring: `"FramingAgent — 100 items
moved from generate_all"`). They carry none of the provenance fields the corpus's own JSON Schema
(`schemas/cost-item.schema.json`) requires (`version`, `created`, `updated`, `confidenceScore`) —
no source citation, no timestamp, no confidence label, no human-review batch trail. By contrast,
the one trade currently going through the documented generation/review pipeline — Tree Service, 25
items, `"status": "Staged Items"`, `"coverage": "75%"` — has full per-item provenance files under
`knowledge/knowledge/cost-items/tree-service/*.json` and self-labels its own pricing
`"pricingStatus": "PLACEHOLDER"` with `confidenceScore: 0.95` (a confidence score on data the item
itself flags as a placeholder, which is an internal inconsistency worth noting, not a licensing
risk). No RSMeans, Craftsman, or other named commercial cost-data source is referenced anywhere in
`packages/knowledge-engine/**`; the absence of a citation is not proof the bulk 1,770 numbers were
independently originated, only that the repository currently makes no claim either way (§6).

Both systems are functioning as documented for their own scope and neither has a defect that
blocks current production behavior. The risk is entirely in what a future ingestion, licensing
review, or AI-assist trust decision would rely on if it is not told about this provenance split.

## 2. Canonical source of truth (by system)

| Question | Answer | Evidence |
|---|---|---|
| Canonical source of truth for a tenant's live estimating prices | PostgreSQL `cost_items`/`materials`/`labor_rates`/`equipment`/`assemblies` tables, forced RLS, org-scoped | `app/prisma/schema.prisma:319-609`; `docs/modules/cost-book.md` |
| Canonical source of truth for the Knowledge Engine's static reference corpus | `packages/knowledge-engine/exports/json/costbook.json` (1,795 items / 289 assemblies) | `packages/knowledge-engine/README.md` §3, §8; confirmed byte-identical to `knowledge/knowledge/cost-items/costbook.json` (verified diff, §10) |
| Which one estimates actually bill from | (1) only — Estimate line items persist `unitCost`/`lineCost` snapshots sourced from CostItem/Assembly, never from the Knowledge Engine JSON | `docs/architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md` §"Estimate integration"; `app/modules/knowledge-runtime/README.md` "What it does not do" |
| Two known stale duplicate copies of the KE export exist | `pipelines/exports/json/costbook.json` (1,795 items / **39** assemblies — stale, pre-Phase-B run) and `pipelines/knowledge/cost-items/costbook.json` (byte-identical to the stale `pipelines/exports/` copy) | `packages/knowledge-engine/README.md` §8, re-verified by this audit (§10) |

## 3. Current-state inventory

### 3.1 Production relational Costbook (`app/`)

Models (`app/prisma/schema.prisma`):

- `Division` (:319), `Category` (:335), `Subcategory` (:351) — 3-level hierarchy, `orgId`-scoped
  (Division direct, Category/Subcategory inherited), `code`+`name`+`sortOrder`+`isActive`.
- `Region` (:367) — `laborIndex`/`materialIndex` decimal multipliers, org-scoped.
- `Material` (:402) — `sku`, `unitOfMeasure`, `unitCost`, `wasteFactorPct`, `supplierId`.
- `MaterialPriceAudit` (:426) — immutable price-change ledger, org-scoped.
- `SupplierPriceUpdate` (:451) — pending-review staging row for supplier-fed price proposals;
  never auto-applies (comment at :446-450 states this explicitly).
- `LaborRate` (:476) — `role`, `hourlyCost`, `billRate`, `baseHourlyRate`, `burdenPct`, `trade`,
  `regionId`, `active`.
- `Equipment` (:500) — `ownershipCostPerHour`, `operatingCostPerHour`, `dailyRate`.
- `Subcontractor` (:517) — `defaultMarkupPct`.
- `CostItem` (:534) — `subcategoryId`, `code` (unique per org), `unitOfMeasure`,
  `productionRate`, optional `laborRateId`/`materialId`/`equipmentId`/`subcontractorId`,
  `isActive`. **No stored price field** — cost is always derived (§4.1).
- `Assembly` (:566) / `AssemblyItem` (:595) — `isTemplate`, `quantityPerUnit`, cycle-preventable
  child-assembly nesting.
- `CostbookWorkspace` / `CostbookWorkspaceEvent` — unified workspace-boundary bookkeeping added by
  the C001-C004 migration series (`app/prisma/migrations/20260811120000_*` onward).

Routes/services: `docs/modules/cost-book.md` (§"Source code locations", §"Routes") is accurate and
current as verified against the live route list in `app/backend/routes/costbook.routes.ts` and
`app/backend/routes/costDatabase.routes.ts` — not re-transcribed here to avoid drift between two
copies of the same list; treat that document as the live route inventory.

Tests: the 17 test files listed in `docs/modules/cost-book.md` §"Tests" exist on disk
(`app/tests/cost-database.service.test.ts`, `app/tests/costbook.rls.integration.ts`,
`app/tests/estimate-costbook-snapshot.test.ts`, etc. — spot-checked by filename, not re-run; see
§8 for why).

Athena integration: `app/modules/athena-tools/costbook/*` — three **read-only** tools (catalog
lookup, margin analysis, price recommendation) that call `CostDatabaseService` /
`AssembliesDatabaseService` / shared Estimate formulas directly. They do not touch Prisma
directly and do not expose write-capable Costbook methods (`docs/modules/cost-book.md`
§"Purpose"). This audit did not find any code path where an Athena tool or the Knowledge Runtime
writes to `CostItem`/`Material`/`LaborRate`/`Equipment`/`Assembly`.

### 3.2 Knowledge Engine corpus (`packages/knowledge-engine/`)

Canonical shallow tree per `packages/knowledge-engine/README.md` §2 (verified current on disk:
`agent-skills/`, `docs/`, `exports/`, `knowledge/`, `legacy-archive/`, `pipelines/`, `prompts/`,
`review/`, `runtime/`, `schemas/`, `scripts/`; no `package.json`/manifest at the package root).

Canonical export (`exports/json/costbook.json`, 709,249 bytes):

- `{"items": [...1795], "assemblies": [...289]}`.
- Item shape observed on every one of the 1,795 items, **no exceptions**: `id`, `name`,
  `category`, `unit`, `laborCost`, `materialCost`, `equipmentCost`, `notes` — 8 fields, no more,
  no less. No `code`, no `trade`, no `subcategory`, no `version`/`created`/`updated`, no
  `confidenceScore`, no `pricingStatus`, despite all of those being defined as optional/required
  properties in `schemas/cost-item.schema.json`.
- Assembly shape: `id`, `name`, `category`, `lineItems: [{costBookItemId, quantity}]`.
- 24 categories present, matching `knowledge/knowledge/trade-progress.json`'s 24 "Stable"/"100%"
  trades exactly by name and count (Fence 100, General Conditions 98, Insulation 97, Flatwork 97,
  Concrete 95, Plumbing 92, Deck 92, Framing 90, Siding 90, Excavation 89, Flooring 89, Roofing 88,
  Electrical 88, Hvac 87, Trim 87, Drywall 85, Painting 85, Landscaping 54, Cabinetry 42,
  Hardware 36, Doors 34, Windows 31, Hardscaping 27, Countertops 22 = 1,770). The remaining 25 are
  Tree Service (`"status": "Staged Items"`, `"coverage": "75%"`) — the only trade **not** listed in
  `knowledge/knowledge/trade-taxonomy/taxonomy.md`'s 24 registered categories, confirming it is a
  25th, still-in-progress addition.
- Per-item source files (richer schema, with provenance) exist for **only 2 of 25 trades**:
  `knowledge/knowledge/cost-items/roofing/roofing_cost_items_batch_1.json` (1 file, appears to be a
  single already-merged review batch, not the live per-item source for the 88 canonical Roofing
  items — its own item count was not exhaustively cross-diffed against the 88 canonical Roofing
  entries; treat as inferred, not confirmed, per §5) and
  `knowledge/knowledge/cost-items/tree-service/*.json` (26 files, one per item, each carrying
  `version`, `created`, `updated`, `pricingStatus`, `confidenceScore`, `assumptions`,
  `exclusions`, `futurePricingHooks` — the full schema).
- The other 23 "Stable" trades' 1,770 items have **no corresponding per-item source files
  anywhere in the repository**. Their only textual origin found by this audit is literal Python
  list-of-dict source in `pipelines/generation/seeds/{structural,exterior,interior,mep,envelope,
  general,assemblies}/*.py` (29 agent files total; `framing_agent.py` inspected directly, 100
  items, comment: `"100 items moved from generate_all"` — i.e., migrated out of an earlier
  monolithic script, not generated through the current batch/review pipeline described in
  `packages/knowledge-engine/review/review-checklist.md`).

Schemas (`schemas/*.json`): `cost-item.schema.json`, `assembly.schema.json`, `crew.schema.json`,
`inspection.schema.json`, `permit.schema.json`, `production-rate.schema.json`,
`proposal-language.schema.json`, `reasoning.schema.json`, `supplier.schema.json` — 9 JSON Schema
contracts exist; only `cost-item.schema.json` and `assembly.schema.json` have any live consumer
(`app/modules/knowledge-runtime/loader.ts` lists schema files by name for metadata only — it does
not validate against them at load time). The other 7 schemas (crew, inspection, permit,
production-rate, proposal-language, reasoning, supplier) currently describe data models with **no
corresponding data files or runtime consumer found** — aspirational/unused schema surface.

Review pipeline (`packages/knowledge-engine/review/`): `review-checklist.md` documents a real,
specific human-review contract for staged batches — schema validation, a **$12.00/HR pricing
floor**, Title Case + abbreviation casing rules, waste-factor rules (10% for sheet goods, 5% for
linear items), exclusion-overlap checks, and orphan-UUID dependency checks, resolved by moving the
batch JSON to `review/approved/` or `review/rejected/` and running
`pipelines/master_pipeline.py`. `review/pending/tree_service_cost_items_batch_1.json` and
`review/pending/tree_service_batch_1.json` are the only batches currently staged.
`review/rejected/batch1.json` shows the reject path has been exercised at least once historically.
**This pipeline was never run against the 1,770 bulk items** — there is no batch file, approval
record, or rejection record for Framing, Concrete, Electrical, or any of the other 22 bulk trades
anywhere in `review/**` or `legacy-archive/**`.

## 4. Data-flow map

### 4.1 Production estimating flow (live, tenant-scoped)

```
web/(app)/costbook/cost-items (and materials/labor-rates/equipment/assemblies pages)
  -> web/src/lib/api.ts or clientApi.ts -> web proxy route
    -> app/backend/routes/costbook.routes.ts (or legacy cost-database/labor-rates/materials/equipment/assemblies routes)
      -> app/backend/controllers/{costbook,costDatabase,assembliesDatabase}.controller.ts
        -> app/modules/{costbook,cost-database,assemblies-database}/service.ts
          -> Prisma (forced RLS, org-scoped) -> Postgres: cost_items / materials / labor_rates / equipment / assemblies / assembly_items

Unit cost (app/modules/cost-database/service.ts:165-218), per CostItem, per call:
  laborCostPerUnit   = laborCost(productionRate, laborRate.baseHourlyRate, laborRate.burdenPct, region.laborIndex) / quantity
  materialCostPerUnit = adjustedMaterialCost(material.unitCost, material.wasteFactorPct, region.materialIndex) / quantity
  equipmentCostPerUnit = equipmentCost(quantity/productionRate hours, equipment.ownershipCostPerHour, equipment.operatingCostPerHour, equipment.dailyRate) / quantity
  totalUnitCost = round2(sum) — all three components independently optional (item may have only one/two linked)

Estimate consumption:
  EstimateLineItem persists sourced CostItem/Assembly id + a *snapshot* unitCost/lineCost at creation time.
  Later Costbook price changes never rewrite existing EstimateLineItem rows (docs/architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md, "Estimate integration").
```

### 4.2 Knowledge Engine advisory flow (file-based, global, read-only)

```
packages/knowledge-engine/pipelines/generation/seeds/**/*.py  (bulk items, no provenance)
packages/knowledge-engine/knowledge/knowledge/cost-items/{roofing,tree-service}/*.json  (2 trades, full provenance)
        |  pipelines/master_pipeline.py (manual, offline, not CI-wired) writes:
        v
packages/knowledge-engine/exports/json/costbook.json  (canonical flat export: 1795 items / 289 assemblies)
        |  read at process start, cached in-memory (app/modules/knowledge-runtime/cache.ts)
        v
app/modules/knowledge-runtime/loader.ts  -> repository.ts (keyword/trade inference, no DB) -> matcher.ts (deterministic scope match)
        |
        +--> app/backend/controllers/knowledgeRuntime.controller.ts -> app/backend/routes/knowledgeRuntime.routes.ts
        |      GET  /api/v1/knowledge/stats
        |      GET  /api/v1/knowledge/trades
        |      GET  /api/v1/knowledge/search
        |      POST /api/v1/knowledge/match           (matchScopeDeterministically)
        |      GET  /api/v1/knowledge/assemblies/search   (compat alias)
        |      GET  /api/v1/knowledge/cost-items/search   (compat alias)
        |      POST /api/v1/knowledge/match-scope         (compat alias)
        |
        +--> app/modules/ai-estimate-assist/service.ts + structuredEstimator.ts
        |      Uses matched assemblies/cost items as *suggestions* only.
        |      Accepted suggestions are applied through EstimateEngineService
        |      (persists as ordinary EstimateLineItem rows) — never written back
        |      into CostItem/Assembly/Material/LaborRate/Equipment tables, and
        |      never persisted with any Knowledge Engine provenance metadata.
        |
        +--> app/modules/athena-context-engine/providers/knowledgeEngineProvider.ts
               (Athena context surface; also read-only per this audit's grep)

Separate standalone reader: app/modules/trainingless-estimate-demo/knowledgeLoader.ts
  reads exports/json/costbook.json and assembly-index.json directly via its own relative-path
  resolution, for `npm run demo:trainingless-estimate` only — not part of any production request
  path.

Vercel deployment note (app/modules/knowledge-runtime/loader.ts:6-28): because the Vercel project
root is "app", packages/knowledge-engine is not present in the deployed Lambda filesystem;
scripts/vendor-knowledge-engine.js is expected to copy the needed data into
app/vendor/knowledge-engine/ as a build step, and the loader prefers that vendored copy when
present. This audit did not verify scripts/vendor-knowledge-engine.js's current build-time
behavior against a live deployment (out of scope — no deployment-configuration inspection
performed; see §8).
```

**No path exists anywhere in the repository that imports/ingests `exports/json/costbook.json` (or
any Knowledge Engine file) into the Prisma `CostItem`/`Material`/`LaborRate`/`Equipment`/
`Assembly` tables.** This was confirmed by grepping `app/` for the Knowledge Runtime's exported
functions (`searchKnowledge`, `matchScopeDeterministically`, `getKnowledgeRepositorySnapshot`) and
finding only the read-only consumers listed above (knowledge-runtime controller, ai-estimate-
assist, athena-context-engine, and their respective test files).

## 5. Confirmed gaps vs. inferred gaps

Confirmed (directly observed in code/data, high confidence):

- The canonical `costbook.json` export's 1,795 items carry **zero** provenance/versioning/
  confidence fields even though the corpus's own schema defines them — confirmed by iterating
  every item's key set (§3.2; 8/8 fields identical across all 1,795 records, no variation).
- 1,770 of those 1,795 items have no traceable per-item source file in the repository; their
  only found textual origin is hardcoded Python literals in `pipelines/generation/seeds/**`
  (confirmed for Framing via direct file read and exact string match of a sample item name; not
  individually confirmed for the other 22 bulk trades' seed files, which were not each opened —
  see limitations, §11).
- The Knowledge Engine corpus has no write path into the live relational Costbook (confirmed by
  full-repo grep of the Knowledge Runtime's public functions).
- Three divergent on-disk copies of `costbook.json` exist (`exports/json/`,
  `knowledge/knowledge/cost-items/`, `pipelines/exports/json/`, `pipelines/knowledge/cost-items/`);
  the first two are byte-identical (confirmed by diff), the latter two are stale
  39-assembly-count copies per `packages/knowledge-engine/README.md` §8 (this audit re-confirmed
  the canonical/`knowledge/knowledge/` pair's identity but did not re-diff the stale
  `pipelines/**` pair against README's prior claim — treated as still-current per that document's
  own "re-verified" language, not independently re-verified here).
- No RSMeans, Craftsman, or other named commercial construction cost-data source is referenced
  anywhere under `packages/knowledge-engine/**` (confirmed by case-insensitive grep across all
  markdown; JSON/Python source was not separately grepped for the same terms — see limitations).
- The review pipeline (`review/review-checklist.md`) has never processed the 1,770 bulk items —
  confirmed by the absence of any batch/approval/rejection artifact for those trades under
  `review/**`.

Inferred (plausible from available evidence, not independently proven):

- Whether the 1,770 bulk items' dollar values were originated by an LLM, by a human estimator, or
  transcribed/derived from a licensed source cannot be determined from repository evidence alone.
  The complete absence of any citation, prompt log, or generation record is consistent with (but
  does not prove) independent origination, and equally consistent with an unrecorded external
  source. Treat this as an open licensing question, not a confirmed violation or a confirmed
  clean bill of health.
- Whether `pipelines/master_pipeline.py` is still runnable end-to-end today (schema-valid,
  path-correct after the Phase B path fixes) was not exercised in this audit; `PATHS.md` and the
  package README record it as fixed for path construction but this audit did not execute it.
- Whether the vendoring build step (`scripts/vendor-knowledge-engine.js`) currently succeeds
  against the live Vercel deployment is unverified (deployment configuration is out of scope for
  this audit).

## 6. Provenance and licensing risk assessment

| Risk | Severity | Basis |
|---|---|---|
| Bulk 1,770-item corpus has no data lineage | **High** — blocks any confident claim about accuracy, currency, or legal originality | §3.2, §5 |
| No effective-date/region metadata on any canonical item | Medium — items cannot be marked stale or region-adjusted; the *production* CostItem model already solves this correctly via `Region.laborIndex`/`materialIndex` (§4.1), so the gap is specific to the advisory corpus, not the paid product | §3.1 vs §3.2 |
| No explicit "not derived from RSMeans/licensed data" statement | Medium — absence of a citation is not the same as an affirmative clean-provenance statement; a future contributor could unknowingly copy real RSMeans line items into a seed file without any policy catching it | §6 intro |
| Schema drift between `cost-item.schema.json` (rich) and the actual export (flat) | Low-Medium — not itself a licensing risk, but it means the schema cannot be used today to enforce provenance capture, and any tooling that assumes schema conformance would be wrong | §3.2 |
| `agent-skills/skills/**` vendored third-party content (~1,400 dirs, incomplete per-directory licenses) | Already flagged and owned by `packages/knowledge-engine/README.md` §4/§8 | Re-confirmed present, not re-audited in depth here — out of this audit's Costbook-specific scope |

No scraping or reproduction of copyrighted RSMeans (or similar) content was performed by this
audit, and none was found already present with an attached citation. The risk identified here is
the *absence of evidence either way* for the bulk corpus, which is itself the finding to act on.

## 7. Highest-value missing Costbook additions (for contractor estimating)

Ranked by estimator-facing value, independent of implementation cost:

1. **Provenance metadata on every existing canonical item** (source, effective date, region
   assumption, confidence, review status) — not new pricing content, but the highest-leverage
   addition because it unlocks trustworthy use of the other 23 trades' data for anything beyond
   advisory keyword matching.
2. **Regional cost variance** for the Knowledge Engine corpus. The production `Region` model
   already exists and is used for the real Costbook (§4.1); the Knowledge Engine corpus has no
   equivalent, so its numbers are implicitly "somewhere in the US, unstated year."
2. **Change-order-relevant items**: demolition/tear-out variants exist for some trades (Framing
   has several — see the seed sample in §3.2) but coverage across all 24 trades was not
   inventoried exhaustively; demolition/removal is a commonly under-covered category in
   contractor costbooks generally.
3. **Permit and inspection line items** — `schemas/permit.schema.json` and
   `schemas/inspection.schema.json` already exist as schema contracts with **no backing data
   file anywhere**, meaning this is fully planned, zero-percent implemented.
4. **Crew composition data** (`schemas/crew.schema.json`, same zero-data status) — would let
   labor-cost suggestions reflect a real crew mix (foreman + apprentice hours) instead of a single
   blended labor rate.
5. **Completing Tree Service and extending the same rigorous per-item/provenance/review pattern to
   at least one more net-new trade**, to prove the documented pipeline (§3.2 review process) can
   take a trade from zero to "Stable" with real provenance, before ever considering backfilling
   provenance onto the 23 already-"Stable" trades.

## 8. Recommended safe data-ingestion process (design only)

For any future ingestion of new or corrected Costbook knowledge, the pattern already
demonstrated by Tree Service (§3.2, §schemas) is the right shape to standardize, not reinvent:

1. **Per-item source file, not a bulk literal.** One JSON file per item under
   `knowledge/knowledge/cost-items/<trade>/`, matching `schemas/cost-item.schema.json` in full
   (including `version`, `created`, `updated`, `confidenceScore`).
2. **Mandatory provenance fields** on every new item: a `source` field (currently absent from the
   schema entirely — this is a schema gap, not just a data gap) distinguishing
   "internal-estimate" / "public-published-rate" / "licensed-third-party" / "supplier-quote", an
   explicit `effectiveDate`, and a `regionAssumption` (even a coarse "US national average, no
   regional adjustment" is better than the current silence).
3. **Confidence and review status must be distinct fields**, not conflated (the Tree Service
   inconsistency in §1 — `pricingStatus: PLACEHOLDER` alongside `confidenceScore: 0.95` — is the
   concrete example of why: a placeholder price should not carry a high confidence score).
4. **Route new items through the existing `review/` pending → approved/rejected pipeline** and
   `review/review-checklist.md` gate before they reach `master_pipeline.py` and the canonical
   export — this infrastructure already exists and already works for Tree Service; it should not
   be bypassed for expediency.
5. **Never ingest directly into the production `CostItem`/`Material`/`LaborRate`/`Equipment`
   tables from the Knowledge Engine.** The two systems' data models are fundamentally different
   (flat single-number-per-component vs. relational region/burden/production-rate-derived), and
   `docs/architecture/COSTBOOK_IMPLEMENTATION_RECONCILIATION.md` already made the correct
   architectural call rejecting a flat-field `CostItem` shape. Any future "import Knowledge Engine
   item into my org's Costbook" feature should be a distinct, explicit, human-approved copy
   operation (mapping flat fields into a newly created `Material`/`LaborRate`/`CostItem` triplet
   the org can then edit normally) — never a schema unification of the two systems.
6. **Do not backfill fabricated provenance onto the 1,770 existing bulk items.** Inventing
   `created`/`confidenceScore` values for data that has none would manufacture false certainty.
   The honest fix is either (a) explicitly and visibly labeling the bulk corpus
   `"provenance": "unverified-legacy"` at the trade-progress or export level, or (b) re-deriving
   it item-by-item through the same reviewed pipeline used for Tree Service. (a) is far cheaper
   and should happen first regardless of whether (b) is ever pursued.

This section is a design recommendation only; per task scope, no ingestion tooling, schema change,
or data file was implemented on this branch.

## 9. Smallest safe next implementation slice (not implemented here)

Add a `"provenanceStatus"` field — values `"documented"` or `"unverified-legacy"` — to
`knowledge/knowledge/trade-progress.json` per trade (25 rows, one-line addition each), and thread
that field through to `KnowledgeStats`/`KnowledgeTrade` in `app/modules/knowledge-runtime/
repository.ts` and its API response, plus one line in `app/modules/knowledge-runtime/README.md`'s
"Data sources" section documenting the split found in this audit. This is:

- Purely additive (new optional field, no existing field removed or renamed).
- Confined to `packages/knowledge-engine/knowledge/knowledge/trade-progress.json`,
  `app/modules/knowledge-runtime/{types.ts,repository.ts}`, and its own README/tests —
  well inside the S027 "Allowed paths" list (`docs/SPRINT_BACKLOG.md` line 295: "canonical
  Knowledge Engine Costbook exports/metadata only when required").
- Does not touch pricing, does not touch the production `CostItem`/`Assembly` tables, does not
  touch RLS, migrations, or auth.
- Immediately actionable value: any AI Estimate Assist suggestion or `/api/v1/knowledge/*`
  consumer (including a future UI surface) could then visibly flag "this suggestion is drawn from
  unverified-legacy pricing data" versus "documented" data, closing the trust gap identified in
  §1 without waiting on a full re-provenance effort.
- Does not require, and should not attempt, promoting or altering S027's own status — S027 remains
  `BLOCKED` on the unrelated authenticated-browser-evidence gate (`docs/SPRINT_BACKLOG.md`
  §S027), which this audit did not touch.

Per task instructions, this slice was **identified but not implemented** on this branch.

## 10. Verification commands and results

All commands were run read-only from the repository root or `packages/knowledge-engine/`.

```text
$ git fetch origin main
  -> FETCH_HEAD = 8706afd0e59ac9968864b41bee2c5b4f7772e950 (matches this branch's base)
$ git status --porcelain=v1 -uall
  -> (empty; clean tree throughout the audit)
$ git branch --remotes | grep -i -E "costbook|knowledge"
  -> only origin/claude/costbook-knowledge-engine-audit-0dska3 (this session's own branch)
$ (GitHub MCP) list_pull_requests state=open, owner=404TradeOS-LLC, repo=TradeOS
  -> [] (zero open PRs repository-wide at audit start)
$ npm run autonomy:reconcile -- --task "Costbook and Knowledge Engine audit report"
  -> "GitHub CLI (gh) is required for live PR reconciliation" (gh unavailable in this
     environment; PR/branch reconciliation was instead performed directly via the GitHub MCP
     tools above, which returned zero open PRs and no overlapping branch)
```

```text
$ python3 -c "import json; d=json.load(open('packages/knowledge-engine/exports/json/costbook.json')); print(len(d['items']), len(d['assemblies']))"
  -> 1795 289
$ diff <(canonical costbook.json, sorted-key JSON) <(knowledge/knowledge/cost-items/costbook.json, sorted-key JSON)
  -> (empty — byte-for-byte identical after key sorting)
$ python3 -c "... collections.Counter(category for item in items) ..."
  -> 24 categories, counts matching knowledge/knowledge/trade-progress.json exactly (Tree Service
     absent from the flat export's category list at the head-60 cutoff used, consistent with it
     being staged separately from the 24 "Stable" trades)
$ find packages/knowledge-engine/knowledge/knowledge/cost-items -name "*.json" | wc -l
  -> 27 (1 costbook.json copy + 1 roofing batch file + 25 tree-service per-item files)
$ grep -rli "rsmeans\|copyright\|proprietary\|licensed" packages/knowledge-engine/**/*.md
  -> 171 files matched, all inside agent-skills/skills/** (vendored, unrelated third-party
     skill docs — e.g. Terraform/WordPress/HuggingFace skill READMEs mentioning "license" in a
     generic software sense); zero matches referencing construction cost-data licensing
$ grep -rn "searchKnowledge\|matchScopeDeterministically\|getKnowledgeRepositorySnapshot" app/**/*.ts
  -> 16 files: knowledge-runtime module itself + its tests, ai-estimate-assist service/types/
     structuredEstimator, athena-context-engine provider/cache, and their tests — no route or
     service outside this list references the Knowledge Engine data
```

```text
$ npm install --no-audit --no-fund   # root node_modules was absent in this environment
  -> added 5 packages
$ npm run docs:check
  -> Base ref: origin/main; Changed files: 1 (this report); Matched ownership rules: none;
     Required documentation files: none; Result: PASS
$ npm run pr:preflight -- --base origin/main
  -> Changed files: 1 (this report); Required docs: none; Missing required docs: none;
     Recommended verification: git diff --check
$ git diff --check
  -> (exit 0, no whitespace errors)
```

This audit's own deliverable is a new file under `docs/reports/**`, which `docs/DOC_OWNERSHIP.yml`
does not list an ownership rule for (confirmed by grep — zero matches for `docs/reports` in that
file, and confirmed again by `docs:check`'s live "Matched ownership rules: none" output above), so
no owner document elsewhere required an update for this change.

Not run (explicitly out of scope for a documentation-only audit branch per task instructions, and
because this branch must not modify `app/`/`web/`): `npm test`, `npm run test:integration`,
`npm run lint`, `npm run build` in either `app/` or `web/`. These validate application code, and
this branch changes none.

## 11. Explicit limitations

- **Not all 29 seed-generator Python files were individually opened.** Only
  `pipelines/generation/seeds/structural/framing_agent.py` was read in full to confirm the
  "hardcoded literal, no provenance" pattern. The other 28 files (covering the remaining 22 bulk
  "Stable" trades plus assemblies/general/mep/envelope/exterior/interior seed groups) were not
  each individually opened; the finding that all 1,770 bulk items lack provenance is based on the
  export file's own field-set audit (§3.2, which *is* exhaustive — every one of the 1,795 items
  was iterated), not on having read every generator source file.
- **The roofing per-item source file's relationship to the 88 canonical Roofing items in the
  export was not exhaustively cross-diffed.** `roofing_cost_items_batch_1.json` contains at least
  1 top-level structure (a list); whether it represents all 88, a subset, or an already-superseded
  earlier batch was not resolved. Treat the Roofing trade's provenance status as inferred, not
  confirmed, pending that diff.
- **JSON and Python source files were not grepped for RSMeans/licensing terms**, only Markdown
  files were. A citation embedded only in code comments or JSON `notes` fields (rather than a
  `.md` file) would not have been caught by the command in §10.
- **No code was executed** — `pipelines/master_pipeline.py`, the Knowledge Runtime loader against
  a live Node process, `scripts/vendor-knowledge-engine.js`, and the actual `/api/v1/knowledge/*`
  endpoints were read as source only, never run. All data-flow claims are static-analysis
  conclusions from source and data files, not runtime-observed behavior.
- **No `app/`, `web/`, schema, migration, auth, RLS, beta-workflow, or deployment-configuration
  file was read for the purpose of changing it**, per task scope; several were read (schema.prisma,
  service.ts, routes) purely to trace the existing data flow, and none were modified.
- **GitHub reconciliation used the GitHub MCP tools, not `gh`**, because `gh` is unavailable in
  this execution environment; `npm run autonomy:reconcile` therefore could not complete its
  intended `gh`-backed search. The MCP-tool-based search (zero open PRs repository-wide, no
  overlapping branch) is treated as sufficient evidence for `NEW_WORK_REQUIRED` classification but
  is a narrower search than the helper script would have performed.
- This document is a snapshot as of the commit and date stated above. Per
  `docs/REPOSITORY_GOVERNANCE.md`'s live-state-verification rule, treat GitHub/live-repository
  state as authoritative over this document if they have since diverged.
