# S027 — Intelligent Costbook Production Readiness

Status: `DONE` — dedicated readiness pass and authenticated browser evidence are complete.

Baseline: `c7003f35006197e66e68ef3a45181f0f9d1732da` (`origin/main` at the final evidence run).

Current reconciliation head: `c7003f35006197e66e68ef3a45181f0f9d1732da` (`main`, merged PR `#474`). Earlier production replay evidence remains tied to its stated deployment; the fresh browser evidence is tied to workflow run `#22` on this head.

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
| Request-transaction acquisition regression evidence | PASS | PR `#273` merged the bounded acquisition-wait repair as `3de3f98`. PR `#274` then added a real PostgreSQL single-connection contention regression and hermetic timeout tests; exact-head `63e0031d23d3137f2c677c80761bd9a15fc10bb1` passed Docs consistency, Dependency review, and Verify repository before merge as `9800069`. Production replay remains a separate deployment evidence gate. |
| Production deployment and authenticated route replay | PASS | Vercel Production deployment `BQnTC3VzUij5TktsebTPYAda5Qrr` reached Ready on exact `main` commit `9d227a4`; `/health` reported that full SHA and `/ready` reported database status `ok`. An authenticated replay reached all nine Costbook routes, their API requests returned `200`, and exact-deployment logs showed zero warning, error, or fatal entries during the replay. |
| Authenticated rendered browser verification at 1440/1024/768/390 | PASS | GitHub Actions S027 run [#22](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/34192905774) checked out `main` at `c7003f3`, verified the RC Preview deployment identity, authenticated the sanitized smoke tenant, and passed all 36 route/viewport captures across 1440/1024/768/390px, including keyboard focus, equipment validation/create/edit/reload/delete, and pricing preview. The credential-scanned evidence artifact is [#10042902412](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/34192905774/artifacts/10042902412). |
| PostgreSQL/RLS integration execution | PASS | Prior prerequisite evidence: GitHub Actions Verify repository run `32449419590`, App integration tests job: 14 suites / 122 tests passed against the disposable PostgreSQL rehearsal database, including Costbook workspace, hierarchy, CostItem, equipment, and assembly RLS suites. PRs `#260`, `#273`, and `#274` independently passed their final-head PostgreSQL-backed verification; `#274` specifically exercises transaction acquisition under `connection_limit=1`. |
| Full backend/frontend test, lint, and build execution | PASS | GitHub Actions Verify repository runs `32449419590`, `32586823430`, and PR `#274` run `32587490086` passed the applicable backend/frontend lint, unit, build, and integration lanes. PR `#278` exact-head run `32611298220` also passed app typecheck, unit, build, and PostgreSQL integration/RLS lanes before the production deployment repair merged. |

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

The production database repair now has implementation, regression, deployment,
and replay evidence. Request-scoped database sessions use the bounded
acquisition wait from PR `#273`; PR `#274` proves a competing transaction can
wait past Prisma's former two-second acquisition window on a real PostgreSQL
single-connection pool; and exact `main` commit `9d227a4` completed an
authenticated production replay without transaction-acquisition `500`s.

## S027 evidence completion

The S027 evidence workflow uses the existing Beta smoke credentials to generate
a fresh tenant-verified session outside the repository. It requires an approved
non-production Preview host, sanitized smoke tenant, RC data-plane identifier,
and Vercel verification of the full deployed commit before and after capture.
The runner checks all nine routes at all four required widths, rejects HTTP-200
error shells, records visible keyboard focus, and exercises real equipment
validation/create/edit/reload/delete plus pricing preview. Only test equipment
created by that run is deleted. Failure artifacts are retained after a credential
scan; runtime session state is removed. Run `#22` passed the complete contract
and uploaded the redacted artifact; the S027 browser-evidence gate is closed.
Screenshot review: I reviewed all 52 PNG captures in artifact `#10042902412`,
including the nine routes across 1440/1024/768/390px plus equipment mutation
and pricing-preview checkpoints. Disposition: PASS. The captures show the
expected tenant-scoped empty/preview states, readable responsive layouts,
visible focus/error states, and no observed clipped content or horizontal
overflow at the required widths.

The bootstrap recognizes the responsive Control Dock More menu and can verify
the canonical organization ID through the authenticated settings API. S027
requires that ID; existing callers without it retain the organization-name
check. This carries forward the RC-proven authentication helper repairs from
`e937a1a`, `152a976`, and `84d8157` without changing application authentication.

The final browser run used the verified non-production Preview deployment
`dpl_GykcKwNNCi2hQWq8BKMjQapdQ7pM`, whose deployed frontend commit was
`023c097c31f7cbfe81d91b1135d9295ac3ed4d19`; the workflow itself ran from
`main` at `c7003f35006197e66e68ef3a45181f0f9d1732da`. This distinction is
recorded so deployment identity is not overstated; the merged head changed only
the reviewed candidate service surface, while the browser contract and deployed
Costbook frontend remained unchanged.

Authenticated production replay on 2026-08-23 covered `/costbook`,
`/costbook/materials`, `/costbook/labor-rates`, `/costbook/equipment`,
`/costbook/divisions`, `/costbook/cost-items`, `/costbook/assemblies`,
`/costbook/pricing`, and `/costbook/price-history` against Vercel Production
deployment `BQnTC3VzUij5TktsebTPYAda5Qrr`. All routes reached their real
API-backed empty or preview state after full initialization. Their Costbook API
requests returned `200`, and exact-deployment logs recorded no warning, error,
or fatal entries during the replay. This closes the production reliability
gate that the initial 2026-08-22 pass opened. Cold/concurrent requests were
still slow in this evidence window, with observed Costbook API latency up to
approximately 12.6 seconds; treat that as a performance follow-up rather than
evidence of a failed or incomplete response. The exact required viewport gate
is now closed by workflow run `#22`.

S027 is `DONE`. Production access and deployment inventory remain separately
tracked by S044/S045 and are not prerequisites for the completed browser-evidence
contract.

## Numbered-sprint sequencing

This readiness document does not select the next numbered sprint. Current
numbered-sprint eligibility and ordering are governed by
[`SPRINT_BACKLOG.md`](../SPRINT_BACKLOG.md) and the repository reconciliation
protocol. Do not use stale S007/S008/S009 sequencing from earlier S027 audits to
override the live backlog.
