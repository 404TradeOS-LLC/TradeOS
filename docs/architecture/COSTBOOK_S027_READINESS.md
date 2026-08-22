# S027 — Intelligent Costbook Production Readiness

Status: `PARTIAL` — dedicated readiness pass completed; promotion is not asserted.

Baseline: `06c48933a7ad17322bb36bdcbf10f4471a5d891f` (`origin/main` and the audit branch at task start).

## Current implementation inventory

The current repository contains tenant-scoped Costbook workspace, divisions,
categories, subcategories, materials, labor rates, equipment, CostItems,
assemblies, assembly components, pricing preview, material price audit/history,
estimate pricing snapshots, supplier feed proposals/review, Knowledge Runtime
matching, and review-first AI Estimate Assist. Canonical UI routes are present
for `/costbook`, `/costbook/materials`, `/costbook/labor-rates`,
`/costbook/equipment`, `/costbook/divisions`, `/costbook/cost-items`,
`/costbook/assemblies`, `/costbook/pricing`, and `/costbook/price-history`.

The Costbook API and database boundary use organization-scoped queries,
request-scoped database sessions, forced RLS policies, and Costbook-specific
permissions. Estimate lines persist source IDs plus unit/line-cost snapshots;
later catalog price changes do not rewrite existing estimate lines. Supplier
feeds create pending proposals and do not directly change Material pricing.
AI Estimate Assist applies accepted suggestions through `EstimateEngineService`
and does not write Costbook records.

## Requirement matrix

| Requirement | Result | Evidence / exact gap |
|---|---|---|
| Live tenant API-backed Costbook surfaces | PASS | Canonical routes and services exist; workspace/counts and catalog pages use authenticated API loaders. |
| Hierarchy integrity and active-parent rules | PASS | Organization checks in services plus hierarchy RLS/triggers and focused migration/RLS tests. |
| Materials/labor/equipment/CostItem/assembly CRUD | PASS | Canonical controllers, services, UI catalogs, lifecycle permissions, and focused tests exist. |
| Pricing preview and estimate snapshots | PASS | Shared formulas, assembly roll-up, persisted `unitCost`/`lineCost`, and snapshot tests exist. |
| Supplier review-first pricing | PASS | Feed proposals require human approval; this pass also made approve/reject claims atomic. |
| Review-first AI Estimate Assist | PASS | Accepted suggestions call `EstimateEngineService`; no autonomous Costbook writes. |
| Search/filter/sort/pagination as a production catalog contract | PASS (implementation) | Canonical Costbook catalog reads now use `{items,total,nextCursor}`, bounded opaque keyset cursors, deterministic `id` tie-breakers, server-side search/filtering, and allowlisted sorting. Legacy CostItem/Assembly search routes remain explicitly bounded typeahead compatibility adapters. |
| Catalog-query continuation verification | PASS | PR `#260` merged as `cb4ebed`; its required GitHub checks and PostgreSQL-backed integration rehearsal were green before merge. |
| Current production-repair exact-head verification | FOLLOW-UP GATE | PR `#273` merged as `3de3f98` after Docs consistency, Dependency review, full Verify repository, and the existing PostgreSQL rehearsal passed. A post-review follow-up must add the focused PostgreSQL transaction-contention regression before this repair is considered fully evidenced. |
| Authenticated rendered browser verification at 1440/1024/768/390 | PARTIAL | An authenticated production session rendered all nine Costbook routes at the cloud browser's actual 1363x936 viewport with no horizontal overflow and truthful tenant-scoped empty states after full loading. The first parallel startup pass also reproduced intermittent request-transaction acquisition `500`s, so this evidence correctly triggered a bounded runtime repair rather than promotion. Exact 1440/1024/768/390 renders remain unclaimed. |
| PostgreSQL/RLS integration execution | PRIOR PASS | Prior prerequisite evidence: GitHub Actions Verify repository run `32449419590`, App integration tests job: 14 suites / 122 tests passed against the disposable PostgreSQL rehearsal database, including Costbook workspace, hierarchy, CostItem, equipment, and assembly RLS suites. PRs `#260` and `#273` independently passed their final-head integration rehearsals; the focused single-connection contention regression remains a follow-up gate. |
| Full backend/frontend test, lint, and build execution | PASS | GitHub Actions Verify repository runs `32449419590` and `32586823430` passed the applicable backend/frontend lint, unit, build, and integration lanes for PRs `#260` and `#273`. |

## Concrete repair in this pass

Supplier approval and rejection now atomically claim a pending queue row with a
`status = 'pending'` predicate before any Material or audit mutation. A losing
concurrent reviewer receives `409` and cannot produce a second price mutation
or audit record. The transaction still rolls the claim back if the subsequent
Material update or audit insert fails. Regression coverage pins the claim and
fail-closed behavior.

The catalog continuation adds a shared query/cursor abstraction and migrates
the canonical material, labor, equipment, hierarchy, CostItem, assembly,
supplier-review, and price-history collection reads. Cursor tokens are bound to
organization, filters/search, sort, and direction; totals are calculated from
the complete filtered tenant query rather than the page predicate. Costbook
pages now submit server-side query criteria and expose bounded next-page
navigation.

## Smallest remaining S027 blockers

1. Production reliability gate: land the post-review PostgreSQL contention
   regression for the merged request-transaction acquisition-wait repair, then
   confirm its exact head passes required CI and repeat the authenticated
   parallel Costbook route load without acquisition-timeout `500`s.
2. Authenticated browser evidence: render and exercise the nine Costbook routes
   at 1440px, 1024px, 768px, and 390px, including keyboard focus and mutation/error
   states. This requires an available authenticated environment, not a product
   decision. PostgreSQL/RLS execution is independently verified by CI; that
   database evidence must not be treated as a substitute for rendered browser
   verification.

Authenticated production evidence on 2026-08-22 covered `/costbook`,
`/costbook/materials`, `/costbook/labor-rates`, `/costbook/equipment`,
`/costbook/divisions`, `/costbook/cost-items`, `/costbook/assemblies`,
`/costbook/pricing`, and `/costbook/price-history` at the cloud browser's actual
1363x936 viewport. All routes reached their real API-backed empty or preview
state without horizontal overflow after full initialization. Vercel runtime
logs from the initial parallel pass nevertheless recorded transaction-
acquisition `500`s on workspace, labor-rate, and settings reads. The merged
acquisition-wait repair must deploy and be re-exercised, and its focused
PostgreSQL contention follow-up must pass, before that production reliability
defect is closed. Exact required viewports remain the separate final promotion
gate.

S027 should remain `BLOCKED`/not promoted until those two gates are closed. The
remaining gaps do not require a founder decision; the post-merge browser gate
requires an authenticated rendered environment.

## Next five TODOs after S027

1. S007 — Project lifecycle normalization
2. S008 — Estimate lifecycle normalization
3. S009 — Proposal lifecycle normalization
4. S010 — Contract lifecycle normalization
5. S011 — Invoice lifecycle normalization
