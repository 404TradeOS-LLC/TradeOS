# TradeOS Construction Knowledge Lab - Dashboard

This dashboard tracks the status, size, and health of the Construction Knowledge Lab dataset.

## Current Knowledge Metrics
* **Total Cost Items**: 1,795
* **Total Assemblies**: 40 (30 pipeline-built + 10 tree service assemblies)
* **Active Trade Categories**: 24

---

## Trade Coverage Matrix
| Trade Group | Category | Unique Items | Status | Last Checked |
|-------------|----------|--------------|--------|--------------|
| **Structural** | Concrete | 95 | Active | 2026-07-02 |
| | Framing | 90 | Active | 2026-07-02 |
| | Excavation | 89 | Active | 2026-07-02 |
| **Envelope** | Roofing | 88 | Active | 2026-07-02 |
| | Siding | 90 | Active | 2026-07-02 |
| | Insulation | 97 | Active | 2026-07-02 |
| | Windows & Doors | 31 | Active | 2026-07-02 |
| **MEP** | Electrical | 88 | Active | 2026-07-02 |
| | Plumbing | 92 | Active | 2026-07-02 |
| | HVAC | 87 | Active | 2026-07-02 |
| **Interior** | Drywall | 85 | Active | 2026-07-02 |
| | Painting | 85 | Active | 2026-07-02 |
| | Flooring | 89 | Active | 2026-07-02 |
| | Trim | 87 | Active | 2026-07-02 |
| | Cabinetry | 42 | Active | 2026-07-02 |
| **Exterior** | Deck | 92 | Active | 2026-07-02 |
| | Fence | 100 | Active | 2026-07-02 |
| | Flatwork | 97 | Active | 2026-07-02 |
| | Landscaping | 54 | Active | 2026-07-02 |
| | Tree Service | 0 (Assemblies Only)| Active | 2026-07-02 |
| **General** | General Conditions | 98 | Active | 2026-07-02 |
| | Hardware | 36 | Active | 2026-07-02 |
| | Hardscaping | 27 | Active | 2026-07-02 |
| | Countertops | 22 | Active | 2026-07-02 |

---

## Active Pipelines & Integrations
1. **Local Master Pipeline**: Run via `python3 pipelines/master_pipeline.py`
2. **Supabase Publishing Migration**: Relational SQL sync file available at [exports/sql/sync_final.sql](file:///Users/showb/TradeOS%20Costbook%20Editor/exports/sql/sync_final.sql)
3. **Draft Deliverable**: Available at [exports/json/costbook.json](file:///Users/showb/TradeOS%20Costbook%20Editor/exports/json/costbook.json)
