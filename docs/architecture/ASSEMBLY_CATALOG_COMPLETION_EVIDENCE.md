---
status: partial
owner: costbook
last_verified: 2026-11-23
source_of_truth: true
related_docs:
  - docs/architecture/ASSEMBLY_CATALOG_IMPLEMENTATION.md
  - docs/modules/cost-book.md
  - docs/API_REFERENCE.md
  - docs/CURRENT_STATE.md
  - docs/SESSION_HANDOFF.md
related_code:
  - app/modules/assemblies-database/catalog.ts
  - app/modules/assemblies-database/tradeosCatalogAdapter.ts
  - app/modules/assemblies-database/kitchenGapCatalog.ts
  - app/modules/assemblies-database/openingsApplianceGapCatalog.ts
  - app/modules/costbook/tradeosAssemblies.ts
  - app/modules/costbook/tradeosAssemblySources.ts
  - app/modules/assemblies-database/service.ts
  - app/modules/assemblies-database/measurement.ts
  - app/backend/controllers/assembliesDatabase.controller.ts
  - app/backend/routes/assembliesDatabase.routes.ts
  - app/backend/routes/costbook.routes.ts
  - web/src/components/costbook/assembly-catalog.tsx
  - web/src/app/(app)/costbook/assemblies/page.tsx
---

# Assembly Catalog — Completion Evidence (PR #517 and later)

Status: PARTIAL — the #517 starter slice is complete and evidenced below; the
expanded 107-recipe catalog is merged and tested but its release gates (notably
authenticated browser evidence and a reviewed coverage-gap statement) remain
open under issue #518. This document was PR #517-only until the 2026-11-23
refresh; the sections after the #517 record cover #520, #771, #773, #774,
#1018, #1035, and #1036.

## Shipped outcome (current, 2026-11-23 at main `255bbc41`)

The Assembly Catalog is a contractor-facing residential system of **107
templates** (14 reviewed starters + 88 research recipes + 2 kitchen-gap + 3
openings/appliance recipes), organized by NAHB work groups/phases with CSI
MasterFormat classification. Estimators browse the catalog, map every recipe
slot to their organization's active Cost Items, and install real, tenant-scoped
`Assembly`/`AssemblyItem` records. The catalog carries no embedded prices, no
second pricing engine, and no schema/migration/RLS/request-session changes
beyond the original #517 slice. **105 templates are installable; 2 are
install-blocked** on unregistered evidence sources SRC-0049/SRC-0050 (see
"Known limitations and follow-up"). Catalog version served by the API:
`2026.09.1+research88+kitchen2+openings3`.

## Post-#517 merge evidence

- **#520 — Mapping hardening (merged 2026-09-22, `cc12074e8f0bde422dd85bb78c50243221bf2933`).**
  Versioned catalog/recipe metadata, derived NAHB × CSI coverage matrix,
  server/client unit+type compatibility checks, duplicate-mapping prevention,
  transactional install, Cost Item search/typeahead with hints, live-session
  tenant integration tests.
- **#771 — 88 research recipes activated (merged 2026-10-19, `15d7e0c736bf069bc8a34ce9a3e32ddb5651505a`).**
  The TradeOS research corpus exposed through the same starter-catalog API and
  install pipeline as `research` templates; no prices or supplier identities
  embedded; all 88 retain NAHB phase, CSI division, measurement basis,
  assumptions, and scope exclusions.
- **#773 — Kitchen gaps (merged 2026-10-23, `ef983efc7db5e2e530ceec7863c9bbc7f6126f98`).**
  Two source-backed kitchen recipes (wall cabinet, straight-run laminate
  countertop; SRC-0069, SRC-0070).
- **#774 — Openings/appliance gaps (merged 2026-10-23, `e17a166d4835b1b24d600d4236bcac0b28b48d84`).**
  Three source-backed recipes (flanged vinyl window, sectional steel garage
  door, ready-connection dishwasher; SRC-0071–SRC-0073).
- **#1018 — Source repair, issue #518 S1 (merged 2026-11-22, `1d1e23fe653dcf24019b676b5ba4d2058078928b`).**
  Registered SRC-0041–SRC-0048, unblocking 9 of the 11 formerly source-blocked
  recipes. SRC-0049/SRC-0050 remain unregistered by design (no repo text names
  their intended source); the 2 affected recipes stay install-blocked and are
  pinned as blocked by `app/tests/assembly-starter-catalog.test.ts`.
