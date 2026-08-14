---
status: current
owner: platform
last_verified: 2026-08-14
source_of_truth: true
related_code:
  - app/backend/controllers/athena.controller.ts
  - app/modules/athena-kernel/service.ts
  - app/modules/athena-permissions/**
  - app/modules/athena-action-engine/**
  - app/modules/athena-context-engine/**
  - app/modules/athena-tool-registry/**
  - app/modules/athena-approvals/**
  - app/modules/athena-audit/**
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260814120000_add_athena_approvals_and_audit_trail/migration.sql
---

# Athena Security Model

Athena is a server-side orchestration layer inside TradeOS. It is not an
alternate trust boundary. Every Athena request remains inside the same
authentication, membership, and database-session model as the rest of the app.

## Trust boundaries

1. HTTP caller to backend:
   bearer JWT verification and organization-membership resolution happen before
   Athena runs.
2. Backend to database:
   request-scoped database session plus forced RLS remain authoritative.
3. Kernel to tool execution:
   planner/model output is advisory only; server policy, approval, and
   validation decide what can execute.
4. Tool to domain service:
   tools call application services, never Prisma directly.

## Required security layers

- identity: authenticated user or explicit system actor only;
- tenant isolation: `orgId` is server-derived and carried through every Athena
  request, context provider, permission decision, audit event, and approval;
- permission policy: capability checks run outside the model through
  `athena-permissions`;
- object scope: when a tool declares `resourceScope`, Athena resolves
  job/customer/estimate/costbook-item scope before execution;
- approval gate: medium/high-risk actions fail closed unless a valid approval is
  presented;
- audit trail: request, context, tool consideration, action attempt, approval
  request, completion, and failure can be recorded with actor and organization
  metadata.

## Approval model

- `low` risk:
  may execute automatically after permission and security checks pass.
- `medium` risk:
  requires verified approval.
- `high` risk:
  requires verified approval plus durable audit evidence.

Approval records bind to exact action identity:

- organization
- user
- tool id and version
- risk level
- action id
- idempotency key
- canonical input hash
- plan id
- step id
- expiration window

Any mismatch, missing field, stale approval, future-dated approval, revoked
status, or unknown approval fails closed.

Before an organization-scoped approval list or detail read, overdue records that
are still persisted as `pending` are atomically transitioned to `expired` using
the same organization scope and a conditional pending-state predicate. This
prevents stale `pending` reads without overwriting concurrent grant/deny/revoke
transitions or rows owned by another organization.

## Audit events

Current event types:

- `request_received`
- `context_gathered`
- `tools_considered`
- `action_attempted`
- `approval_requested`
- `execution_completed`
- `failure`

Audit metadata must stay safe for logs and operator review. Secrets, raw model
prompts, bearer tokens, and unrestricted record payloads are forbidden.

## Allowed patterns

- resolve permissions from server-trusted actor context;
- pass exact granted permissions when already known;
- derive fallback permissions only from the raw stored TradeOS role, never from
  model output;
- use provider priority and activation policy to minimize context;
- treat denied or unavailable context as absence, not as license to widen scope;
- execute through existing domain services and their RLS-backed contracts.

## Forbidden patterns

- direct database access from Athena tools;
- trusting planner/model output for authorization, tenant choice, or approval;
- executing medium/high-risk actions without verified approval;
- reusing an approval across actor, org, input, plan, or step changes;
- fabricating context when a provider is denied, timed out, or failed;
- exposing sensitive customer, billing, or tenant data outside the scoped
  service boundary;
- hardcoding special-case roles into Athena business logic.

## Prompt-injection boundary

Prompt text, retrieved context, and model suggestions are untrusted input.
Athena may summarize or route on that input, but it may not:

- bypass permission checks;
- elevate risk classification;
- self-approve;
- change organization scope;
- skip schema validation;
- call a tool that the registry/policy/security layers deny.

## Remaining risks

- approval and audit persistence now exist in schema and store boundaries, but
  operational lifecycle UI and human review workflows are still follow-up work;
- non-Athena repo tests still rely on older `AuthContext` construction patterns,
  so compatibility fallback remains in the shared auth type;
- broader first-party context providers beyond dispatch/knowledge/memory are
  still framework-ready rather than fully wired to live module data.

## A12.1 transactional event security invariant

For the six required canonical business events, event persistence now participates in the same database transaction as the authorized business mutation. This does not move authorization into the event layer: identity, organization scope, permissions, object-scope checks, approval policy, service validation, and forced RLS remain authoritative before and during the mutation. A required event-persistence failure rolls the authorized business mutation back; it never creates a permission bypass or cross-tenant fallback. Subscriber delivery remains asynchronous after commit.
