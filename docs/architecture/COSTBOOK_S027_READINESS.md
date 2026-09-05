# S027 — Intelligent Costbook Production Readiness

Status: `PARTIAL` — dedicated readiness pass completed; promotion is not asserted.

Baseline: `06c48933a7ad17322bb36bdcbf10f4471a5d891f` (`origin/main` and the audit branch at task start).

Current reconciliation head: `9d227a4345914dc4247629738e06ca631d2704ca` (`main`, merged PR `#278`). Production evidence below is tied to that exact deployed commit.

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
| Authenticated rendered browser verification at 1440/1024/768/390 | PARTIAL | After exact deployment, an authenticated production session rendered all nine Costbook routes at the cloud browser's actual viewport with truthful tenant-scoped empty or preview states. The cloud browser does not expose exact viewport emulation, so 1440/1024/768/390 rendering, keyboard focus, and mutation/error-state evidence remain unclaimed. |
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

## Smallest remaining S027 blockers

The S027 evidence workflow uses the existing Beta smoke credentials to generate
a fresh tenant-verified session outside the repository. It requires an approved
non-production Preview host, sanitized smoke tenant, RC data-plane identifier,
and Vercel verification of the full deployed commit before and after capture.
The runner checks all nine routes at all four required widths, rejects HTTP-200
error shells, records visible keyboard focus, and exercises real equipment
validation/create/edit/reload/delete plus pricing preview. Only test equipment
created by that run is deleted. Failure artifacts are retained after a credential
scan; runtime session state is removed. Runner implementation alone does not
close the gate: passing live evidence and reviewed screenshots are required.

The bootstrap recognizes the responsive Control Dock More menu and can verify
the canonical organization ID through the authenticated settings API. S027
requires that ID; existing callers without it retain the organization-name
check. This carries forward the RC-proven authentication helper repairs from
`e937a1a`, `152a976`, and `84d8157` without changing application authentication.

1. Authenticated browser evidence: render and exercise the nine Costbook routes
   at 1440px, 1024px, 768px, and 390px, including keyboard focus and mutation/error
   states. This requires an available authenticated environment, not a product
   decision. PostgreSQL/RLS execution is independently verified by CI; that
   database evidence must not be treated as a substitute for rendered browser
   verification.

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
evidence of a failed or incomplete response. Exact required viewports remain
the final promotion gate.

S027 should remain `PARTIAL`; promotion remains blocked until the exact
authenticated viewport gate is closed. The remaining gap does not require a
founder decision, but it does require an authenticated rendered environment
that supports exact viewport emulation.

## Numbered-sprint sequencing

This readiness document does not select the next numbered sprint. Current
numbered-sprint eligibility and ordering are governed by
[`SPRINT_BACKLOG.md`](../SPRINT_BACKLOG.md) and the repository reconciliation
protocol. Do not use stale S007/S008/S009 sequencing from earlier S027 audits to
override the live backlog.
