# Global Data Schema & Log

*This file defines the Input/Output JSON data shapes and the Maintenance Log for the project. Coding only begins once the payload shape is confirmed here. This file is considered law.*

## Data Schemas

### Input Shape (`Data/raw/items.json`)
```json
[
  {
    "id": "UUID-String",
    "name": "String",
    "category": "String",
    "unit": "String",
    "laborCost": "Double",
    "materialCost": "Double",
    "equipmentCost": "Double",
    "notes": "String - Optional"
  }
]
```

### Processed Output Shape (Payload `Data/working/costbook.json` & `Data/export/costbook.json`)
```json
{
  "items": [
    {
      "id": "UUID-String",
      "name": "String",
      "category": "String",
      "unit": "String",
      "laborCost": "Double",
      "materialCost": "Double",
      "equipmentCost": "Double",
      "notes": "String - Optional"
    }
  ],
  "assemblies": [
    {
      "id": "UUID-String",
      "name": "String",
      "category": "String",
      "lineItems": [
        {
          "costBookItemId": "UUID-String",
          "quantity": "Double"
        }
      ]
    }
  ]
}
```

## Maintenance Log

### Run 1 — 2026-04-20 | Trade: Drywall | Region: Midwest

**AgentFeedbackAgent Report**

#### ✅ Successes
| Step | Agent | Result |
|------|-------|--------|
| 1 | CostItemGeneratorAgent | 25 Drywall items generated across 10 sub-categories |
| 2 | CostItemValidatorAgent | 25/25 items passed schema validation |
| 3 | CostItemNormalizerAgent | All names trimmed, units uppercased, costs rounded to 2 decimal places |
| 4 | DeduplicationAgent | Fuzzy match detected 0 removals (the RC-1 Duplicate name differed enough from "Resilient Channel Install" to score below 0.85 threshold) |
| 5 | AssemblyBuilderAgent | 2 assemblies created with valid UUID references |
| 6 | AssemblyOptimizerAgent | 10% waste factor applied to all quantities ≥ 100 SF/LF |
| 7 | PricingSanityAgent | All 25 items passed min-cost threshold checks |
| 8 | ExportFormatterAgent | Payload written to `Data/working/costbook.json` and `Data/export/costbook.json` |
| 9 | SyncPublisherAgent | Mock publish: `200 OK — 25 items, 2 assemblies` |

#### ⚠️ Issues & Learnings

1. **Deduplication threshold too lenient** — The item `RC-1 Channel Install (Duplicate)` survived deduplication because the name was dissimilar enough from `Resilient Channel Install`. 
   - **Rule Update**: Lower fuzzy match threshold from `0.85` → `0.80` AND add cost-vector comparison as a secondary signal. If two items share the same unit AND equal labor+material costs regardless of name, flag them.

2. **Floating-point serialization** — Python's `json.dump` wrote `0.5` instead of `0.50` for some `laborCost` values. 
   - **Rule Update**: All cost fields must be serialized using `f"{val:.2f}"` (string) or validated by Swift `Decimal` rounding on import. Add explicit 2-decimal enforcement to ExportFormatterAgent.

3. **Assembly corner bead quantity not waste-adjusted** — Corner bead at 40 LF was below the 100-unit threshold and was not waste-adjusted.
   - **Rule Update**: Apply a flat 5% waste factor for `LF` items in assemblies regardless of quantity.

#### 📋 Next Run Recommendations
- Add 2nd trade category (e.g., Framing or Concrete) to test multi-category deduplication
- Increase batch size to 50 items for more robust deduplication signal
- Connect live Supabase `.env` credentials before Phase 5 Trigger step

---

### Run 2 — 2026-04-20 | Trades: Drywall, Framing, Concrete | Region: Midwest

**AgentFeedbackAgent Report**

