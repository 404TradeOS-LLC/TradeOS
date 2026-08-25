---
status: current
owner: platform
last_verified: 2026-08-14
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
| `estimates` | Selected estimate scope, status, totals, and bounded estimate context |
| `costbook` | Cost items, assemblies, supplier and regional pricing summaries |
| `knowledgeEngine` | Read-only Knowledge Runtime facts and retrieval metadata |
| `inventory` | Materials, reservations, order constraints |
| `notifications` | Unread alerts, reminders, follow-up queue |
| `telemetry` | Correlation IDs, trace IDs, model/tool budget hints |

## Live Today Versus Contract Surface

As of Friday, August 14, 2026, Athena recognizes the full contract surface
above. The production-readiness slice in PR #202 adds first-party customer,
estimate, and Costbook providers alongside the existing dispatch,
knowledge-engine, and memory provider seams. These providers remain bounded by
server-derived organization/user context, permission checks, selected resource
scope, and the existing Athena feature flags; merging the code does not by
itself prove that Athena is enabled in production.

- minimal request/organization/user/permissions/conversation/telemetry context
  is always available through the kernel;
- `dispatch` and `knowledgeEngine` are live provider-backed sections;
- `customers`, `estimates`, and `costbook` now have first-party provider
  implementations available to the live context registry;
- `memory` is a real provider registration seam but remains gated/dormant for
  ordinary runtime use;
- `workspace`, `dashboard`, `weather`, `calendar`, `inventory`, and
  `notifications` remain contract-recognized future sections.

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

## A12.1 transaction-boundary note

A12.1 does not widen or alter context acquisition. The transactional wrappers for the six required canonical business events reuse the same server-derived actor, organization, permissions, and selected resource scope already established before tool/service execution; the Context Engine neither starts those business transactions nor treats event persistence as authorization evidence.

## Approval expiry read boundary

Approval list/detail normalization is not Context Engine behavior: the approval service uses the already server-derived organization scope to atomically persist overdue `pending` approvals as `expired` before those reads, without widening context acquisition or authorization.

## Action idempotency boundary

Durable A6 idempotency is also downstream of context assembly. The Context Engine may carry an idempotency seed/reference in request context, but it does not claim or persist action keys. The Action Engine derives the final tool/version-qualified key after planning and policy, while the production idempotency store binds the database claim to the server-derived organization and current RLS actor inside the same scoped transaction as tool execution. Context freshness or model output never grants ownership of an idempotency record.

## Generation persistence boundary

S025 persists generation metadata after the kernel provider returns through a
separate application-service seam. Context assembly remains read-only and does
not persist raw prompts, model output, tool arguments, or tool results; review
provenance cannot authorize a business write outside the existing application
services.


## S028 boundary

Estimate-to-proposal verification in PR #338 uses the existing authenticated Athena context, permission, and audit/event seams. It does not authorize autonomous AI writes, provider changes, or cross-tenant context expansion.
