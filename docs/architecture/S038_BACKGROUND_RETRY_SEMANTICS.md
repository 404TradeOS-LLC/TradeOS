---
status: implemented
owner: platform
last_verified: 2026-08-27
source_of_truth: true
related_docs:
  - docs/architecture/S038_BACKGROUND_RETRY_SEMANTICS_PLAN.md
  - docs/athena/10-events/README.md
  - docs/CURRENT_STATE.md
related_code:
  - app/modules/background/retry.ts
  - app/modules/athena-events/dispatch.ts
  - app/modules/supplier-integration/service.ts
  - app/modules/supplier-integration/scheduler.ts
  - app/modules/athena-observability/exporters.ts
---

# S038 — Background retry operator contract

This document records the repository-level retry contract implemented by S038.
It does not claim that a production scheduler or live failure rehearsal has
been configured. External cron, Kubernetes, or platform scheduling may invoke
the existing one-shot scripts again using the returned outcome metadata.

## Outcome matrix

| Surface | Success | Retryable failure | Terminal failure | Durable state / dedupe |
| --- | --- | --- | --- | --- |
| Athena event delivery | `succeeded` | `failed` with deterministic `nextAttemptAt` | `dead_letter` after five attempts | delivery row, dead-letter row, event/subscriber idempotency key |
| Supplier price sync | `succeeded` | `retryable_failure` with bounded `nextAttemptAt` | `terminal_failure` for rejected worker identity or client input | one org/supplier transaction advisory lock plus pending-proposal reconciliation; price changes still require approval |
| Observability export | result with `failed > 0` and safe reason code | external scheduler may retry the same read/export window | worker identity/configuration failure is reported with a safe code | telemetry read is tenant-scoped; exporters never mutate Athena execution state |
| Observability alerts/retention | existing per-job result or script failure | rerun the configured job | invalid identity/configuration remains visible as a safe failure | alert upsert and batched retention are re-runnable |

## Attempt metadata

Every scheduler outcome carries `attempt`, `correlationId`, and, on failure,
`failureCode` plus an optional `nextAttemptAt`. The common background contract
uses five attempts maximum and deterministic exponential delays beginning at
one second. The current one-shot scripts remain the retry boundary: they do
not sleep or create a second scheduler.

Athena subscribers receive `orgId`, the event correlation ID, a stable
`event:<event-id>:subscriber:<subscriber-id>` idempotency key, and the
one-based attempt number. A subscriber must use that key or the event ID when
protecting its own committed side effect. Delivery persistence remains the
source of retry/dead-letter truth.

## Safety boundaries

- Background database sessions still derive role and permissions from the
  worker's active organization membership.
- Supplier sync locks only the matching organization/supplier pair and never
  bypasses RLS or changes material prices automatically.
- Export and scheduler errors are reduced to bounded reason codes; raw error
  messages, stacks, prompts, tokens, and customer payloads are not persisted
  or emitted by these retry paths.
- No new queue, provider, scheduler product, migration, auth policy, RLS
  policy, billing behavior, customer messaging, or production credential was
  introduced.

## External evidence still required

Production operators must configure and exercise the existing scripts with
real worker identities, then retain scheduler logs and live failure/recovery
evidence. That is deployment/environment evidence and is intentionally not
fabricated by this repository implementation.
