---
status: ready
owner: platform
last_verified: 2026-08-25
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/CURRENT_STATE.md
  - docs/SESSION_HANDOFF.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
related_code:
  - app/prisma/schema.prisma
  - app/prisma/migrations
  - app/backend/database
  - app/tests/rls.integration.ts
  - app/tests/costbook.rls.integration.ts
---

# S041 RLS Policy Coverage Audit

## Contract

S041 performs a repository-wide RLS coverage audit against the existing tenant model. It inventories every persisted table, classifies whether it is tenant-owned, global/reference, join/child, operational, or intentionally service-only, and reconciles that inventory against live migration-defined RLS enablement, FORCE RLS posture, policy predicates, application roles, request-scoped session behavior, and existing integration evidence.

The default output is evidence and tests, not policy redesign. If the audit exposes a genuine authorization gap, stop at a reviewable finding that names the table, policy, application path, exploit/impact boundary, and proposed repair. Do not silently widen or narrow authorization inside S041.

## Required inventory

For every Prisma-backed table and any migration-created table outside Prisma, record:

- table/model name and owning module;
- tenant key or justified global/service-only classification;
- whether RLS is enabled and forced;
- policy names and SELECT/INSERT/UPDATE/DELETE predicates;
- database/application role assumptions;
- request/session variables or helper functions used by the policy;
- direct service/controller access paths;
- existing PostgreSQL/RLS regression evidence;
- disposition: covered, intentionally exempt, ambiguous, or finding.

Child/join tables must be traced to the parent tenant boundary rather than assumed safe because they lack a direct organizationId column.

## Audit invariants

- Every tenant-owned table has an explicit, reviewable tenant-isolation story.
- FORCE RLS and policy coverage match the repository's request-scoped application-role assumptions.
- SELECT and mutation policies are evaluated separately; read coverage does not imply write safety.
- Caller-supplied organization identifiers are never authoritative over server-derived session context.
- Join/child access cannot bridge organizations through foreign keys or missing WITH CHECK predicates.
- Service-role/admin-only tables are explicitly justified and are not reachable through ordinary application sessions.
- Same-organization success remains provable so blanket denial cannot masquerade as tenant safety.
- Existing S040 regression evidence is reused rather than duplicated.

## Allowed paths

- docs/architecture/S041_RLS_POLICY_COVERAGE_AUDIT_PLAN.md
- a dedicated S041 audit/evidence document under docs/architecture/**
- app/tests/** for bounded audit assertions or inventory consistency tests
- small audit helpers/scripts under scripts/** when they are read-only and deterministic
- required canonical owner/governance documentation

## Forbidden paths

- app/prisma/schema.prisma changes
- app/prisma/migrations/** changes
- RLS policy creation/replacement/removal
- authentication, RBAC, membership, or permission-policy changes
- destructive database/data operations
- production credential/environment changes
- billing/payment semantic changes
- broad product refactors
- S042+ implementation
- S027 authenticated browser evidence

If a real policy defect is found, record it and stop before policy mutation unless a separately reviewed follow-up explicitly authorizes the repair.

## Required evidence

- deterministic schema-to-table inventory;
- migration/policy inventory for RLS enable/FORCE/policies;
- application-role and request-session mapping;
- table-by-table coverage matrix with explicit exemptions;
- focused PostgreSQL/RLS assertions for any previously ambiguous boundary that can be tested without changing policy;
- exact-head CI and review disposition.

## Validation

Before completion, run or obtain equivalent exact-head CI evidence for:

~~~
git diff --check
npm run pr:preflight -- --base origin/main
npm run pr:test
npm run docs:test
npm run docs:check -- --base origin/main
(cd app && npm test && npm run lint && npm run build && npm run test:integration)
~~~

## Founder and protected-boundary rule

Founder decision required: NO for the audit itself. Any proposed change to RLS predicates, database roles, authentication/session semantics, membership authorization, or other protected security policy must stop for separate review and authorization.

S041 is complete only when the audit evidence is merged, every table has a disposition, findings are explicitly tracked, and repository state is reconciled afterward. A green check or an open PR is not completion evidence.
