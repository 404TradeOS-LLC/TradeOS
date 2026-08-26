# TradeOS Knowledge Engine - Embedding Strategy

This document defines the strategy for generating, indexing, and updating vector embeddings across all construction knowledge assets.

---

## 1. Embeddings Scope
To enable dense semantic search, the following components must receive vector representations (1536-dimension vectors using `text-embedding-3-small` or equivalent models):

1. **Assemblies**: Embed `name`, `description`, `typicalUseCase`, and `proposalScopeOfWork` to match client requirements.
2. **Cost Items**: Embed `name`, `category`, and `notes` to match raw invoice details or specific contractor line requests.
3. **Proposal Language**: Embed standard inclusions, exclusions, and warranty clauses to verify contractual alignment.
4. **Crew Recipes**: Embed `name` and labor roles to identify crew mixes for specific project difficulties.
5. **Reasoning Notes**: Embed standard operating procedures (SOPs) and municipal guidelines to feed RAG loops.

---

## 2. Chunking & Metadata Strategies

### Cost Items & Assemblies
* **Chunking**: Treat each JSON record as a single discrete document. Do not split.
* **Metadata Schema**:
  ```json
  {
    "id": "item-uuid",
    "type": "cost-item | assembly",
    "category": "Concrete",
    "unit": "SF"
  }
  ```

### Rules & Reasoning Documents (Markdown)
* **Chunking**: Split by secondary headers (`##`). Maintain an overlap of 100 tokens.
* **Metadata Schema**:
  ```json
  {
    "filePath": "knowledge/reasoning/reasoning.md",
    "section": "matching-assemblies"
  }
  ```

---

## 3. Refresh & Update Strategy
Vector embeddings must remain synchronized with database changes:
1. **Incremental Updates**: When a cost item or assembly is updated or created, a background task automatically hooks into the database, calls the embedding API, and writes the new vector to the `embedding` column.
2. **Bulk Re-Indexing**: Triggers only when changing the embedding model version (e.g., upgrading from ADA to a newer open-source local model).
3. **Database Integration**: Run pgvector inside Supabase, mapping cosine similarity index queries over HNSW lists.
