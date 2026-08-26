# TradeOS Construction Knowledge Engine - Costbook Coverage Audit Report

This report presents a thorough audit of the 1,795 costbook items and 30 assemblies in the master database, highlighting coverage strengths, gaps, and recommendations.

---

## 1. Database Summary Metrics
* **Total Cost Items**: 1,795 (Stable) + 25 (Staged in Review Queue)
* **Total Assemblies**: 30 (Stable) + 10 (Staged in Review Queue)
* **Active Categories**: 24 Master Trades + 1 Staged (Tree Service)

---

## 2. Counts by Trade

| Trade Category | Cost Items (Stable) | Assemblies (Stable) | Coverage Status |
|----------------|:-------------------:|:-------------------:|:---------------:|
| **Concrete** | 95 | 2 | Strong Items / Weak Assemblies |
| **Deck** | 92 | 0 | Strong Items / Missing Assemblies |
| **Fence** | 100 | 3 (Exterior group)| Strong Items / Partial Assemblies |
| **Flatwork** | 97 | 0 | Strong Items / Missing Assemblies |
| **Framing** | 90 | 3 (Structural group)| Strong Items / Partial Assemblies |
| **General Conditions** | 98 | 0 | Strong Items / Missing Assemblies |
| **Insulation** | 97 | 1 | Strong Items / Weak Assemblies |
| **Plumbing** | 92 | 3 (MEP group) | Strong Items / Partial Assemblies |
| **Siding** | 90 | 0 | Strong Items / Missing Assemblies |
| **Electrical** | 88 | 0 | Moderate Items / Missing Assemblies |
| **Excavation** | 89 | 0 | Moderate Items / Missing Assemblies |
| **Flooring** | 89 | 1 | Moderate Items / Weak Assemblies |
| **HVAC** | 87 | 0 | Moderate Items / Missing Assemblies |
| **Painting** | 85 | 1 (Interior group) | Moderate Items / Weak Assemblies |
| **Drywall** | 85 | 2 | Moderate Items / Weak Assemblies |
| **Trim** | 87 | 0 | Moderate Items / Missing Assemblies |
| **Cabinetry** | 42 | 0 | Weak Items / Missing Assemblies |
| **Countertops** | 22 | 0 | Weak Items / Missing Assemblies |
| **Hardscaping** | 27 | 0 | Weak Items / Missing Assemblies |
| **Windows** | 31 | 0 | Weak Items / Missing Assemblies |
| **Doors** | 34 | 0 | Weak Items / Missing Assemblies |
| **Hardware** | 36 | 0 | Weak Items / Missing Assemblies |
| **Landscaping** | 54 | 0 | Weak Items / Missing Assemblies |
| **Tree Service** | 0 (25 Staged) | 0 (10 Staged) | Staged Review |

---

## 3. High-Priority Gaps & Duplicate Risk
1. **Low Assembly Coverage**: Over $60\%$ of trades have $0$ assemblies, requiring estimators to build estimates from individual lines.
2. **Weak Specialised Items**: Cabinetry, countertops, and hardware items are sparse ($< 40$ items), missing crucial sizing parameters.
3. **Duplicate Risk**: Trigram indexing and SequenceMatcher fuzzy checks have successfully removed 141 duplicates; new staged items in `review/pending/` must run through deduplication before database merges.
4. **Labor/Equipment/Material Maps**: Base wage rates are statically coded; we need dynamic local area cost indexes ($F_{city}$).
