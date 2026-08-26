# TradeOS Retrieval Specs: Keyword Search

This document outlines the standard SQL full-text search (FTS) indices used by the database retrieval layer.

---

## 1. PostgreSQL Full-Text Search (FTS)
* **Columns Indexed**: `name`, `category`, `notes`.
* **Lexer / Stemmer**: English configuration (`english` search config).
* **Execution**: Matches keywords using tsvectors:
  ```sql
  SELECT id, name
  FROM public.cost_items
  WHERE to_tsvector('english', name || ' ' || notes) @@ to_tsquery('english', 'drywall & hang');
  ```

---

## 2. Trigram Indexing (Fuzzy Text Matching)
To handle user typos, misspelling (e.g. "drywal" or "concrete slab"), or punctuation mismatches:
* **Tool**: `pg_trgm` extension.
* **Index Definition**:
  ```sql
  CREATE INDEX cost_items_name_trgm_idx ON public.cost_items USING gin (name gin_trgm_ops);
  ```
* **Query Matcher**: Matches items based on similarity index:
  ```sql
  SELECT id, name, similarity(name, 'drywal hang') as sim
  FROM public.cost_items
  WHERE similarity(name, 'drywal hang') > 0.40
  ORDER BY sim DESC;
  ```
* **Performance Rule**: GIN trigram indices are preferred for leading and trailing wildcard searches (`LIKE '%term%'`).
