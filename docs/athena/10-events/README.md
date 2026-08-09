---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 10 - Event Architecture

Important business changes should emit events. Events make Athena proactive,
auditable, observable, and replayable without turning the assistant into the
source of business truth.

## Canonical Event Contract

Events follow [C008 Event](../contracts/README.md#c008-event-v100): stable name,
version, org ID, entity reference, actor, occurred time, payload, correlation
ID, idempotency key, and safe metadata.

## Canonical Business Events

| Event | Trigger | Example consumers |
| --- | --- | --- |
| `LeadCreated` | New lead/customer opportunity captured | Qualification prompt, owner briefing |
| `EstimateStarted` | Draft estimate opened or generated | Estimator assistant, missing-info checks |
| `EstimateCompleted` | Estimate marked ready/approved internally | Proposal preparation |
| `ProposalSent` | Proposal sent to customer | Follow-up timer, owner dashboard |
| `ProposalViewed` | Customer views proposal | Sales nudge, activity feed |
| `JobApproved` | Customer approval creates job-ready work | Scheduling recommendations |
| `JobScheduled` | Job receives schedule window | Dispatch board, technician notification |
| `TechnicianAssigned` | Technician assignment created | Field briefing |
| `TechnicianArrived` | Technician reaches site | Customer communication, activity |
| `WorkStarted` | Field work begins | Owner/dispatcher visibility |
| `WorkCompleted` | Field work marked complete | Invoice readiness |
| `InvoiceGenerated` | Invoice draft generated | Office manager queue |
| `InvoicePaid` | Payment recorded | Cash-flow briefing, closeout |
| `WarrantyActivated` | Warranty period starts | Warranty tracking |
| `MaintenanceDue` | Maintenance date approaches | Repeat-customer outreach |
| `CustomerFollowUpDue` | Follow-up SLA/date reached | Office/admin reminder |

## Publisher And Subscriber Rules

- Application services publish events after successful business state changes.
- Tools may request service actions but do not publish canonical events directly
  unless the service contract delegates that publisher role.
- Subscribers must be idempotent.
- Subscribers must not depend on hidden LLM reasoning.
- Failed subscribers do not roll back already-committed business state unless
  the service explicitly owns an atomic transaction.

## Versioning, Retries, And Replay

| Concern | Rule |
| --- | --- |
| Versioning | Add optional fields compatibly; breaking changes require a new major event version |
| Retries | Retry with exponential backoff and idempotency keys |
| Deduplication | Consumers dedupe by event ID or idempotency key |
| Replay | Replays preserve original occurred time and mark replay metadata |
| Ordering | Ordering is guaranteed only per aggregate where infrastructure supports it |
| Dead letter | Exhausted events enter a dead-letter queue with safe payload and failure reason |

## Example Event

```json
{
  "id": "evt_01HATHENA",
  "type": "ProposalSent",
  "version": "1.0.0",
  "orgId": "org_123",
  "entity": { "type": "proposal", "id": "proposal_456" },
  "actor": { "type": "user", "id": "user_789" },
  "occurredAt": "2026-08-09T14:30:00Z",
  "payload": { "projectId": "project_111", "customerId": "customer_222" },
  "correlationId": "req_abc",
  "idempotencyKey": "proposal_456:sent:v1"
}
```
