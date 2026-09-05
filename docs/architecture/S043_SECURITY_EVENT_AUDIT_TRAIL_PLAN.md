---
status: ready
owner: security
last_verified: 2026-08-27
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/DOMAIN_MODEL.md
  - docs/athena/09-security/README.md
related_code:
  - app/modules/athena-audit/**
  - app/modules/athena-security/**
  - app/modules/athena-kernel/**
  - app/modules/auth/**
  - app/backend/middleware/auth.ts
  - app/prisma/schema.prisma
---

# S043 — Security event audit trail

## Readiness decision

S043 is ready. Its S037 and S040 dependencies are DONE, and the repository
already has a tenant-scoped `AthenaAuditEvent` model/store, safe security
decision metadata, request/trace/execution/action correlation, activity and
membership audit seams, and forced-RLS integration coverage. The implementation
can close event-coverage gaps over those existing records without creating a
second audit system.

## Bounded contract

Record and query meaningful authentication, tenant-boundary, privilege, and
sensitive-workflow security events using existing audit/activity seams. Every
record must carry server-derived organization and actor context where
available, a fixed event/reason vocabulary, correlation metadata, timestamp,
outcome, and only safe metadata. Reads must remain organization-scoped and
operator-authorized.

## Required invariants

- A security event never trusts organization, actor, role, or outcome fields
  from untrusted request payloads.
- Cross-organization access, inactive/invalid authentication, privilege
  denials, sensitive action attempts, and relevant successful outcomes are
  attributable and queryable without enumerating foreign records.
- Existing `AthenaAuditEvent`/`OrganizationMembershipAudit`/`ActivityEvent`
  ownership remains explicit; no parallel audit table or unbounded event sink.
- Metadata excludes raw prompts, model output, tokens, secrets, customer
  payloads, stack traces, and other private reasoning. Correlation IDs remain
  available for investigation.
- Forced RLS, existing RBAC/permissions, request-scoped sessions, route shapes,
  business transactions, and approval semantics remain unchanged.

## Allowed implementation paths

Existing `app/modules/athena-audit/**`, `app/modules/athena-security/**`,
Athena kernel/auth middleware and activity/membership audit emitters; focused
unit/controller/security/RLS tests; and required governance documentation.
Schema or migration changes are not expected. If implementation proves one
indispensable, stop at the repository's protected review boundary.

## Explicit non-goals

No SIEM/provider integration, new audit store, auth/RBAC redesign, new role or
permission, RLS-policy redesign, production data or credential work, legal or
billing semantics, S027 browser evidence, S036 index work, S038 retry work, or
S044/S045 deployment inventory.

## Verification contract

Focused audit/security/auth tests; safe-redaction and correlation assertions;
same-organization and cross-organization query/mutation evidence; inactive
identity and privilege-denial evidence; migration/RLS regression and disposable
PostgreSQL integration; `git diff --check`; repository docs/preflight tests;
and applicable app typecheck, unit, build, and integration checks.

## Founder and external-dependency boundary

Founder decision: NO for this bounded existing-store contract. A new retention
policy, SIEM/provider, role/permission policy, RLS redesign, or customer/legal
audit promise requires separate review. Production log shipping or SIEM wiring
is external deployment evidence and is not required to promote the repository
implementation lane.

