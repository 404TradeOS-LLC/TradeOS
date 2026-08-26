# TradeOS Costbook Deduplication Rules

This document outlines the rules used to detect and eliminate duplicate cost items from the Costbook database.

## Fuzzy Match Deduplication
Two items in the same trade category are flagged as potential duplicates if they meet the following criteria:
1. **Fuzzy Score**: Name similarity score $\ge 0.80$ (measured via SequenceMatcher).
2. **Matching Unit**: The items share the exact same normalized unit.

## Numeric-Variant Guard (Exclusion Rule)
To prevent the accidental removal of actual product/service variants (such as concrete strength ratings, metal gauges, rebar numbers, or wood dimensions):
- Items whose names differ **only by numeric tokens** (e.g. numbers, sizes, PSI, gauge, diameters) are treated as **legitimate variants** and are **never** deduplicated, even if their fuzzy similarity score exceeds the threshold.
- *Example*: `#3 Rebar` vs `#4 Rebar` will both be preserved.

## Cost-Vector Deduplication
As a secondary signal to catch duplicate items that may have slightly different names but identical scopes:
- Two items are duplicates if they share:
  1. The same trade category.
  2. The same normalized unit.
  3. Exact equal `laborCost` and `materialCost`.
  4. A name similarity score of $\ge 0.75$.
- *Example*: If `Driveway Concrete Flatwork` and `Patio Concrete Flatwork` share identical costs and have a similarity of $\ge 0.75$, they would be flagged (unless they contain numeric differences).
