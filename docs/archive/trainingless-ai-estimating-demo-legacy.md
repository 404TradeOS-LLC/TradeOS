---
status: archived
superseded_by: docs/modules/ai-estimate-assist.md
do_not_use_for_implementation: true
---

# Trainingless AI Estimating Demo

This demo shows how TradeOS can draft an estimate without training a model, fine-tuning, embeddings, or external APIs.

## What "trainingless" means

The system does not learn from model weights. Instead, it combines:

- deterministic project intake
- existing trade taxonomy
- local Knowledge Engine exports
- rule-based assembly and cost-item matching
- confidence scoring
- human review before anything is committed

## Why this works

TradeOS already stores structured construction knowledge. The demo reuses that knowledge directly instead of asking a model to invent a plan from scratch.

For the sample scope:

> Remove a 60 foot oak tree, grind the stump, and haul away debris.

the demo can:

- classify the trade as tree service
- detect the removal / stump grinding / haul-away intent
- pull matching knowledge-book assemblies and cost items
- explain why each item matched
- flag missing inputs and safety concerns
- produce a draft that still requires human approval

## How Knowledge Engine replaces guessing

The Knowledge Engine provides structured, local costbook data:

- assemblies such as tree removal and stump grinding
- cost items such as debris haul-away and disposal
- taxonomy rules that keep matches in the correct trade
- reasoning notes for assumptions, exclusions, and safety

The demo uses those assets directly and ranks them with deterministic rules.

## How this later connects to LLMs, RAG, and pgvector

This demo is the no-ML baseline. Later, an LLM or retrieval layer can sit on top of the same data flow:

1. parse scope
2. classify trade
3. retrieve relevant knowledge
4. rank candidate assemblies and cost items
5. present a human review screen

Embeddings and pgvector can improve recall later, but they are not required to prove the workflow.

## Human review gate

Nothing is written into production data.
Nothing is auto-committed.
Every suggestion is a draft.

The estimator still confirms:

- diameter at breast height
- access constraints
- grind depth
- utility clearance
- haul-away quantity

## Limitations

- The demo is deterministic, so it does not understand open-ended language the way an LLM would.
- It uses local knowledge-book data only.
- It does not persist results.
- It does not modify Prisma or Supabase data.
- It does not yet perform semantic retrieval across historical jobs.

## Run command

```bash
npm run demo:trainingless-estimate
```
