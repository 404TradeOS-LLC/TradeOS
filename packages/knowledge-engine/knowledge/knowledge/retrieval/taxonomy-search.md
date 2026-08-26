# TradeOS Retrieval Specs: Taxonomy Search

This document outlines how the TradeOS Knowledge Engine utilizes the standard trade taxonomy for structured lookup and routing.

---

## 1. Taxonomic Navigation
All cost items and assemblies are structured under a strict two-tier taxonomy:
1. **Trade / Category**: (e.g. `Drywall`, `Plumbing`, `Concrete`).
2. **Subcategory**: (e.g. `Hanging`, `Finishing`, `Slabs`, `Fittings`).

---

## 2. Search Routing Workflow
When a text query or document is processed:
1. **Classifier**: The AI parses the text and identifies the primary trade and subcategory (e.g., "Need to run wiring for new wall outlets" $\rightarrow$ `Electrical` $\rightarrow$ `Rough-in Wiring`).
2. **SQL Route**: Executes a scoped database query:
   ```sql
   SELECT id, name, category, unit, labor_cost
   FROM public.cost_items
   WHERE category = 'Electrical' AND name ILIKE '%wiring%';
   ```
3. **Outcome**: Eliminates false positives from other trades (e.g., preventing plumbing "wires" or agricultural fencing ties from matching).
