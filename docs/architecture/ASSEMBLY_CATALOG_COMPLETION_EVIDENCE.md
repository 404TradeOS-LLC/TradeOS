---
status: complete
owner: costbook
last_verified: 2026-09-17
source_of_truth: true
related_docs:
  - docs/architecture/ASSEMBLY_CATALOG_IMPLEMENTATION.md
  - docs/modules/cost-book.md
  - docs/API_REFERENCE.md
  - docs/CURRENT_STATE.md
  - docs/SESSION_HANDOFF.md
related_code:
  - app/modules/assemblies-database/catalog.ts
  - app/modules/assemblies-database/service.ts
  - app/modules/assemblies-database/types.ts
  - app/backend/controllers/assembliesDatabase.controller.ts
  - app/backend/routes/assembliesDatabase.routes.ts
  - app/backend/routes/costbook.routes.ts
  - web/src/components/costbook/assembly-catalog.tsx
  - web/src/app/(app)/costbook/assemblies/page.tsx
---

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
