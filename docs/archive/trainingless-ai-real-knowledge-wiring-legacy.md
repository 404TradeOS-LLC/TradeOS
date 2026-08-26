---
status: archived
superseded_by: docs/modules/ai-estimate-assist.md
do_not_use_for_implementation: true
---

# Trainingless AI Real Knowledge Wiring

## Goal

Wire TradeOS estimating assist to real structured knowledge without training, fine-tuning, vector search, or external AI calls.

## What now happens

1. The estimator enters scope text.
2. TradeOS runs the existing deterministic intake classifier.
3. The new `knowledge-runtime` module loads migrated Knowledge Engine files from disk.
4. The runtime searches trades, assemblies, cost items, taxonomy terms, keywords, descriptions, and metadata.
5. The matcher returns:
   - detected trade
   - matched assemblies
   - matched cost items
   - confidence score
   - rationale
   - missing inputs
   - human review warnings
6. AI Estimate Assist converts those matches into draft estimate suggestions.
7. The user still reviews everything manually.

## Why this supports trainingless AI estimating

This flow proves the TradeOS estimating UX can use real knowledge assets directly:

- local knowledge files instead of generic model memory
- deterministic ranking instead of probabilistic generation
- human review instead of auto-commit
- current app flows instead of a parallel demo-only system

## What remains intentionally out of scope

- model training
- fine-tuning
- embeddings
- pgvector
- RAG
- automatic DB import
- automatic estimate writes

## Safety posture

- file-based loading only
- read-only endpoints only
- no production knowledge mutation
- no schema migration
- no Supabase import
- no external model dependency

## Next evolution path

1. version the Knowledge Engine import boundary
2. add estimator feedback logging
3. connect approved suggestions to existing line-item add flows
4. add historical project retrieval after tenancy-safe storage is designed