- **#1035 — Measurement contracts + takeoff derivation, issue #518 S8 (merged 2026-11-23, `efdc5364`).**
  Formal measurement contracts (`app/modules/assemblies-database/measurement.ts`):
  five takeoff families (area, linear, count, volume, allowance) plus mass/time
  component families; exact area-only conversion; contract failures fail closed
  at install (422). All 107 templates pass. Takeoff-record connection (S8b)
  remains a named follow-up gated on S065 + S4.
- **#1036 — Waste/production overrides at assembly install, issue #518 S10 (merged 2026-11-23, `255bbc41`).**
  Optional `wasteOverridePct` (0–100) and `productionRateFactor` (>0, ≤10)
  stored per installed assembly (additive nullable migration, no backfill) and
  applied at pricing time through the existing `getUnitCost` path; recipe
  quantities are never rewritten; child assemblies resolve with their own
  overrides; editable after install via PATCH (`null` clears).

## Verification evidence (current catalog)

- Catalog invariants are pinned by `app/tests/assembly-starter-catalog.test.ts`
  (14 starters; 88 research + 14 + 2 + 3 = 107 expanded; unique ids/codes;
  exact 2-item blocked list with SRC-0049/SRC-0050; pinned starter quantities
  and compatibility metadata by version) and
  `app/tests/costbook-tradeos-assemblies.test.ts` (88 assemblies, 71 registered
  sources, no hardcoded selling prices, cabinet-tier rule).
- Live RLS coverage: `app/tests/costbook-assemblies.rls.integration.ts` — 6
  live tests (read-only visibility, denied writes, owner composition,
  cross-org rejection, atomic install, foreign-mapping rollback).
- Full-suite gate counts from the 2026-11-06 issue reconciliation (3,054 backend
  tests green at that time) were **not re-run in the 2026-11-22 read-only S11
  slice**; re-verify counts when this refresh lands as a PR.

## Checks blocked or not run

- `cd app && npm run test:integration` was not run for #517. Treated as optional
  per repository preflight rules because this change introduces no schema,
  migration, RLS, auth, or request-session modification.
- Authenticated rendered-browser verification (desktop/mobile) was not run for
  #517; no disposable authenticated tenant/browser fixture was available in
  this workspace. No deployment or production behavior was tested or claimed.
- **Still not run (2026-11-23):** authenticated owner/admin + read-only browser
  evidence at 1440px and 390px for the expanded catalog. The evidence workflow
  (`.github/workflows/assembly-catalog-browser-evidence.yml`) exists, but 7/7
  runs failed as of the 2026-11-21 triage (latest 2026-10-11); no successful run
  has ever attached evidence. Diagnosed 2026-11-22 (DEV-17 S5): the failures
  were a workflow-file parse error, already fixed on main via #853; a green run
  is still blocked on Billy-only read-only smoke secrets. This is issue #518 S5
  and the largest open release-gate item for the catalog.

## Known limitations and follow-up

- The 14 starter recipes are reviewed TradeOS-authored defaults, not an
  exhaustive construction assembly database, and require estimator review
  for waste, production, access, code, permit, and project conditions before
  use in a live estimate. The 93 research/gap recipes are explicitly
  unreviewed (`reviewedOn: ""`); the UI labels them "research review required."
- Supplied pricing datasets were not decomposed into invented assembly
  prices; the catalog remains price-free by design.
- Two recipes remain install-blocked (SRC-0049/SRC-0050) pending Billy's word
  on their intended sources.
- NAHB phase 6000 (Completion and Inspection) has zero recipes; whether it is
  in scope is an open founder question (S11 assessment, 2026-11-22).
- `reviewedOn` / `regionalBasis` are served by the API but not rendered in the
  catalog UI (verified 2026-11-23).
- CSI division 04 (Masonry) is used by 2 recipes but missing from the
  `CSI_DIVISIONS` constant; trade-family strings have near-duplicate
  case/spacing variants ("Finish carpentry" vs "Finish Carpentry",
  "Sitework" vs "Site Work"). Both found in the S11 review, 2026-11-22.
- Outstanding follow-up: authenticated owner/admin and read-only browser
  evidence at desktop and 390px mobile widths (S5); installed-template
  version tracking and upgrade/diff workflow (S2/S3 — requires migration);
  estimate-line recipe/version/mapping snapshots (S4); source/provenance
  policy doc (S6); per-trade-family fixture matrix (S11 §3 of the assessment
  proposes the matrix; tests not yet written).
- Note: `docs/CURRENT_STATE.md` described the 107 templates as "proposed, not
  merged" — stale since #771/#773/#774 merged in October 2026; corrected in
  the same PR as this refresh (2026-11-23).

[The original "Merge Validation Summary (PR #517)" record follows below,
preserved verbatim from the pre-refresh version of this file.]

