# TradeOS Knowledge Factory - Knowledge Gap Scanner

This document outlines the scan parameters used by the Knowledge Operations Manager to identify, flag, and classify gaps in the Construction Knowledge Engine.

---

## 1. Scan Parameters & Logic
The gap scanner operates by parsing the directories under `knowledge/` and evaluating metadata fill rates:

| Area | Check Rule | Gaps Status Class |
|------|------------|-------------------|
| **Trade Coverage** | Verify if all 25 whitelisted trades exist in `trade-progress.json`. | If missing $\rightarrow$ **Critical**. |
| **Assemblies** | Check if trade subcategories have linked assemblies. | If count $< 4$ $\rightarrow$ **Partial**; If count $= 0$ $\rightarrow$ **Missing**. |
| **Cost Items** | Verify total unique items count per trade. | If count $< 50$ $\rightarrow$ **Partial**; If count $= 0$ $\rightarrow$ **Missing**. |
| **Crew Recipes** | Verify crew mixes mapped per assembly. | If missing for heavy trades $\rightarrow$ **Critical**. |
| **Production Rates** | Verify output speeds matched to assembly items. | If missing $\rightarrow$ **Missing**. |
| **Materials/Labor/Equipment** | Verify spec mapping directories contain standard files. | If files empty $\rightarrow$ **Missing**. |
| **Proposal Language** | Verify scope/exclusion templates exist. | If missing $\rightarrow$ **Partial**. |
| **Safety/Permits/Inspections** | Verify compliance overlays are active. | If empty $\rightarrow$ **Partial**. |
| **Supplier Mappings** | Verify external SKU matches exist. | If mapping count $< 20\%$ $\rightarrow$ **Partial**. |

---

## 2. Gap Escalation & Workflow
1. **Detect**: The manager executes the scanner, compiling results to `runtime/gap-analysis.json`.
2. **Classify**: Assigns criticality labels:
   * **Critical**: Affects estimation safety or database integrity (e.g. missing labor base rates).
   * **Partial**: Staged or sparse coverage that limits regional scaling.
3. **Action**: Automatic generation of queue tasks to resolve critical gaps in the next run loop.
