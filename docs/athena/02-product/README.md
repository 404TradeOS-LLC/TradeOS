---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 2 - Product Requirements

## Primary Personas

| Persona | Primary job | Athena value |
| --- | --- | --- |
| Owner | Protect margin, cash flow, customer trust, and team throughput | Morning briefing, exception detection, approvals, business recommendations |
| Dispatcher | Convert approved work into reliable schedules and assignments | Conflict detection, schedule preparation, dispatch reminders, status summaries |
| Estimator | Turn scope into accurate, reviewable estimates and proposals | Scope extraction, costbook retrieval, draft estimate preparation, missing-info questions |
| Field Technician | Execute work safely with the right context | Job briefing, customer/history summary, field notes, completion checklist |
| Office Manager | Keep customer, document, billing, and follow-up workflows moving | Draft communications, document tracking, invoice/payment follow-up, admin reminders |

## Jobs To Be Done

- When a lead arrives, classify it, capture missing facts, and avoid duplicate
  customer records.
- When a scope is described, prepare a draft estimate using current TradeOS
  costbook and Knowledge Runtime context without committing pricing.
- When a proposal is ready, explain approval implications before sending.
- When a job is approved, prepare scheduling options and identify conflicts.
- When field work starts, surface job scope, photos, equipment, customer notes,
  and safety constraints.
- When work completes, prepare invoice-ready details and follow-up tasks.
- When warranty or maintenance dates approach, recommend outreach.

## Functional Requirements

| ID | Requirement |
| --- | --- |
| F001 | Athena accepts natural-language requests in authenticated TradeOS contexts. |
| F002 | Athena assembles immutable context before planning. |
| F003 | Athena routes work to registered tools only. |
| F004 | Athena classifies action risk before execution. |
| F005 | Athena automatically executes only low-risk actions allowed by policy. |
| F006 | Athena requires explicit approval for high-risk actions. |
| F007 | Athena records auditable action, event, and telemetry records for major work. |
| F008 | Athena stores long-term memory only with source attribution and deletion paths. |
| F009 | Athena supports proactive recommendations tied to events, deadlines, or risk. |
| F010 | Athena exposes future plugin/tool registration through governed contracts. |

## Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Security | All execution is tenant-scoped, permission-aware, and fail-closed. |
| Reliability | Tool execution is timeout-bounded, idempotent when retried, and auditable. |
| Performance | Context assembly uses freshness windows and avoids blocking on non-critical providers. |
| Privacy | PII and secrets are minimized, redacted from telemetry, and not stored in memory without purpose. |
| Observability | Requests, tool calls, approvals, and business events share correlation IDs. |
| Compatibility | Contracts are versioned and backward-compatible until deprecated. |
| Accessibility | Assistant UI supports keyboard navigation, clear labels, and visible approval states. |

## Autonomy Model

| Risk | Policy | Examples |
| --- | --- | --- |
| Low | May execute automatically where organization policy permits | Draft messages, build draft estimates, organize notes, generate summaries, create internal reminders, prepare schedules, generate reports |
| Medium | Approval depends on organization policy, data freshness, confidence, and operational impact | Reschedule internal work, update non-critical CRM fields, create internal tasks, suggest inventory reservations |
| High | Must require explicit approval every time | Send invoices, issue refunds, change permissions, cancel jobs, change final pricing, commit contracts, send legally consequential communications, delete customer or business data, place expensive orders, authorize overtime or payroll-impacting changes |

Risk enforcement happens in the Action Engine and policy services outside the
LLM. The planner can propose a risk classification, but execution trusts only
policy evaluation.

## Confirmation Model

Confirmations must show action type, affected record, financial/legal/customer
impact, actor, permission requirement, deadline sensitivity, rollback
availability, and exact button text. High-risk confirmation text cannot be
generated only by the LLM; templates must be service- or policy-owned.

## Memory Behavior

Athena may remember preferences, organization standards, project/job facts, and
conversation summaries when the memory contract allows it. Every memory record
needs source attribution, confidence, retention policy, correction path,
deletion path, and audit metadata.

## Extensibility Goals

Athena should support first-party tools immediately and third-party plugins
later. Extensibility must preserve versioned contracts, permission review,
capability scoping, sandboxing, telemetry, deprecation policy, and revocation.
