---
status: current
owner: platform
last_verified: 2026-08-25
source_of_truth: true
related_code:
  - app/tests/rls.integration.ts
  - app/modules/estimate-engine/service.ts
  - docs/architecture/S040_TENANT_BOUNDARY_REGRESSION_PLAN.md
---

# S040 — Tenant boundary regression completion evidence

## Outcome

S040 — Tenant boundary regression suite is complete.

Implementation PR: #346  
Merge SHA: `6fb0596c6a865923627e621c0933033dad3c636b`  
Readiness PR: #345  
Readiness merge SHA: `fb4e8938f07f05997258039a37dd8905de1553f8`

## Shipped behavior

- The live PostgreSQL/RLS integration suite proves same-organization service access for CRM, estimates, invoices, and jobs.
- Cross-organization reads return the existing not-found behavior for those services.
- A cross-organization estimate update is denied and a same-organization read proves its tax value remains unchanged.
- The existing estimate parent-row mutation lock binds both estimate and organization identifiers as UUIDs, repairing the deterministic UUID/text failure exposed by the regression without changing authorization or RLS policy.
- No schema, migration, authentication, RBAC, billing, payment, or product-policy change shipped.

## Security and data evidence

- Assertions use restricted request-scoped application sessions, not the admin client.
- Same-organization success is asserted alongside foreign-organization denial, avoiding blanket-denial false positives.
- Existing organization authorization, forced PostgreSQL RLS, service boundaries, and DTO/API contracts remain authoritative.
- No production data operation or browser mutation was performed.

## Verification

- App unit tests: PASS
- App typecheck, lint, and build/dependency audit: PASS
- PostgreSQL/RLS integration and migration rehearsal: PASS — 137 tests passed
- Athena contracts and smoke: PASS
- Docs consistency, PR preflight, and autonomy reconciliation: PASS
- Sprint governance, dependency review, live documentation reconciliation, and branch currency: PASS
- Exact-head repository verification: PASS
- Review threads: actionable documentation finding resolved; no unresolved review threads remain.
- Local structural sprint suite: PASS — 9/9

## Evidence state

IMPLEMENTATION: COMPLETE  
REPOSITORY VERIFICATION: COMPLETE  
PRODUCTION/BROWSER VERIFICATION: NOT APPLICABLE TO S040 — no production mutation or browser claim was fabricated.

## Residual work

The authenticated estimate-to-proposal mutation proof remains environment/action-confirmation blocked; it is separate from S040 and is not claimed by this completion record. S027 remains blocked on authenticated rendered Costbook evidence. S041 remains PLANNED and requires its own governed readiness promotion.
