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
  - docs/RBAC_MATRIX.md
  - docs/architecture/S041_RLS_POLICY_COVERAGE_INVENTORY.md
related_code:
  - app/prisma/schema.prisma
  - app/prisma/migrations/**
  - app/db/requestSession.ts
  - app/backend/routes/changeOrders.routes.ts
  - app/backend/routes/supplierDatabase.routes.ts
  - app/tests/**

# S041 — RLS Policy Coverage Audit

## Contract

S041 audits the complete Prisma/migration table inventory against the existing
forced-RLS tenant boundary, application role/permission contract, and runtime
request-session context. It repairs two established application-boundary gaps:

- change-order mutations require the existing `billing.write` permission;
- supplier mutations require the existing `costbook.manage` permission;
- SQL session role context preserves the raw supported role for RLS compatibility;
  legacy `estimator` and `viewer` inputs must not be normalized because the
  database policy vocabulary intentionally gives them narrower write/admin
  behavior than their application compatibility aliases.

RLS remains the database tenant-isolation floor. Application permission checks
remain the finer product authorization layer. This sprint does not redesign RLS
policies or change the schema.

## Required invariants

- Every Prisma model table and migration-created application table is explicitly
  classified as direct-tenant, parent-inherited, actor-scoped, control-plane, or
  raw-SQL-owned.
- Every classified table has evidence for `ENABLE ROW LEVEL SECURITY`,
  `FORCE ROW LEVEL SECURITY`, and its policy ownership or documented reason for
  a non-standard policy shape.
- `athena_action_idempotency` is explicitly recorded as raw-SQL-owned and
  remains forced-RLS protected.
- Authenticated routes never treat a caller-supplied organization identifier as
  authoritative.
- Technicians cannot mutate change orders or suppliers through HTTP; permitted
  roles retain access.
- Transaction-local `app.role` preserves the supported database role vocabulary;
  application-level `normalizeRole` compatibility remains available without
  widening database privileges.
- Cross-organization visibility and mutation remain denied by request-scoped
  forced RLS.

## Allowed implementation paths

- change-order and supplier route/controller permission seams;
- `app/db/requestSession.ts`;
- focused tests and audit fixtures under `app/tests/**`;
- this plan and required canonical governance documents.

## Forbidden paths

- `app/prisma/schema.prisma` or `app/prisma/migrations/**`;
- RLS-policy redesign or a new database policy migration;
- new roles, permissions, or changed role semantics;
- authentication-provider changes;
- billing/payment semantic redesign;
- production data or credential changes;
- broad authorization refactors;
- S027 browser evidence or S042+ work.

## Acceptance and verification

1. The table/policy inventory in `docs/architecture/S041_RLS_POLICY_COVERAGE_INVENTORY.md` is complete and has no unowned or ambiguous
   access path.
2. Focused controller tests prove technician denial and permitted-role success
   for change-order and supplier mutations.
3. Request-session tests prove legacy roles preserve their raw SQL role strings
   and do not widen RLS write or administration privileges.
4. Migration/RLS tests prove the forced-RLS floor remains intact, including the
   raw-SQL Athena idempotency table.
5. PostgreSQL integration proves cross-organization denial and same-organization
   permitted behavior for the changed surfaces.
6. Required repository checks pass:

   ```text
   git diff --check
   npm run pr:preflight -- --base origin/main
   npm run pr:test
   npm run docs:test
   npm run docs:check -- --base origin/main
   (cd app && npm test && npm run lint && npm run build && npm run test:integration)
   (cd web && npm test && npm run lint && npm run build)
   ```

## Founder and external-dependency boundary

Founder decision: RESOLVED for this bounded lane. Preserve RLS as the tenant
floor, use `billing.write` for change-order mutations, use `costbook.manage`
for supplier mutations, and preserve raw supported SQL session roles so legacy
RLS semantics remain fail-closed. Any future RLS-policy redesign or new role/
permission requires separate approval.

External dependency: no production database or browser evidence is required.
Disposable PostgreSQL integration is required for final implementation
evidence; authenticated S027 Costbook browser evidence remains independent.