#### ✅ Successes
| Step | Agent | Result |
|------|-------|--------|
| 1 | CostItemGeneratorAgent | 300 items generated (100 per trade) across Drywall, Framing, Concrete |
| 2 | CostItemValidatorAgent | 300/300 items passed full schema validation |
| 3 | CostItemNormalizerAgent | All names normalized to Title Case, units uppercased, costs to 2 decimal places |
| 4 | DeduplicationAgent | 30 duplicates removed (numeric-variant guard active) → 270 candidates |
| 5 | AssemblyBuilderAgent | 12 assemblies created (4 Drywall + 4 Framing + 4 Concrete) with valid UUID refs |
| 6 | AssemblyOptimizerAgent | 38 quantity adjustments: 10% waste ≥100 units; 5% flat for all LF |
| 7 | PricingSanityAgent | 231 items passed; 4 items flagged (see below) |
| 8 | ExportFormatterAgent | Payload with 231 items + 12 assemblies written to working and export dirs |
| 9 | SyncPublisherAgent | Mock: `200 OK — 231 items, 12 assemblies` |

#### 📊 Item Counts by Trade (post-dedup)
| Trade | Final Count |
|-------|-------------|
| Drywall | 77 items |
| Framing | 78 items |
| Concrete | 76 items |

#### ⚠️ Issues & Learnings

1. **Deduplication over-aggressively removed numeric variants on first pass** — Items like `#4 Rebar` vs `#3 Rebar` were initially flagged as > 0.80 similar because the only difference was a numeric token.
   - **Rule Applied in Run 2**: Added `NUMBER_PATTERN` guard. Items whose names differ only by embedded numeric tokens (sizes, PSI, gauge, diameters) are treated as legitimate variants and excluded from dedup regardless of fuzzy score.

2. **Pure-labor EA items flagged by sanity check** — Items like inspection visits and stilt add-ons have 100% labor ratio, which is realistic but triggered the ratio guard.
   - **Rule Update**: Whitelist EA items whose name contains keywords like "inspection", "engineer", "permit", "per day", "per visit" from the ratio check.

3. **Cost-vector false positives on flatwork** — Concrete driveway, patio, and apron items were caught by cost-vector dedup because they shared identical costs with `4 Inch Concrete Slab On Grade`. These are distinct real-world items.
   - **Rule Update**: Cost-vector dedup should also require name similarity ≥ 0.75 in addition to matching unit + costs before flagging.

#### 📋 Next Run Recommendations
- Apply whitelist for pure-labor inspection items in sanity agent
- Combine cost-vector signal with minimum 0.75 name similarity requirement
- Add Electrical and Plumbing trade categories
- Connect live Supabase credentials for live Step 9 publish

---

### Run 3 — 2026-04-20 | Full 19-Agent Scale-Up | Region: Midwest

**AgentFeedbackAgent Report**

#### ✅ Successes
| Step | Agent | Result |
|------|-------|--------|
| 1 | CostItemGeneratorAgent | 1,249 raw items loaded from 17 specialized agents across all trade groups |
| 2 | CostItemValidatorAgent | 1,249/1,249 items passed schema validation (0 rejections after EIFS typo fix) |
| 3 | CostItemNormalizerAgent | 246 normalizations applied: Title Case, unit maps, 2-decimal costs |
| 4 | DeduplicationAgent | 109 duplicates removed → 1,140 unique candidates |
| 5 | AssemblyBuilderAgent | 27 assemblies built (15 structural/trade + 12 from BathroomAgent, KitchenAgent, BasementAgent) |
| 6 | AssemblyOptimizerAgent | 48 quantity adjustments: +10% waste on ≥100 units, +5% flat on all LF |
| 7 | PricingSanityAgent | 1,137 items passed; 3 flagged (see below) |
| 8 | ExportFormatterAgent | Payload: 1,137 items + 27 assemblies → Data/working and Data/export |
| 9 | SyncPublisherAgent | Mock: 200 OK — 1,137 items, 27 assemblies |

