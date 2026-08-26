# TradeOS Runtime - Caching Strategy

This directory houses temporary search caches, assembly models, and embedding indices to optimize real-time estimate generation performance.

---

## 1. Caching Modules

### Search Cache (`runtime/cache/search/`)
* **Purpose**: Cache standard keyword and taxonomy queries.
* **Duration**: 24 hours.

### Assembly Cache (`runtime/cache/assemblies/`)
* **Purpose**: Store compiled assembly templates and linked cost items.
* **Duration**: Persists until the database is updated.

### Item Cache (`runtime/cache/items/`)
* **Purpose**: Cache regional contractor baseline prices.
* **Duration**: 2 hours (invalidated dynamically on pricing index changes).

### Proposal Cache (`runtime/cache/proposals/`)
* **Purpose**: Store generated contract terms and exclusions.
* **Duration**: 1 hour.

### Embedding Cache (`runtime/cache/embeddings/`)
* **Purpose**: Store local query embeddings to avoid duplicate OpenAI API calls.
* **Duration**: 7 days.

---

## 2. Invalidation & Version Tracking Rules
1. **Dynamic Invalidation**: Any write action by the orchestrator or pipeline publisher (e.g. updating `costbook.json`) sends a broadcast signal that clears all caches.
2. **Version Checks**: The caching layer checks the schema version (`schemaVersion`) and commit hash of the master database. If a mismatch is detected, the cache is instantly flushed.
