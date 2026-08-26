# TradeOS AI Reasoning Engine - Assembly Ranking Rules

This document outlines the scoring algorithms used to rank multiple candidate assemblies for a given project scope.

---

## 1. Multi-Factor Scoring Formula
When a query matches multiple assemblies, the ranking engine computes a score ($R_{assy}$) from $0.0$ to $1.0$ for each candidate:

\[R_{assy} = \sum (Factor_{i} \cdot Weight_{i})\]

The components are defined as follows:

| Factor | Weight | Evaluation Criteria |
|--------|--------|---------------------|
| **Trade Match** | $0.25$ | $1.0$ if the assembly matches the scope's classified primary trade category. |
| **Scope Similarity** | $0.20$ | Cosine similarity between the assembly description and the parsed intake scope. |
| **Material Fit** | $0.15$ | Matches specified material tags (e.g. "concrete" or "composite"). |
| **Project Type Fit** | $0.15$ | Matches target segment (e.g., residential vs commercial). |
| **Difficulty Factor** | $0.10$ | Matches access constraints and site hazard parameters. |
| **Phase Alignment** | $0.10$ | $1.0$ if the assembly matches the active construction phase (e.g., site prep). |
| **Confidence Override** | $0.05$ | Multiplied by the engine's confidence rating of the source data. |

---

## 2. Score Resolution & Ties
1. **Selection**: The assembly with the highest $R_{assy}$ score is selected.
2. **Tie Resolution**: If two assemblies have equal scores (e.g. `medium-tree-removal` and `large-tree-removal` both score $0.78$ due to incomplete input dimensions), the system defaults to the **safer/higher-capacity fallback** to prevent under-estimating project costs.
3. **Alternative Display**: Candidates scoring $> 0.65$ but below the top rank are presented in the UI as "Alternative Options" for the estimator to manually select.
