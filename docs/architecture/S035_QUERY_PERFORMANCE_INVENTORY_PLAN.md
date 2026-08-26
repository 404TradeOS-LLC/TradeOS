# S035 Query Performance Inventory Readiness Plan

Status: READY
Owner: platform
Dependencies: S007, S008, S009, S010, S011, and S012 (all DONE)

## Objective

Capture an evidence-backed inventory of slow or high-frequency query paths and
representative plans, then produce a prioritized optimization list for later
bounded work.

## Bounded readiness and implementation contract

S035 is an inventory and evidence sprint, not an optimization sprint. It may:

- map high-traffic service/controller paths to their Prisma/database query
  shapes and tenant/RLS predicates;
- identify repeated, unbounded, high-cardinality, nested-include, pagination,
  aggregate, and dashboard/work-queue query paths;
- run reproducible `EXPLAIN`/`EXPLAIN (FORMAT JSON)` evidence against an
  isolated local PostgreSQL fixture or another explicitly authorized non-
  production database;
- record representative row counts, join/filter/order behavior, existing
  indexes, and uncertainty in a prioritized inventory;
- identify candidate S036 index or later query-hardening work without making
  that change in S035.

The output must distinguish static code evidence, isolated-fixture plan
evidence, and unavailable production evidence. Plans must not include secrets,
customer data, raw tokens, or unrestricted production extracts.

## Security and data invariants

- Preserve existing organization predicates, request-scoped database sessions,
  forced RLS, and authorization boundaries while inspecting query paths.
- Do not bypass RLS or use elevated production credentials for convenience.
- Do not run write queries, migrations, index creation, `ANALYZE` against
  production, load tests, destructive tests, or unbounded data exports.
- Treat query text, plans, and captured parameters as potentially sensitive;
  redact identifiers and values in committed evidence.

## Explicit non-goals

No schema or migration changes, new indexes, query rewrites, ORM replacement,
runtime tracing, slow-query logging, production instrumentation, latency SLO
policy, load testing, provider work, application observability baseline
(S037), or S036 implementation. Production latency and plan claims remain
unavailable unless an explicitly authorized production evidence source exists.

## Required verification

- static inventory review for the highest-frequency Jobs, dashboard, queue,
  Costbook, invoice, activity, and authentication query paths;
- isolated PostgreSQL plan evidence where the repository fixture supports it;
- tenant/RLS predicate review for every prioritized path;
- redaction and reproducibility review of committed evidence;
- `git diff --check`;
- `npm run pr:preflight -- --base origin/main`;
- `npm run pr:test`;
- `npm run docs:test`;
- `npm run docs:check -- --base origin/main`;
- applicable app unit/integration and database verification commands.

## Completion evidence

Completion must record the exact inventory artifact, query paths reviewed,
plan/source evidence, ranking method, unavailable production evidence, review
findings, deferred S036 candidates, CI, and final repository truth. It must not
claim measured production performance unless that evidence was actually
authorized and observed.

## Founder and external-dependency boundary

No founder decision is required for the bounded repository/isolated-fixture
inventory. Production database access, a latency budget/SLO, or authorization
to capture real customer workload evidence would be an external or policy
boundary and must remain explicitly unavailable rather than inferred.
