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
  - app/prisma/migrations/20260814200000_add_athena_action_idempotency/migration.sql
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
  metadata;
- action idempotency: dedup-eligible production actions use a durable
  organization/tool/version/key claim inside the same request-scoped RLS
  transaction as tool execution rather than process-local memory.

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

## Durable action idempotency

For tools that declare `required` or `optional` idempotency and receive an
explicit caller-supplied key, production A6 execution uses
`athena_action_idempotency` rather than the in-memory fixture.

The durable boundary enforces:

- uniqueness on organization + tool id + tool version + idempotency key;
- exact-actor visibility through forced RLS in addition to organization scope;
- actor identity derived from `current_app_user_id()` rather than caller data;
- persistence of the original completed action/result so a later process can
  suppress re-execution and return the original outcome;
- transaction coupling with the authenticated request database session, so an
  uncommitted reservation rolls back if the business mutation rolls back;
- fail-closed behavior if a peer actor collides with a key they do not own.

The in-memory idempotency store remains a unit-test/local fixture and is not
injected by the production Athena controller. This repair does not implement or
alter approval-bound action resume/execution.

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
- using a process-local idempotency store as the production dedupe boundary;
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

- approved-action continuation/resume is still a separate follow-up; this
  idempotency repair does not make approval-required actions independently
  executable from the live chat surface;
- non-Athena repo tests still rely on older `AuthContext` construction patterns,
  so compatibility fallback remains in the shared auth type;
- context providers remain intentionally bounded by currently implemented
  domains and selected-scope support rather than hydrating every recognized
  context section.

## A12.1 transactional event security invariant

For the six required canonical business events, event persistence now participates in the same database transaction as the authorized business mutation. This does not move authorization into the event layer: identity, organization scope, permissions, object-scope checks, approval policy, service validation, and forced RLS remain authoritative before and during the mutation. A required event-persistence failure rolls the authorized business mutation back; it never creates a permission bypass or cross-tenant fallback. Subscriber delivery remains asynchronous after commit.