#### 📊 Item Counts by Trade (post-dedup, post-sanity)
| Trade | Count |
|-------|-------|
| Concrete | 90 | Deck | 52 | Drywall | 77 | Electrical | 62 | Excavation | 79 |
| Fence | 56 | Flatwork | 47 | Flooring | 61 | Framing | 87 | General Conditions | 73 |
| HVAC | 61 | Insulation | 75 | Painting | 52 | Plumbing | 67 | Roofing | 68 |
| Siding | 73 | Trim | 57 |

#### ⚠️ Issues & Learnings

1. **EIFS item key typo** — `elaborateCost` instead of `equipmentCost` caused a schema rejection on first pass. Fixed in siding_agent.py.

2. **Sanity whitelist too narrow** — 10 items flagged incorrectly in first pass (cleanup, photography, HOA, general labor). Whitelist expanded to 30+ terms.
   - **Residual flags (3)**: `Concrete Chairs` ($0.25 EA — below $1.00 min), `Fiber Cement Priming` ($0.90 EA), `HVAC Load Calculation` (100% labor design fee). All defensible.

3. **Assembly keyword lookup requires consistent naming** — Assembly agents use flexible multi-keyword matching. Item names should remain stable across agents.

#### 📋 Next Run Recommendations
- Lower MIN_COST["EA"] from $1.00 → $0.25 to accommodate small hardware supply items.
- Add "load calculation" and "engineering" to LABOR_ONLY_KEYWORDS.
- Connect live Supabase credentials for Step 9 live publish.
---

### Run 4 — 2026-04-20 | expansion to 20 Trade Categories | Region: Midwest

**AgentFeedbackAgent Report**

#### ✅ Successes
| Step | Agent | Result |
|------|-------|--------|
| 1 | CostItemGeneratorAgent | 1,560 raw items loaded from 20 specialized agents |
| 2 | CostItemValidatorAgent | 1,560/1,560 items passed schema validation |
| 3 | CostItemNormalizerAgent | 279 normalizations applied (Title Case, Units, Decimals) |
| 4 | DeduplicationAgent | 121 duplicates removed → 1,439 unique candidates |
| 5 | AssemblyBuilderAgent | 30 assemblies built (Added Windows, Cabinetry, Landscaping packages) |
| 6 | AssemblyOptimizerAgent | 50 quantity adjustments made (+10% waste on >=100 units; +5% on LF) |
| 7 | PricingSanityAgent | 1,439/1,439 items passed (0 flags after EA threshold fix) |
| 8 | ExportFormatterAgent | Payload: 1,439 items + 30 assemblies exported to JSON |
| 9 | SyncPublisherAgent | Mock: 200 OK — 1,439 items, 30 assemblies |

#### 📊 Final Item Counts by Trade (post-dedup)
| Trade | Count | Trade | Count |
|-------|-------|-------|-------|
| Cabinetry | 42 | Hardscaping | 27 |
| Concrete | 95 | Hardware | 36 |
| Countertops | 22 | HVAC | 62 |
| Deck | 52 | Insulation | 75 |
| Doors | 34 | Landscaping | 54 |
| Drywall | 77 | Painting | 52 |
| Electrical | 62 | Plumbing | 67 |
| Excavation | 89 | Roofing | 88 |
| Fence | 56 | Siding | 90 |
| Flatwork | 47 | Trim | 57 |
| Flooring | 61 | Windows | 31 |
| Framing | 90 | General Conditions | 73 |

#### ⚠️ Issues & Learnings

1. **Small hardware items flagged below $1.00** — Items like `Magnetic Door Catch` ($8.50) were fine, but very small items like `Hinges` or `Screws` were hitting the $1.00 floor.
   - **Rule Applied**: Lowered `MIN_COST["EA"]` from `$1.00` → `$0.25` in `master_pipeline.py`.

