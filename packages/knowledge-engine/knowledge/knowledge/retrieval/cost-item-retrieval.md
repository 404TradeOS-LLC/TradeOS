# TradeOS Retrieval Specs: Cost Item Retrieval

This document outlines the retrieval mechanisms for selecting individual costbook items.

---

## 1. Matching Logic

### Exact Match
* **Trigger**: Exact matching on a cost item UUID (referential integrity check during assembly binding).
* **Execution**: Relational join or key-value lookup.

### Fuzzy Matching
* **Trigger**: Simple keyword or phrase query (e.g. "1/2 inch drywall hang").
* **Execution**: Levenshtein distance or pg_trgm similarity calculations. Ignores spaces and capitalization. Similarity threshold $> 0.70$.

### Fallback Search
* **Trigger**: No direct matches found for specific dimensions or materials.
* **Execution**:
  - Step 1: Query by category (e.g., "Siding").
  - Step 2: Extract unit type (e.g., "SF").
  - Step 3: Match to standard generic fallback item (e.g., "Fiber Cement Siding - Standard") and log warning.

---

## 2. Supplier & Regional Mapping
Cost items are linked to live supplier product matches via [schemas/supplier.schema.json](file:///Users/showb/TradeOS%20Costbook%20Editor/schemas/supplier.schema.json).
* **Selection Rule**: Choose suppliers offering products with matching unit sizes and lowest available cost per unit ($/SF or $/EA) within the contractor's region.
