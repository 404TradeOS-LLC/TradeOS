# S034 Dispatch Observability Readiness Plan

Status: READY
Owner: platform
Dependencies: S030 and S031 (both DONE)

## Objective

Give dispatch owners, admins, and dispatchers an honest operational view of
current assignment pressure, schedule conflicts, and stale dispatch work so
they can identify and diagnose dispatch issues from the existing Dispatch
workspace.

## Bounded implementation contract

S034 is limited to a read-only observability surface over the existing Jobs
and activity contracts:

- expose the existing dispatch-attention signals together in the Dispatch
  workspace: unscheduled work, unassigned work, overdue work, and jobs needing
  attention;
- make conflict-related work diagnosable through the existing schedule-conflict
  preview/override contract and the existing attributed conflict activity;
- show recent, organization-scoped job dispatch activity when it is available,
  with explicit empty, loading, and error states;
- link each signal to the existing filtered dispatch queue or existing job
  detail/action surface so an owner can continue diagnosis;
- preserve the existing organization-timezone boundaries and the truthful
  `scope` label for non-manager job reads.

The implementation may add additive read-only response fields or a narrowly
scoped read route only if the existing routes cannot provide the contract. Any
new route must use the existing request context, service authorization,
organization scope, forced RLS, and read-only semantics. The implementation
must not duplicate the `needsAttention` predicate in a second policy source.

## Security and data invariants

- No cross-organization job, activity, conflict, or technician data is
  observable through the new surface.
- Existing manager roles remain `owner`, `admin`, and `dispatcher`; no role or
  permission is added or widened.
- Technician reads remain limited by the existing assigned-job/RLS behavior;
  the UI must not present a technician-scoped result as an organization-wide
  total.
- Conflict overrides remain owner/admin-only and continue to require a reason.
- Request-scoped transactions, forced RLS, activity attribution, advisory-lock
  conflict protection, and fail-closed errors remain unchanged.
- Identifiers and query parameters remain strictly validated.

## Explicit non-goals

S034 does not add failed-attempt persistence, alerting, notifications, email,
external metrics, dashboards outside Dispatch, background workers, retries,
new Job statuses, new roles or permissions, schema/migrations, RLS redesign,
route optimization, GPS, calendar/provider integration, billing, or S035/S037
scope. “Assignment failures” means current actionable assignment pressure and
surfaced conflict/action errors; durable historical failed-action telemetry
requires a separate retention and product-policy decision.

S027 authenticated Costbook browser evidence remains an independent blocked
lane and is not part of S034.

## Required verification

- focused Jobs service/controller tests for response shape, scope labeling,
  strict filters, and authorization behavior;
- focused activity/intelligence tests if the existing activity route is used;
- PostgreSQL/RLS tenant-boundary coverage for any new backend read path;
- Dispatch workspace contract and rendering tests for signal links, empty,
  loading, and error states;
- adversarial checks for wrong organization, insufficient role, forged job or
  activity identifiers, missing context, technician scope leakage, malformed
  filters, and conflict-override widening;
- `git diff --check`;
- `npm run pr:preflight -- --base origin/main`;
- `npm run pr:test`;
- `npm run docs:test`;
- `npm run docs:check -- --base origin/main`;
- applicable `(cd app && npm test && npm run lint && npm run build && npm run test:integration)`
  and `(cd web && npm test && npm run lint && npm run build)` checks.

## Completion evidence

Completion must record the exact implementation and completion-evidence PRs,
merge commits, changed behavior, tests and CI, tenant/RLS and authorization
validation, review findings and disposition, deferred durable telemetry, and
the final `origin/main`/S034 status. No production or authenticated browser
evidence may be claimed unless actually observed.

## Founder and external-dependency boundary

No founder decision or external credential is required for this bounded
current-state contract. A request to retain failed-action history, define
alert thresholds/recipients, or introduce a provider is outside this contract
and must stop for an explicit policy decision.