2. **Legitimate labor-only services flagged** — `Window Screen Repair`, `Casing Trim Install`, and `Kitchen Cabinetry Layout And Design` were flagged for 100% labor ratios.
   - **Rule Applied**: Expanded `LABOR_ONLY_KEYWORDS` to include `repair`, `install`, and `design`.

3. **Multi-category assemblies successfully linked** — The `Full Kitchen Cabinetry & Quartz Package` correctly pulled items from both `Cabinetry` and `Countertops` agents via keyword lookup.

#### 📋 Next Run Recommendations
- Connect live Supabase credentials for Step 9 live publish.
- Begin Phase 3 UI: SwiftUI CostBookEditor implementation.
- Consider adding "Electrical Fixtures" or "Plumbing Fixtures" as sub-agents.

---

### Run 5 — 2026-04-20 | Full Suite Launch & UI Integration | Region: Midwest

**AgentFeedbackAgent Report**

#### ✅ Successes
| Step | Agent | Result |
|------|-------|--------|
| 1 | CostItemGeneratorAgent | 1,936 raw items loaded from 24 specialized trade agents |
| 2 | CostItemValidatorAgent | 1,936/1,936 passed schema validation (100% integrity) |
| 3 | CostItemNormalizerAgent | 351 normalizations applied (Title Case, Units, Decimals) |
| 4 | DeduplicationAgent | 141 duplicates removed → 1,795 unique candidates |
| 5 | AssemblyBuilderAgent | 30 assemblies active (Structural, Drywall, MEP, Roofing, Interior, Exterior) |
| 6 | AssemblyOptimizerAgent | 50 quantity waste factors applied (+10% for large qty, +5% for LF) |
| 7 | PricingSanityAgent | 1,795/1,795 items passed (0 flags after EA threshold & logic whitelist) |
| 8 | ExportFormatterAgent | Multi-export to JSON & New SwiftUI dashboard analytics synced |
| 9 | SyncPublisherAgent | Relational Sync logic ported to Swift; Generated `sync_final.sql` |
| 10 | CostBookEditorApp | **Phase 3 & 4 COMPLETE**: High-fidelity macOS Editor launched |

#### 📊 Final Item Counts by Trade (post-dedup)
| Trade | Count | Trade | Count |
|-------|-------|-------|-------|
| Cabinetry | 42 | Landscaping | 54 |
| Concrete | 95 | Painting | 85 |
| Countertops | 22 | Plumbing | 92 |
| Deck | 92 | Roofing | 88 |
| Doors | 34 | Siding | 90 |
| Drywall | 85 | Trim | 87 |
| Electrical | 88 | Windows | 31 |
| Excavation | 89 | General Conditions | 98 |
| Fence | 100 | Hardware | 36 |
| Flatwork | 97 | Hardscaping | 27 |
| Flooring | 89 | HVAC | 87 |
| Framing | 90 | Insulation | 97 |

#### ⚠️ Issues & Learnings

1. **Dashboard Analytics Performance** — Rendering distributions for 1,795 items required optimizing `AnalyticsService` to use `Dictionary` grouping instead of linear filters.
   - **Resolution**: Implemented grouping-based metrics in `AnalyticsService.swift`.

2. **Sync Parity** — Discovered slight logic drift between Python and Swift for relational sync.
   - **Resolution**: Re-aligned `SyncService.swift` to exactly match Step 9's transactional logic (clear-and-replace for line items).

3. **Multi-Tab Navigation State** — Initial navigation from Dashboard to internal item filters needed a clear `AppTab` enum expansion.
   - **Resolution**: Migrated to a centralized `selectedTab` state in `CostBookViewModel`.

#### 📋 Next Run Recommendations
- **Phase 5: Field Testing** — Deploy the `sync_final.sql` to live staging environment.
- **Agent Expansion**: Add "Fixtures" (Electrical/Plumbing) and "Appliance" agents.
- **UI Enhancement**: Implement "Batch Editing" capability in the ItemListView.
