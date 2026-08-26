# TradeOS Retrieval Specs: Vector & Hybrid Search Plan

This document outlines the design for integrating dense vector embeddings and establishing a hybrid search architecture in the TradeOS Knowledge Engine database.

---

## 1. Vector Database Setup (pgvector)
We will leverage the `pgvector` extension in Supabase/PostgreSQL to store and index high-dimensional embeddings:
* **Extension Activation**:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
* **Embedding Dimension**: 1536 dimensions (matching OpenAI's `text-embedding-3-small` or `text-embedding-ada-002`).
* **Table Schema Updates**:
  ```sql
  ALTER TABLE public.cost_items ADD COLUMN embedding vector(1536);
  ALTER TABLE public.assemblies ADD COLUMN embedding vector(1536);
  ```
* **Index Configuration**: Use HNSW (Hierarchical Navigable Small World) index for fast approximate nearest neighbor search:
  ```sql
  CREATE INDEX cost_items_embedding_hnsw_idx ON public.cost_items USING hnsw (embedding vector_cosine_ops);
  ```

---

## 2. Hybrid Search Strategy
To leverage both exact keyword matches and semantic conceptual similarity, the retriever will execute a **Reciprocal Rank Fusion (RRF)** hybrid query:

```
                  ┌──────────────────────┐
                  │  Contractor Query    │
                  └──────────┬───────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
   Full-Text Search (FTS)          Vector Cosine Search
    (Trigram / tsquery)             (HNSW Similarity)
              │                             │
              ▼                             ▼
     Top K Keywords Rank            Top K Vector Rank
              │                             │
              └──────────────┬──────────────┘
                             ▼
                 Reciprocal Rank Fusion (RRF)
                             │
                             ▼
                  Consolidated Best Match
```

### RRF Scoring Formula
For each candidate item $d$:
\[RRF(d) = \sum_{m \in M} \frac{1}{60 + r_m(d)}\]
Where $M$ is the set of retrieval models (FTS and Vector), and $r_m(d)$ is the rank of document $d$ in model $m$.

This strategy guarantees that if a contractor searches for "drywall 1/2", exact matches receive maximum ranking, while searches like "sheets for wall partition" correctly surface drywall via semantic matching.
