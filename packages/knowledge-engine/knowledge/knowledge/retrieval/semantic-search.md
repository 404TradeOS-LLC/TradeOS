# TradeOS Retrieval Specs: Semantic Search

This document outlines the guidelines for semantic context matching within the TradeOS estimating workflow.

---

## 1. Synonym Resolution
Estimatating requests are often written in plain contractor slang rather than database terms. The semantic search layer resolves these differences:

| Contractor Input | Database Term | Resolved Category |
|------------------|---------------|-------------------|
| "Greenboard" | "Moisture Resistant Drywall" | Drywall |
| "Mudding" | "Tape and Finish" | Drywall |
| "Type X" | "Firecode Type X Drywall" | Drywall |
| "Rebar grid" | "#4 Rebar Install" | Concrete |
| "Sheetrock" | "Regular Drywall Hang" | Drywall |
| "Canopy clear" | "Canopy Pruning" | Tree Service |

---

## 2. Contextual Resolution
* **Core Rule**: AI should interpret numerical expressions in the context of their units:
  * "12-inch pine tree" $\rightarrow$ `medium-tree-removal-chipping` (Matches 12" DBH constraint).
  * "100-foot fence" $\rightarrow$ Matches `LF` units.
* **Ambient Parameters**: If the user inputs "front yard with narrow gate", the retriever attaches the access constraint parameter (`access_restricted = true`) to filter out heavy excavator equipment.
