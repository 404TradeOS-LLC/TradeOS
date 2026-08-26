# TradeOS Construction Knowledge Lab - AI Reasoning Engine

This document provides logical guidelines and cognitive patterns that TradeOS AI agents must use when reasoning about contractor data, assemblies, labor, and materials.

---

## 1. Matching Assemblies
* **Heuristic**: When matching a user request (e.g. "We need to clear out a dead oak tree in the front yard") to an assembly, the AI must extract physical variables and location constraints.
* **Reasoning Pattern**:
  1. **Identify the core trade**: In this case, "Tree Service".
  2. **Classify action/subcategory**: "Removal".
  3. **Extract parameters**: Oak tree is over 24" DBH (implies large tree removal) and located near the house (implies safety rigging and boom access).
  4. **Select closest fit**: Bind to `large-tree-removal-chipping-hauling-stump-grinding` rather than `medium-tree-removal-chipping`.
  5. **Parameter verification**: Ensure all `requiredInputs` (such as accessibility constraints) are prompted or estimated.

---

## 2. Selecting Materials
* **Heuristic**: Choose materials that align with structural durability, local building codes, and typical trade practices.
* **Reasoning Pattern**:
  - Always verify standard sizes and packaging units. Do not specify arbitrary quantities (e.g. purchase wire mesh in full rolls or square feet matching standard commercial dimensions).
  - Factoring in a minimum of 10% waste buffer for sheet and board materials (drywall, sheathing, siding) and 5% for linear items (pipes, trim, conduit).

---

## 3. Choosing Labor
* **Heuristic**: Labor allocation must match the complexity of the task and the required certifications.
* **Reasoning Pattern**:
  - Tasks involving height or risk (climbing trees, structural steel welding, high voltage wiring) must assign a senior, certified specialist (e.g. Certified Arborist, Licensed Electrician) alongside ground-level helpers.
  - Determine labor hours based on crew productivity rates (e.g. 1 arborist and 2 groundmen can clear 1 large tree in 6 hours).

---

## 4. Equipment Selection
* **Heuristic**: Equipment must align with site accessibility, tree/excavation size, and local environmental noise regulations.
* **Reasoning Pattern**:
  - If access width is $< 36$ inches (standard residential gate), flag and exclude heavy skid steers or high-capacity stump grinders. Re-route reasoning to manual transport or mini-equipment.
  - Pair equipment with fuel and haul-away charges.

---

## 5. Exclusions & Assumptions
* **Heuristic**: Exclude items that require separate trade licensing, post-project restoration, or have high site-condition variability.
* **Reasoning Pattern**:
  - **Exclusions**: Always exclude lawn restoration, underground sprinkler repair, utility line dropping, and painting of raw wood trims, unless explicitly requested.
  - **Assumptions**: Assume standard truck access within 50 feet, dry weather, stable soil, and no underground rock ledge or buried hazardous scrap metal.

---

## 6. Proposal Generation
* **Heuristic**: Translate technical line items into plain, professional scope descriptions.
* **Reasoning Pattern**:
  - Convert "Stump Grinding to 6\" below grade" into customer-facing text: "We will grind down the tree stump and clear away the wood chips to leave a flat surface ready for soil."
  - Maintain a strict hierarchy: Scope of Work $\rightarrow$ Inclusions $\rightarrow$ Assumptions $\rightarrow$ Exclusions $\rightarrow$ Warranty Terms.

---

## 7. Contractor Terminology Mapping
* **Heuristic**: Map common trade slang and regional jargon to canonical categories.
* **Reasoning Pattern**:
  - Map "Greenboard" $\rightarrow$ "Moisture Resistant Drywall".
  - Map "QuietRock" $\rightarrow$ "Soundproof Drywall".
  - Map "B&B" $\rightarrow$ "Balled-and-Burlapped".
  - Map "DBH" $\rightarrow$ "Diameter at Breast Height".

---

## 8. Confidence Scoring
The AI must calculate and output a confidence score ($C$) for every estimated cost or matched assembly using a weighted probability model:
\[C = 0.40 \cdot S_{site} + 0.40 \cdot S_{spec} + 0.20 \cdot S_{historical}\]

Where:
* $S_{site}$: Site Access clarity score ($0.0$ to $1.0$).
* $S_{spec}$: Specification clarity score (e.g. knowing exact DBH, tree species, material type).
* $S_{historical}$: Density of similar historical projects completed in the same zip code.

*Scoring Thresholds*:
* **$C \ge 0.85$**: Firm Quote (low risk).
* **$0.60 \le C < 0.85$**: Estimate with disclaimer (medium risk).
* **$C < 0.60$**: Informative budget range only; request human arborist site visit (high risk).
