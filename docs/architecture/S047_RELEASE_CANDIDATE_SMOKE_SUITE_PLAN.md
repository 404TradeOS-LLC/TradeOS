---
status: ready
owner: platform
last_verified: 2026-08-27
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/bible/VOLUME_4_EXECUTION.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/REPOSITORY_GOVERNANCE.md
related_code:
  - .github/workflows/rc-smoke.yml
  - app/scripts/authenticated-auth-smoke.mjs
  - app/scripts/authenticated-route-smoke.mjs
  - app/scripts/estimate-deliverability-golden.mjs
  - app/scripts/rc-business-flow-smoke.mjs
  - scripts/__tests__/rc-smoke-contract.test.mjs
  - app/package.json
---

# S047 — Release candidate smoke suite readiness

## Readiness decision

S047 is READY for implementation. Its dependencies S022, S028, S033, and
S040 are DONE with merged implementation and completion evidence. S044 and
S045 remain independently BLOCKED on production access; S046 is transitively
blocked by S045 and does not block this candidate.

## Bounded objective

Automate and document repeatable release-candidate smoke evidence over the
existing authenticated web and API surfaces for auth, customer, estimate,
proposal, contract, job, invoice, and portal flows. Reuse the existing
Playwright scripts, storage-state contract, artifact publication, route
contracts, domain services, forced RLS, and existing lifecycle semantics.

## Acceptance contract

- the smoke suite runs deterministically against an explicitly supplied
  deployment URL and authenticated storage state without committing cookies or
  credentials;
- an authentication scenario exercises successful login, rejected credentials,
  logout, and session refresh/expiry behavior using a dedicated non-production
  lifecycle account, separate from reusable storage-state accounts, without
  persisting secrets;
- route smoke covers founder-critical authenticated workspace routes and
  records status, final URL, body presence, and screenshots only for a
  sanitized non-production tenant;
- the golden workflow exercises the existing customer → project → estimate →
  proposal path with persisted edits, finalization, PDF availability, proposal
  acceptance, contract creation, and invoice creation;
- business-flow scenarios cover resource-backed contract, invoice, portal,
  Dispatch, and Field job boundaries without silently switching to top-level
  routes that do not exist; Field uses a technician storage-state fixture and
  must not pass on the static technician-role denial state;
- failures identify the route/workflow and publish safe machine-readable
  evidence artifacts, including the detailed golden report;
- documentation names required secrets/access, environment limits, rollback
  considerations, and the distinction between repository evidence and live
  deployment evidence.

The operator supplies `RC_E2E_STORAGE_STATE_B64`,
`RC_E2E_FIELD_STORAGE_STATE_B64`, `RC_E2E_LIFECYCLE_AUTH_EMAIL`,
`RC_E2E_LIFECYCLE_AUTH_PASSWORD`, and a deliberately invalid
`RC_E2E_LIFECYCLE_AUTH_REJECTED_PASSWORD` from the selected non-production
environment. The lifecycle account must be distinct from both storage-state
accounts because the logout step revokes refresh sessions.
The workflow sets mutation permission only for the guarded golden script and
does not offer production as a mutating target; the mutating script also
requires an approved `tradeos-costbook-web-*.vercel.app` host.

## Scope and non-goals

Allowed paths are the existing RC workflow/scripts, focused tests and fixtures,
workflow-safe documentation, and required owner docs. Do not add production
credentials, commit storage state, seed or delete customer data in a live
environment, change product behavior, alter schema/migrations/RLS/RBAC,
replace Playwright, redesign auth, claim launch approval, or implement S044,
S045, S046, S048, or S049.

## Verification and access boundary

Required validation includes focused script/config tests, app/web typecheck,
lint, builds, relevant integration/RLS checks, docs ownership/governance
checks, and an operator-triggered RC smoke run when an authenticated storage
state and deployment URL are available. The repository can prove script
contracts and artifact safety without production access; live authenticated
execution requires the scoped owner/admin and technician storage-state secrets,
the distinct lifecycle auth fixtures, and an explicitly selected approved
non-production deployment URL and test tenant. The workflow always publishes
available machine-readable reports, including failure reports, and includes
the detailed golden report directory in its artifact.
Production URLs must disable screenshot publication or apply an explicit
redaction control before any artifact upload. No founder decision is required for
this bounded verification contract. Founder approval of remaining product
risk belongs to later release/deployment governance and is not inferred here.
