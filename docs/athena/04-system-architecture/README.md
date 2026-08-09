---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Volume 4 - System Architecture

Athena is a platform layer over TradeOS application services. It coordinates
conversation, context, planning, tools, actions, memory, events, permissions,
and observability without moving business logic into prompts or tools.

## Major Subsystems

| Subsystem | Responsibility | Must not do |
| --- | --- | --- |
| Conversation Layer | User-visible messages, approvals, citations, assistant state | Expose hidden planner/subagent internals |
| Context Engine | Build immutable request context from providers | Make business decisions or mutate data |
| Intent Router | Classify intent, domain, risk, and candidate tools | Authorize or execute actions |
| Planner | Produce a step plan using registered tools | Invent tools or bypass policy |
| Tool Registry | Store tool metadata, schemas, permissions, versions | Execute business logic itself |
| Action Engine | Execute approved tool calls with retries, idempotency, rollback | Trust LLM-only approval or risk claims |
| Memory | Read/write durable preferences and facts | Store unattributed or undeletable claims |
| Event Bus | Publish and subscribe to business events | Replace transactional application service behavior |
| Security | Enforce auth, tenant, RBAC, capability, approval, abuse policy | Delegate enforcement to prompts |
| Observability | Emit traces, logs, metrics, cost, audit records | Leak secrets, prompts, or unnecessary PII |
| Plugin Framework | Govern future third-party capabilities | Allow unreviewed arbitrary execution |
| Application Service Layer | Execute TradeOS business behavior | Allow direct LLM/database access |

## Component Diagram

```mermaid
flowchart TD
  User[User] --> Conversation[Conversation Layer]
  Conversation --> Context[Context Engine]
  Context --> Router[Intent Router]
  Router --> Planner[Planner]
  Planner --> Policy[Security and Approval Policy]
  Policy --> Action[Action Engine]
  Action --> Registry[Tool Registry]
  Registry --> Tool[Tool Adapter]
  Tool --> Service[Application Service Layer]
  Service --> Domain[Domain Logic]
  Domain --> Infra[Infrastructure]
  Service --> Events[Event Bus]
  Action --> Memory[Memory]
  Action --> Obs[Observability]
  Events --> Obs
```

## Request Lifecycle

```mermaid
sequenceDiagram
  participant U as User
  participant C as Conversation
  participant X as Context Engine
  participant P as Planner
  participant A as Action Engine
  participant T as Tool
  participant S as Application Service
  participant E as Event Bus
  participant O as Observability

  U->>C: Ask or approve
  C->>X: Build immutable context
  X-->>C: Context snapshot + freshness
  C->>P: Route and plan
  P-->>C: Candidate plan + risk
  C->>A: Execute if policy permits
  A->>T: Validated tool call
  T->>S: Service request
  S-->>T: Domain result
  S->>E: Business events
  T-->>A: Standard tool result
  A->>O: Trace, audit, metrics
  A-->>C: User-safe result
  C-->>U: Summary, warnings, follow-ups
```

## Architectural Invariants

- Athena never directly opens Prisma, SQL, Supabase, storage, queues, or
  infrastructure clients.
- Tools are adapters over application services, not business-rule owners.
- Application services enforce domain permissions, lifecycle transitions,
  tenant boundaries, validation, transactions, and events.
- The Action Engine handles idempotency, timeout, retry, approval, and result
  normalization.
- Context snapshots are immutable per request. Later provider updates require a
  new context version.
- Every consequential action has actor, organization, permission decision,
  input schema version, output schema version, action ID, telemetry ID, and
  audit trail.
