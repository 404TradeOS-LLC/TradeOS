# TradeOS Estimating App - Runtime Pipeline Specification

This document outlines the real-time processing sequence that transforms customer input into formatted estimates and CRM records.

---

## 1. Runtime Pipeline Sequence

```
User Input (Voice, Photo, PDF, Text)
       │
       ▼
[AI Intake Layer] ──► Parse & extract parameters
       │
       ▼
[Trade Classifier] ──► Scopes trade category
       │
       ▼
[Retrieval & Matching] ──► Cosine/trigram search of assemblies & cost items
       │
       ▼
[Pricing Engine] ──► Apply regional multipliers and waste factor additions
       │
       ▼
[Reasoning Engine] ──► Formulate assumptions, exclusions, and warranty terms
       │
       ▼
[Confidence Scorer] ──► Score estimate certainty
       │
       ▼
[Validation Engine] ──► Schema and sanity constraints check
       │
       ├─────────────────────────┐
       ▼ (Confidence >= 0.85)    ▼ (Confidence < 0.85)
[Automatic Approval]      [Human Staging Review]
       │                         │ (Contractor override / edit)
       └──────────┬──────────────┘
                  ▼
         [Proposal Draft]
                  │
                  ▼
          [PDF Generator]
                  │
                  ▼
            [CRM Record]
```

---

## 2. Sequence Diagram

```mermaid
sequenceDiagram
    participant User as Estimator / Contractor
    participant App as TradeOS Mobile App
    participant RT as Runtime Engine (API)
    participant KE as Knowledge Engine Database
    participant CRM as TradeOS CRM / Sales Portal

    User->>App: Submits voice log / photo of site
    App->>RT: POST /runtime/intake {payload}
    RT->>RT: Run TradeClassifier & ScopeParser
    RT->>KE: Query assemblies and cost items matching category
    KE-->>RT: Return matching records
    RT->>RT: Calculate local rates (city index) & waste factors
    RT->>RT: Build assumptions & exclusions list (reasoning-engine)
    RT->>RT: Compute Confidence Score (confidence-engine)
    RT->>RT: Run schema and pricing checks (validation-engine)
    RT-->>App: Return estimate draft with confidence score
    User->>App: Click 'Approve & Send' (or edit/override)
    App->>CRM: Create client job, log logs, sync estimate invoice
    CRM->>User: PDF proposal sent to customer
```
