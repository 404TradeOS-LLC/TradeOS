# TradeOS AI Reasoning Engine - Cost Item Ranking Rules

This document outlines the selection logic used by the Estimating Engine to choose individual cost items.

---

## 1. Matching Categories

### Exact Match
- **Definition**: The item name, category, and unit map exactly to the required specification.
- **Priority**: $1$ (Highest).

### Near Match (Substitution)
- **Definition**: The exact item is out of stock or unavailable, but a direct equivalent exists (e.g. replacing `#4 Rebar - Grade 60` with `#4 Rebar - Epoxy Coated` if grade 60 is specified but restricted by regional water-exposure rules).
- **Priority**: $2$.

### Fallback Match
- **Definition**: No specific item matches are found. The system falls back to a generic baseline item within the same category (e.g. `General Conditions - Laborer Rate`).
- **Priority**: $3$.

---

## 2. Prefences & Deprecations

### Deprecated Items
- **Rule**: Items marked with `deprecated: true` in metadata are filtered out of active searches. They remain in the database solely to support historical estimates and invoices.

### Preferred Items
- **Rule**: Items flagged with `preferred: true` (such as local regional wood species or standard 12/2 wiring) are ranked higher in search results to streamline estimator selections.

### Replacement Logic
- If an item is deprecated, the metadata must include a `replacedBy` UUID. The retriever automatically substitutes the old UUID with the new target UUID during retrieval.

---

## 3. Supplier & Regional Multipliers
- **Supplier Preference**: Prioritize cost items that map to wholesale suppliers offering bulk contractor discounts (e.g. Home Depot Pro, Ferguson).
- **Regional Pricing Hooks**: Apply local area cost factor multipliers ($F_{city}$) to baseline costs based on project zip code:
  \[\text{Local Cost} = \text{Baseline Cost} \cdot F_{city}\]
  Where $F_{city}$ is fetched dynamically from the regional cost multiplier index.
