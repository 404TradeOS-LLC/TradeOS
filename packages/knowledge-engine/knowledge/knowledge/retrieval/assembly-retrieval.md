# TradeOS Retrieval Specs: Assembly Retrieval

This document outlines the standard retrieval methodologies used by the TradeOS AI Runtime to select contractor assemblies.

---

## 1. Retrieval Strategies

### Exact Match Lookup
* **Trigger**: Input matches a specific registered assembly slug or UUID (e.g. `large-tree-removal-chipping-hauling-stump-grinding`).
* **Execution**: Direct database index hit. Returns the full assembly document.

### Fuzzy Match Search
* **Trigger**: Text queries matching assembly names with minor variation (e.g., "large tree removal stump grind").
* **Execution**: Trigram fuzzy matching (`pg_trgm` in PostgreSQL) on assembly names. Similarity threshold $> 0.60$.

### Taxonomic Lookup
* **Trigger**: Category filter active.
* **Execution**: Limits the scope of candidate assemblies to the trade category matching the request (e.g., `category = 'Assemblies - Bathroom'`), excluding irrelevant items from search.

---

## 2. Hybrid Query Execution

The runtime matches assemblies using a tiered strategy:

```
[User Request]
      │
      ▼
1. Exact ID/Slug Lookup ───► Found? ──► [Return Assembly]
      │ No
      ▼
2. Taxonomic Filter (Limit candidate space)
      │
      ▼
3. Hybrid Search: Fuzzy Text Match (0.60) + Cosine Vector Similarity
      │
      ▼
4. Selection & Ranking (Apply matching scores)
```
