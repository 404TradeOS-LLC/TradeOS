# TradeOS Knowledge Engine - Runtime Architecture

This document maps out the execution sequences and interfaces that connect intake parsing, knowledge retrieval, pricing reasoning, and estimating.

---

## 1. System Communication Map

```
                  ┌──────────────────────┐
                  │ Customer Intake (AI) │
                  └──────────┬───────────┘
                             │ (Parsed parameters)
                             ▼
                  ┌──────────────────────┐
                  │  Knowledge Retriever │
                  └──────────┬───────────┘
                             │ (Filtered candidates & rules)
                             ▼
                  ┌──────────────────────┐
                  │   Reasoning Engine   │
                  └──────────┬───────────┘
                             │ (Confidence scores & matches)
                             ▼
                  ┌──────────────────────┐
                  │    Assembly Matcher  │
                  └──────────┬───────────┘
                             │ (Selected Assembly ID)
                             ▼
                  ┌──────────────────────┐
                  │   Cost Item Matcher  │
                  └──────────┬───────────┘
                             │ (Linked unit cost items)
                             ▼
                  ┌──────────────────────┐
                  │  Proposal Generator  │
                  └──────────┬───────────┘
                             │ (Generated scope & terms)
                             ▼
                  ┌──────────────────────┐
                  │   Estimating Engine  │
                  └──────────────────────┘
```

---

## 2. Sequence Diagram

```mermaid
sequenceDiagram
    participant User as Estimator / Customer
    participant AI as AI Intake Agent
    participant KR as Knowledge Retriever
    participant RE as Reasoning Engine
    participant EG as Estimating Engine

    User->>AI: Sends scope (voice transcript or text description)
    AI->>AI: Extract parameters (dimensions, category, site difficulty)
    AI->>KR: POST /reason/scope {rawText}
    KR-->>AI: Return dimensions and constraints
    AI->>KR: POST /retrieve {query, category} (RAG query)
    KR-->>AI: Return candidate assemblies and taxonomy rules
    AI->>RE: POST /match/assembly {parsedScope, candidates}
    RE->>RE: Rank candidates (assembly-ranking.md)
    RE->>RE: Compute confidence score
    RE-->>AI: Return Selected Assembly ID & Confidence
    AI->>EG: POST /match/items {assemblyId, quantities}
    EG->>EG: Scale quantities & apply waste factors (rules.md)
    EG-->>User: Present Estimate + Scope + Exclusions
```
