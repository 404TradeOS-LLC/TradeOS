---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: false
---

# Athena Diagrams

## Platform Components

```mermaid
flowchart LR
  UI[TradeOS UI] --> Conversation[Athena Conversation Layer]
  Conversation --> Context[Context Engine]
  Context --> Router[Intent Router]
  Router --> Planner[Planner]
  Planner --> Action[Action Engine]
  Action --> Registry[Tool Registry]
  Registry --> FirstParty[First-Party Tools]
  Registry --> Plugins[Governed Plugins]
  FirstParty --> Services[TradeOS Application Services]
  Plugins --> Services
  Services --> Domain[Domain Logic]
  Domain --> Infra[Infrastructure]
  Services --> EventBus[Event Bus]
  Action --> Memory[Memory]
  Action --> Telemetry[Observability]
  EventBus --> Telemetry
```

## Approval Gate

```mermaid
flowchart TD
  Plan[Planner proposes action] --> Risk[Policy classifies risk]
  Risk --> Low{Low risk and allowed?}
  Low -- yes --> Execute[Execute automatically]
  Low -- no --> Medium{Medium risk?}
  Medium -- yes --> OrgPolicy[Evaluate organization policy]
  OrgPolicy --> NeedApproval{Approval required?}
  NeedApproval -- no --> Execute
  NeedApproval -- yes --> Confirm[Show confirmation]
  Medium -- no --> High[High risk]
  High --> Confirm
  Confirm --> Approved{Approved by permitted actor?}
  Approved -- yes --> Execute
  Approved -- no --> Stop[Stop with audit record]
```

## Business Lifecycle Events

```mermaid
flowchart LR
  LeadCreated --> EstimateStarted
  EstimateStarted --> EstimateCompleted
  EstimateCompleted --> ProposalSent
  ProposalSent --> ProposalViewed
  ProposalViewed --> JobApproved
  JobApproved --> JobScheduled
  JobScheduled --> TechnicianAssigned
  TechnicianAssigned --> TechnicianArrived
  TechnicianArrived --> WorkStarted
  WorkStarted --> WorkCompleted
  WorkCompleted --> InvoiceGenerated
  InvoiceGenerated --> InvoicePaid
  InvoicePaid --> WarrantyActivated
  WarrantyActivated --> MaintenanceDue
  MaintenanceDue --> CustomerFollowUpDue
```

## Service Boundary

```text
Athena
  -> registered tool
    -> TradeOS application service
      -> domain logic and validation
        -> infrastructure through approved service dependencies
```

Any design that routes around this boundary is not Athena-compliant.
