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

Required means Athena recognizes the section contract, not that every section is
loaded for every request. A1 uses only minimal request context. Business context
providers are activated later by intent, selected scope, permissions, and
freshness policy.

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

## Context Minimization

The Context Engine defaults to least context. It should pass references,
summaries, and scoped facts instead of full records whenever possible. Providers
must enforce:

- selected customer/project/job/page scope before loading tenant data;
- role, capability, object-level, and denied-field filtering before returning
  data;
- per-section `maxItems`, `maxBytes`, and estimated-token budgets;
- sensitivity classification and redaction before model, telemetry, memory, or
  plugin exposure;
- omission metadata when useful data exists but is withheld by policy, budget,
  or freshness.

High-PII sections such as customers, dispatch, invoices, notifications,
calendar, and memory-backed preferences are lazy and intent-gated by default.
They are not included merely because they exist in the organization.

## Selected Scope

Every context snapshot includes a selected scope derived from server-trusted UI,
route, conversation, or workflow state. Examples include `customerId`,
`projectId`, `jobId`, `estimateId`, `invoiceId`, and current page. Providers
must treat selected scope as a narrowing constraint, not authorization by
itself. Application services remain responsible for proving the actor can see
the selected record.

## Provider Contract

Context providers implement [C010 Context Provider](../contracts/README.md#c010-context-provider-v100).
Each provider declares owner, freshness, cache key, criticality, permissions,
timeout, and failure behavior.

Providers also declare activation mode:

- `eager_minimal`: safe low-PII metadata needed for nearly every request;
- `lazy_intent`: loaded only after router/planner intent requests it;
- `explicit_only`: loaded only after deterministic policy or user action asks
  for the section.

Provider output follows [C001 AI Context](../contracts/README.md#c001-ai-context-v100)
and includes status, source, sensitivity, freshness evidence, omitted fields,
size limits, and truncation reason where applicable.

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

Freshness evidence includes `fetchedAt`, `expiresAt`, `ttlMs`, `cacheHit`,
`sourceVersion` or `sourceHash`, and `revalidatedAt` when a tool strengthens a
snapshot for execution. Cached tenant data must be keyed by organization, actor
or service principal, permission snapshot, provider version, selected scope, and
input. Sensitive sections fail closed rather than using fallback cache unless
the cache key proves the same tenant, actor, scope, and permission snapshot.

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
- Provider failures never cause Athena to fabricate facts or silently widen
  scope to find substitute data.
