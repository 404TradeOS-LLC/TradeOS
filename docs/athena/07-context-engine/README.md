---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 7 - Context Engine

The Context Engine builds the shared immutable AI Context for one Athena
request. It gathers facts; it does not implement business logic, choose final
permissions, or mutate records.

## Required Context Sections

| Section | Purpose |
| --- | --- |
| `request` | Request ID, timestamp, channel, locale, idempotency seed |
| `organization` | Tenant identity, settings summary, policy flags |
| `user` | Authenticated user, role, membership, preferences |
| `permissions` | Current capability grants and denials |
| `workspace` | Current page, selected records, filters, UI state |
| `conversation` | Recent visible messages and conversation state |
| `dashboard` | Owner/dashboard alerts and metrics |
| `weather` | Weather conditions and forecasts relevant to work |
| `calendar` | Availability, appointments, blackout windows |
| `dispatch` | Jobs, assignments, conflicts, technician status |
| `customers` | Customer, address, equipment, agreements, notes |
| `costbook` | Cost items, assemblies, supplier and regional pricing summaries |
| `knowledgeEngine` | Read-only Knowledge Runtime facts and retrieval metadata |
| `inventory` | Materials, reservations, order constraints |
| `notifications` | Unread alerts, reminders, follow-up queue |
| `telemetry` | Correlation IDs, trace IDs, model/tool budget hints |

## Provider Contract

Context providers implement [C010 Context Provider](../contracts/README.md#c010-context-provider-v100).
Each provider declares owner, freshness, cache key, criticality, permissions,
timeout, and failure behavior.

## Freshness And Caching

| Freshness | Use |
| --- | --- |
| `live` | Required for approvals, permissions, pricing commits, invoices, contracts |
| `fresh` | Recently loaded and safe for summaries or drafts |
| `stale` | May inform questions but cannot drive consequential writes |
| `unavailable` | Provider failed or was denied; Athena must not fabricate facts |

Context snapshots include provider status and freshness per section. A later
tool execution that needs stronger freshness must revalidate through the
application service or policy layer.

## Partial And Degraded Context

Partial context is allowed for low-risk drafting, summaries, and questions when
missing data is named. It is not allowed for final pricing, contracts, invoices,
permission changes, deletion, refunds, or customer-visible legal/commercial
communications.

## Provider Failure Behavior

- Critical provider failure stops planning for dependent actions.
- Non-critical provider failure produces warnings and follow-ups.
- Permission-denied providers disclose only that access is unavailable.
- Timeout uses fallback cache only when freshness policy allows it.
- Provider errors are logged with correlation IDs and redacted inputs.