# Assembly Catalog — Merge Validation Summary (PR #517)

Status: COMPLETE (out-of-band founder-authorized work; no numbered sprint)

## Shipped outcome

Directly authorized founder work adding a contractor-facing residential
Assembly Catalog to Costbook, organized by NAHB work groups with CSI
MasterFormat classification. Estimators can browse 14 TradeOS-authored
starter recipes, map every recipe slot to their organization's active Cost
Items, and install real, tenant-scoped `Assembly`/`AssemblyItem` records. The
catalog carries no embedded prices, no schema/migration/RLS/request-session
changes, and no second pricing engine. The existing manual assembly editor,
nested composition, unit-cost calculation, permissions, forced-RLS boundary,
and Estimate pricing snapshots remain unchanged.

## Affected TradeOS domains

- **Backend / Costbook module** — `assemblies-database` service, controller,
  and route additions (`GET .../starter-catalog`, `POST
  .../starter-catalog/install`) under both the `costbook` and
  `assembliesDatabase` route groups; `costbook.read` / `costbook.write`
  permission gates only, no new roles or scopes.
- **Frontend / Costbook UI** — `/costbook/assemblies` gains starter-catalog
  browse, search, NAHB-group filter, Cost Item mapping, install, and
  installed-state UX alongside the existing assembly editor.
- **Documentation** — `docs/API_REFERENCE.md`, `docs/CURRENT_STATE.md`,
  `docs/modules/cost-book.md`, `docs/SESSION_HANDOFF.md`, and the new
  `docs/architecture/ASSEMBLY_CATALOG_IMPLEMENTATION.md` source-of-truth
  record.
- **Not touched** — database schema/migrations, RLS policies, request-session
  handling, authentication, Estimate pricing engine, other Costbook surfaces
  (materials, labor rates, equipment, price history, supplier feeds).

## Implementation evidence

- Implementation PR: [#517](https://github.com/404TradeOS-LLC/TradeOS/pull/517)
  ("feat(costbook): add residential assembly catalog"), including a
  follow-up review-fix commit ("fix(costbook): address assembly catalog
  review").
- Final implementation head before squash merge:
  `a745702675c433bbf30f4ff0b8a7ad435171af8b`.
- Squash merge commit on `origin/main`:
  `f59bab1b9e7dd79202f9106626357620804caa9e`.
- Branch was created from `origin/main` at
  `0b0071b0ca6b8a3ea05ab7a5a3781706e51f3eff`.
- Post-merge reconciliation confirmed the merge commit is present on the
  default branch and the route, service, catalog data, UI, and documentation
  changes match the reviewed diff.

## Verification evidence

- `npm run pr:test` — 57 passed.
- `npm run docs:check -- --base origin/main` — PASS.
- `npm run docs:test` — 39 passed.
- `cd app && npm test` — 261 suites / 2,296 tests passed, including new
  `app/tests/assembly-starter-catalog.test.ts` (catalog invariants: 14 unique
  templates, CSI-coded assembly codes, distinct component keys, positive
  quantities) and extended `app/tests/assemblies-database.service.test.ts`
  coverage (tenant-scoped install, default quantities/ordering, missing
  mappings, inactive/cross-organization Cost Item rejection).
- `cd app && npm run lint` — passed.
- `cd app && npm run build` — passed.
- `cd web && npm test` — 280 passed.
- `cd web && npm run lint` — passed.
- `cd web && npm run build` — passed.
- `git diff --check` — passed.
- Final local `git status --short --branch` before publication was clean on
  `feat/costbook-assembly-catalog`.

## Checks blocked or not run

- `cd app && npm run test:integration` was not run. Treated as optional per
  repository preflight rules because this change introduces no schema,
  migration, RLS, auth, or request-session modification.
- Authenticated rendered-browser verification (desktop/mobile) was not run;
  no disposable authenticated tenant/browser fixture was available in this
  workspace. No deployment or production behavior was tested or claimed.

## Known limitations and follow-up

- The 14 starter recipes are reviewed TradeOS-authored defaults, not an
  exhaustive construction assembly database, and require estimator review
  for waste, production, access, code, permit, and project conditions before
  use in a live estimate.
- Supplied pricing datasets were not decomposed into invented assembly
  prices; the catalog remains price-free by design.
- Outstanding follow-up: authenticated owner/admin and read-only browser
  evidence at desktop and 390px mobile widths, trade-by-trade recipe
  expansion with provenance, mapping-quality review/version history, better
  Cost Item search for large catalogs, and future plan-takeoff integration.
