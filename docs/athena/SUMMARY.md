---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Athena Platform Bible Summary

Athena is a governed AI operating layer for TradeOS. It makes TradeOS feel like
one knowledgeable teammate while preserving hard system boundaries: the LLM
plans and explains, tools expose stable capabilities, application services own
business behavior, domain logic enforces rules, and infrastructure remains
hidden behind existing repository seams.

## Core Model

| Layer | Responsibility | Hard boundary |
| --- | --- | --- |
| Conversation Layer | User-visible assistant interaction | Shows one assistant, not internal agents |
| Context Engine | Immutable request context snapshot | No business decisions or writes |
| Intent Router | Classifies user intent and risk | Does not authorize actions |
| Planner | Builds an executable plan | Plan is advisory until policy approves execution |
| Tool Registry | Publishes available capabilities | Tools declare permissions, schemas, risk, and versions |
| Action Engine | Executes approved tool calls | Enforces approvals, idempotency, retries, and rollback |
| Memory | Stores durable preferences and facts | Source-attributed, correctable, deletable, auditable |
| Event Bus | Records important business changes | Versioned, replayable, deduplicated contracts |
| Security | Auth, RBAC, tenant isolation, policy | Enforcement lives outside the LLM |
| Observability | Logs, metrics, traces, cost, audit | Redacts secrets and PII by default |
| Plugin Framework | Future third-party extension boundary | Governed install, review, sandbox, and revocation |
| Application Services | TradeOS business APIs and modules | Sole owner of business execution |

## Required Contracts

The contract catalog lives in [contracts/README.md](contracts/README.md):

| ID | Contract | Purpose |
| --- | --- | --- |
| C001 | AI Context | Immutable request context snapshot |
| C002 | Tool | Registered executable capability |
| C003 | Tool Result | Standard result envelope |
| C004 | Planner | Plan shape and review semantics |
| C005 | Action | Approved executable action |
| C006 | Memory | Durable memory record |
| C007 | Permission | Capability and RBAC policy decision |
| C008 | Event | Canonical business event |
| C009 | Conversation | User-visible exchange state |
| C010 | Context Provider | Context source adapter |
| C011 | Telemetry | Observability record |
| C012 | Plugin | Future third-party extension package |

## Autonomy Model

| Risk | Default behavior | Examples |
| --- | --- | --- |
| Low | May execute automatically when policy permits | Draft messages, draft estimates, note organization, summaries, internal reminders, schedule preparation, reports |
| Medium | Requires contextual approval when organization policy, data confidence, or side effects require it | Reschedule internal work, update non-critical CRM fields, create internal tasks, suggest inventory reservations |
| High | Always requires explicit approval | Send invoices, issue refunds, change permissions, cancel jobs, change final pricing, commit contracts, send legally consequential communications, delete business data, place expensive orders, authorize overtime |

The risk model is enforced by the Action Engine and policy services, never by
trusting the LLM to self-police.

## Journey Rule

No person should have to re-enter information that another person already
supplied. Athena must carry context forward through Lead, Qualification,
Estimate, Proposal, Customer Approval, Scheduling, Dispatch, Field Execution,
Completion, Invoice, Payment, Warranty, Maintenance, and Repeat Customer.

## Implementation Posture

As of Friday, August 14, 2026, Athena is no longer doctrine-only. The current
repository implementation contains real A1/A3/A5/A6/A7/A10/A11/A12 foundations
in `app/modules/athena-*` and the feature-flagged HTTP entrypoint in
`app/backend/controllers/athena.controller.ts`.

Current implementation truth still belongs to [Current State](../CURRENT_STATE.md).
The Bible remains the architecture and contract owner; rollout plans stay in
`docs/athena/roadmap/**`.
