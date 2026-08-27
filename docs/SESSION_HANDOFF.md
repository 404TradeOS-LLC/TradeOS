---
status: current
owner: platform
last_verified: 2026-08-27
source_of_truth: false
related_code:
  - app/modules/athena-events/dispatch.ts
  - app/modules/athena-events/retryPolicy.ts
  - app/modules/athena-events/store.ts
  - app/db/requestSession.ts
  - app/modules/supplier-integration/worker.ts
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/architecture/S038_BACKGROUND_RETRY_SEMANTICS_PLAN.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

S037 is DONE. The next bounded mission is S038 — Background and retry
semantics. S027 remains independently BLOCKED only on authenticated rendered
Costbook evidence; S036 remains blocked by S027.

## Current truth

- `origin/main` is `16f8510fe0e609d6bf52c00cc3b0c72f9911feda` after the merged
  authentication refresh-session repair (#391) and invoice sell-price fixes
  (#390 and the related landed change).
- There are no open pull requests and no remote S038 branch in the live
  reconciliation. S037 implementation PR #386 and its completion evidence are
  merged.
- S038 readiness is promoted in the canonical backlog and bounded by
  `docs/architecture/S038_BACKGROUND_RETRY_SEMANTICS_PLAN.md`.
- Existing Athena event deliveries already provide durable idempotency,
  bounded retry/dead-letter state, replay checks, and safe failure reasons.
  Existing supplier and observability job entrypoints already use the
  tenant-scoped background session helper.
- Do not fabricate production scheduler, browser, or live failure evidence.

## S038 readiness contract

Standardize and verify retry outcomes, idempotency, safe failure recording,
correlation, and tenant-scoped background execution over existing Athena event,
supplier, and observability job seams. Preserve forced RLS, organization
authorization, existing business transactions, event contracts, and public
route shapes.

Forbidden: new queue/provider/scheduler platform, schema or migration unless
indispensable and separately reviewed, billing/payment changes, customer
messaging, auth/RBAC/RLS redesign, production credentials/deployment, S027,
S036, S043, or destructive data work.

## Next Eligible Sprint

Sprint ID: S038
Eligibility: READY; S037 is DONE, and live overlap reconciliation found no open PR or remote S038 branch.
Dependencies: S037 is DONE with merged readiness, implementation, and completion evidence.
Overlap check: Create only one `feature/s038-implementation` lane from current `origin/main`; keep S027 browser evidence, S036, and S043 independent.
Startup prompt: Read `docs/architecture/S038_BACKGROUND_RETRY_SEMANTICS_PLAN.md`, run the canonical startup and autonomy reconciliation flows, then implement S038 on its isolated branch/worktree.
