---
status: ready
owner: platform
last_verified: 2026-10-05
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/testing/FRONTEND_BACKEND_CONNECTION_MATRIX.json
  - docs/architecture/S041_RLS_POLICY_COVERAGE_INVENTORY.md
  - docs/RBAC_MATRIX.md
  - docs/ARCHITECTURE.md
  - docs/REPOSITORY_GOVERNANCE.md
related_code:
  - app/prisma/schema.prisma
  - app/prisma/migrations/**
  - app/db/requestSession.ts
  - app/tests/rls.integration.ts
  - app/tests/rlsMigration.test.ts
  - app/tests/customer-portal.migration.test.ts
  - app/tests/proposalsInvoicesContractsMigration.test.ts

# S073 — Release-Critical RLS Coverage Matrix Plan

## Outcome

S073 must produce an exact, reviewable security-evidence matrix for every
persisted resource exercised by release-critical S052-S060 workflows. A row is
complete only when the current database table is tied to its actual forced-RLS
policy evidence and to live PostgreSQL same-organization/cross-organization
behavior. Application `orgId` filters, controller mocks, or browser-only denial
are supporting evidence, never substitutes for the database boundary.

This sprint is proof-and-gap-ownership work. It does **not** authorize an RLS
redesign.

## Readiness reconciliation

- Dependency S051 is `DONE` through merged PR #538.
- Current `main` at readiness start is
  `37deee0bad44d8c3ca4ad65f7e89d15190d7cae3`.
- No open S073 pull request or remote branch was found.
- The S051 connection matrix already defines the release-critical journeys and
  their tenant expectations for Customer/Project, Estimate/Athena, Proposal,
  Contract, Job/Dispatch, Field, Invoice/Payment, Customer Portal, and Today.
- S041 established the repository-wide forced-RLS floor, but its inventory was
  last verified 2026-08-25. Current schema now includes later release-critical
  persistence such as `customer_portal_access_tokens` and
  `customer_portal_sessions`; S073 must rely on current schema/migrations and
  not treat the dated S041 inventory as sufficient certification.
- Current `app/tests/rls.integration.ts` already contains real PostgreSQL
  same-org/cross-org coverage for several critical resources, including
  Customer/ServiceAddress/Project, Estimate, Proposal/ProposalDelivery,
  Contract/ContractEvent, Job/JobAssignment, Invoice/Payment, ProjectTask, and
  ActivityEvent.
- Direct live RLS evidence is not currently present in that integration file for
  at least `customer_portal_access_tokens`,
  `customer_portal_sessions`, `estimate_line_items`, and
  `invoice_line_items`. Existing migration/source tests prove policy shape for
  some of these tables, but that is not equivalent to live database evidence.

## Authoritative resource discovery

The implementation must derive the S052-S060 resource set from current code,
not memory:

1. Start with the S051 journeys in
   `docs/testing/FRONTEND_BACKEND_CONNECTION_MATRIX.json`:
   `customer-project`, `scope-estimate`, `proposal-acceptance`,
   `contract-signature`, `job-dispatch`, `field-execution`,
   `invoice-payment`, `customer-portal`, and `today-command-board`.
2. Include persistence explicitly named by the S052-S060 backlog contracts
   (for example ServiceAddress even where the older S051 matrix groups it under
   Customer/Project).
3. Trace each current route/service action to every table it reads or writes
   when that table participates in tenant isolation for the journey.
4. Record shared resources once and reference all owning sprint/journey ids.
5. Exclude non-persisted Knowledge Runtime/file corpus data and purely derived
   values; explain every exclusion in the matrix.

## Required matrix fields

Each release-critical resource row must record:

- sprint/journey owner(s);
- Prisma model and PostgreSQL table;
- persistence role: primary, child/inherited, audit/delivery, portal identity,
  or shared read model;
- route/service owner;
- tenant source (direct `org_id`, parent inheritance, actor/customer scope);
- migration/policy source;
- explicit `ENABLE ROW LEVEL SECURITY` evidence;
- explicit `FORCE ROW LEVEL SECURITY` evidence;
- policy name(s) or bounded policy family;
- same-organization live PostgreSQL test;
- cross-organization live PostgreSQL test;
- role/assignment/customer-scope negative test when the policy is narrower than
  organization membership;
- current status: `COVERED`, `GAP`, or `NOT_PERSISTED`;
- blocking owner/test when status is `GAP`.

## Implementation scope

Allowed:

- a machine-readable S073 matrix under `docs/testing/`;
- a human-readable S073 evidence document under `docs/architecture/` or
  `docs/testing/`;
- a validator plus focused validator tests under `scripts/`;
- additive PostgreSQL-backed evidence in `app/tests/rls.integration.ts`;
- focused migration/source-contract tests when needed to pin the current forced
  RLS policy source;
- documentation required by `docs/DOC_OWNERSHIP.yml`.

Forbidden without a separate founder/security decision:

- `app/prisma/schema.prisma` changes;
- new or modified migrations;
- RLS policy redesign;
- new roles/permissions or broader role semantics;
- authentication/session-policy changes;
- weakening technician assignment or customer-portal scoping;
- application-filter-only certification;
- production database access, data mutation, or credentials;
- S074+ implementation.

## Gap handling

If live evidence reveals a missing/incorrect RLS policy, S073 must **not** hide
the failure by adding an application filter or mock. Mark the resource
`GAP`, name the exact failing test and owner, and stop policy repair at a
reviewable security boundary. Any migration or RLS-policy change requires a
separate protected decision/PR under repository governance.

## Acceptance

S073 is complete only when:

1. every persisted S052-S060 resource appears in the matrix;
2. every row has current forced-RLS migration/policy evidence;
3. every critical row has live PostgreSQL same-org and cross-org evidence;
4. narrower technician/customer-portal/actor scopes have the corresponding
   negative evidence;
5. no row is certified solely from controller filtering, mocks, or browser UI;
6. any gap has explicit blocking test ownership instead of being silently
   waived;
7. the matrix validator and focused tests pass;
8. repository-required App integration, App unit/build/typecheck, docs,
   dependency, governance, and branch-currency checks pass on the exact PR head.

## Verification commands

```text
git diff --check
npm run pr:preflight -- --base origin/main
npm run pr:test
npm run docs:test
npm run docs:check -- --base origin/main
cd app && npm test
cd app && npm run lint
cd app && npm run build
cd app && npm run test:integration
```

Web runtime changes are not planned. If implementation unexpectedly touches
`web/**`, run the full Web test/lint/build lane and stop to reconcile scope.

## Founder decision and merge boundary

Founder decision: **NO** for the bounded matrix, validator, and additive
disposable-PostgreSQL evidence described above.

Founder/security decision: **YES** if evidence requires any RLS policy,
migration, role/permission, authentication, portal-principal, or production
database change. In that case preserve the failing evidence and stop before the
protected change.

## Next five implementation tasks

1. Build the current S052-S060 resource inventory from the S051 matrix, backlog,
   route/service code, and schema.
2. Resolve each table to exact current migration/policy evidence and classify
   direct, inherited, actor-scoped, assignment-scoped, or portal-customer scope.
3. Add live PostgreSQL same-org/cross-org tests for uncovered critical tables,
   starting with portal identity, estimate line items, and invoice line items.
4. Add a deterministic matrix validator that fails on missing owner, forced-RLS
   evidence, live-test ownership, or unexplained gaps.
5. Run exact-head integration/repository checks, repair deterministic findings,
   and merge only if no security gap requires a protected RLS-policy change.
