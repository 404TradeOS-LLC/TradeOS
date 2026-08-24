---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: true
related_code:
  - app/modules/proposals/service.ts
  - app/backend/controllers/proposals.controller.ts
  - app/backend/routes/proposals.routes.ts
  - web/src/app/(app)/portal/proposals/[proposalId]/page.tsx
  - web/src/app/actions/proposals.ts
related_docs:
  - docs/modules/proposals.md
  - docs/modules/customer-portal.md
  - docs/API_REFERENCE.md
  - docs/WORKFLOW_LIFECYCLES.md
  - docs/RBAC_MATRIX.md
  - docs/SPRINT_BACKLOG.md
---

# S019 — Portal proposal acceptance flow plan

This document records the bounded S019 readiness contract. It authorizes a
future implementation lane to harden and prove the existing proposal review,
acceptance, decline, and audit boundary. It does not implement S019.

This readiness contract is promoted by governance-only PR #295; no S019
implementation branch is authorized by that PR.

## Mission

Make the existing authenticated portal proposal flow deterministic and
tenant-safe across viewing, acceptance, decline, lifecycle transitions, and
audit/event attribution. Preserve the existing Supabase session, protected
bearer API, server-derived organization context, request-scoped database
session, forced PostgreSQL RLS, and existing route/API shapes.

## Current baseline

- The portal already exposes proposal review at
  `web/src/app/(app)/portal/proposals/[proposalId]/page.tsx`.
- The existing page reads the proposal and project through the server-side
  session token and exposes view and accept actions; proposal PDF access uses
  the existing authenticated document path.
- Existing API routes are `GET /api/v1/proposals/:id`,
  `POST /api/v1/proposals/:id/mark-viewed`,
  `POST /api/v1/proposals/:id/accept`, and
  `POST /api/v1/proposals/:id/reject`.
- `ProposalsService` already scopes resource lookup by organization and
  records proposal delivery events for viewed, accepted, and declined
  transitions. Acceptance and decline also preserve the existing project
  status side effects.
- Existing controller permissions are `billing.read` for proposal reads and
  `documents.manage` for proposal mutations. S019 must revalidate this
  boundary against the authenticated portal actor; it must not silently widen
  privileges.
- The current `markViewed()`, `accept()`, and `reject()` service paths read a
  proposal status before an unconditional update. This is a concrete
  concurrency-risk baseline: competing transitions may both pass the guard or
  allow a later view update to overwrite an accepted result. S019 must
  reproduce and resolve this within the existing transaction boundary.
- S018 has completed the authentication and forced-RLS boundary hardening that
  S019 depends on. No S019 implementation PR, branch, or worktree overlap was
  found during live reconciliation.

## Authorized implementation contract

S019 may:

1. Add behavioral tests for authenticated portal proposal reads, view,
   acceptance, decline, invalid transitions, missing/inactive membership,
   malformed/expired/invalid sessions, and cross-organization IDs.
2. Prove same-organization access when the existing permission boundary allows
   it, and prove cross-organization denial at both the application and forced
   PostgreSQL RLS layers.
3. Verify that organization identity comes from authenticated server context;
   client-supplied project, organization, or proposal identifiers cannot switch
   tenancy.
4. Preserve actor attribution, organization attribution, proposal delivery
   events, project side effects, request-scoped transactions, and route/API
   shapes.
5. Make the smallest bounded runtime repair only when a reproduced defect is
   inside this existing proposal boundary. The known competing-transition race
   may be repaired with an atomic conditional transition or equivalent
   serialization using the existing request-scoped transaction architecture;
   no schema or policy redesign is authorized.

## Explicitly not authorized

S019 does not authorize:

- a new customer identity, login, invitation, magic-link, or portal-token
  model;
- public or unauthenticated proposal links;
- changing Supabase or the authentication provider;
- widening `documents.manage` or inventing a customer-specific permission;
- RBAC/RLS policy redesign, schema migration, token persistence, or new
  authorization policy;
- contract signing, invoice/payment behavior, document rendering, portal
  information architecture, or visual redesign;
- changes to proposal lifecycle vocabulary outside the existing canonical
  contract;
- S020, S021, S022, S027, or any other numbered sprint.

If customer self-service acceptance requires a different identity,
authentication, authorization, RBAC/RLS, or legal-signature policy than the
existing authenticated actor boundary, stop and prepare a founder-decision
packet. Do not infer or invent that policy in S019.

## Required implementation evidence

The implementation PR must include behavioral evidence for:

- unauthenticated, malformed, invalid, expired, and unsupported session
  requests failing closed;
- missing and inactive application membership failing closed;
- same-organization proposal reads and permitted mutations succeeding;
- cross-organization proposal reads and mutations failing closed;
- proposal-state guards for viewed, accepted, and declined transitions;
- competing view/accept/decline requests proving one valid transition wins and
  cannot leave status, project side effects, or delivery events inconsistent;
- correct actor/org attribution and proposal delivery-event persistence;
- forced PostgreSQL RLS independently denying cross-organization access;
- server-side session token propagation for the rendered portal page and
  mutation actions.

Required validation is `git diff --check`, repository preflight/tests/docs
checks, App unit/lint/build/integration lanes, and applicable Web
test/lint/build lanes. No database migration is expected.

## Stop conditions

Stop and report if the existing permission boundary is insufficient for the
intended actor and a new customer authorization policy is required, or if
completion requires a new identity model, token persistence, auth-provider
change, RBAC/RLS policy change, schema migration, legal-signature semantics,
or unavailable mandatory production evidence.
