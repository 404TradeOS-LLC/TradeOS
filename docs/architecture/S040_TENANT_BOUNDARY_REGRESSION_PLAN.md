---
status: ready
owner: platform
last_verified: 2026-08-25
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
related_code:
  - app/tests/rls.integration.ts
  - app/tests/admin-dashboard-tenant-boundary.test.ts
  - app/tests/costbook.rls.integration.ts
  - app/modules/crm
  - app/modules/estimate-engine
  - app/modules/proposals
  - app/modules/invoices
  - app/modules/jobs
---

# S040 Tenant Boundary Regression Suite

## Contract

S040 expands the existing tenant-isolation evidence for the core contractor
workflow. The implementation must prove that an authenticated actor in
organization A cannot read, create, update, delete, or mutate organization B
objects through the application service/controller paths or the request-scoped
PostgreSQL session. Same-organization success remains covered so the suite
cannot pass by denying all access.

The contract is test-only. Existing organization-membership authorization,
request-scoped database sessions, and forced PostgreSQL RLS remain the security
model. No new access policy is introduced.

## Bounded coverage inventory

The implementation lane must cover the following critical object families,
using existing fixtures and test conventions wherever possible:

| Surface | Read boundary | Write boundary |
| --- | --- | --- |
| CRM / projects | customer, service address, project, and project-scoped object lookup | customer/project mutation and project-linked child creation |
| Estimating / proposals | estimate, estimate lines, proposal, and proposal queue reads | draft estimate/line mutation and proposal creation from a same-org project |
| Invoices / payments | invoice queue/detail and recorded-payment reads | invoice mutation and payment/reconciliation paths already exposed by the service |
| Jobs / dispatch | job, assignment, and dispatch-summary reads | assignment, schedule/reschedule, and named lifecycle mutations |
| Costbook | material, labor, equipment, assembly, and workspace reads | catalog/workspace writes already represented by existing RLS suites |

For each family, add the smallest missing regression assertions rather than
duplicating already-complete coverage. Tests must assert both:

1. cross-organization denial or empty visibility before a service write/query
   can affect the foreign object; and
2. same-organization behavior still succeeds for the permitted role.

## Evidence layers

### Application boundary

Use unit/controller tests for routes that accept object IDs or organization
parameters. Assert that the authenticated organization is server-derived,
foreign IDs are rejected or not queried, and the service is not invoked on a
denied request. Do not treat a caller-supplied organization ID as authoritative.

Use service tests where the existing service contract is the narrowest
behavioral seam. Preserve role checks and existing error/empty-result semantics.

### Database boundary

Extend app/tests/rls.integration.ts or the closest existing module-specific
RLS suite with two deterministic organizations and request sessions for the
same roles used by the module. Seed cross-organization objects through the
admin client only, then exercise the application client inside
runWithDatabaseSession or the established session helper.

The live suite must verify both reads and representative writes. Direct
cross-tenant foreign-key references must fail or remain invisible under the
existing RLS policies; the test must not bypass RLS with an admin client during
the assertion.

## Required invariants

- Organization context comes from the authenticated request/session.
- No route or service trusts a caller-supplied organization ID.
- Forced RLS remains enabled and is exercised through the restricted app role.
- Foreign objects are not returned, mutated, deleted, or linked successfully.
- A failed cross-organization operation does not create an audit/event side
  effect that claims success.
- Same-organization permitted reads and writes continue to work.
- Role restrictions remain distinct from tenant restrictions.
- Tests are deterministic, isolated, and safe to repeat in the disposable
  PostgreSQL integration database.

## Allowed paths

- app/tests/**
- narrowly required test fixtures/helpers under app/tests/**
- this readiness contract and required canonical governance documents

## Forbidden paths

- app/prisma/schema.prisma and app/prisma/migrations/**
- RLS policy or database-role redesign
- authentication, RBAC, or permission-policy changes
- production data, credentials, or environment changes
- runtime service/controller behavior changes unless a test exposes an
  established invariant regression that can be repaired without changing
  policy
- billing/payment semantic redesign, browser mutation evidence, S041+ work, or
  broad test-harness refactors

If the implementation exposes a genuine policy gap rather than a missing
regression test, stop at a reviewable finding and record the exact table,
policy, route, and decision required. Do not silently redesign the boundary in
S040.

## Validation and completion evidence

Focused validation must include the changed unit/controller tests and the
relevant PostgreSQL/RLS suite. Before merge, run:

~~~
git diff --check
npm run pr:preflight -- --base origin/main
npm run pr:test
npm run docs:test
npm run docs:check -- --base origin/main
(cd app && npm test && npm run lint && npm run build && npm run test:integration)
~~~

Record exact-head CI, review-thread disposition, and any environment-blocked
PostgreSQL evidence. S040 is complete only after its implementation PR is
merged and the completion evidence is reconciled on main; a green check or
open PR is not completion evidence.

## Founder decision and environment boundary

Founder decision required: NO. The requested proof follows the existing
organization-membership, request-session, and forced-RLS contract.

Production browser evidence is not part of S040 acceptance. The separate
authenticated estimate-to-proposal mutation proof remains environment/action
confirmation-blocked and must not be fabricated or folded into this sprint.
