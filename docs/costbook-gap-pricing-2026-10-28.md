# Costbook Gap Pricing Proposal — 13 Unpriced Assemblies (2026-10-28)

> **Status: PROPOSAL ONLY — NOT WIRED INTO ESTIMATING.**
> This document prices the assemblies that PR #772 left fully unpriced. It does **not**
> modify `app/modules/costbook/pricedAssemblies.ts` or any rollup. The 63 original
> rollups and the 75 priced assemblies on main are untouched by this proposal.
> No price in this document has been used in a bid. **Every new price below carries a
> REVIEW-BEFORE-BIDS flag and must be re-verified against a live supplier quote
> before it appears in any customer-facing estimate.**

## 1. Scope correction: 13 gaps, not 11

The authorizing idea described "11 unpriced assemblies," but the merged record does not
support 11. PR #772's body states "75 partially priced assemblies and 13 unpriced
assemblies," and a direct count of `ASSEMBLY_MATERIAL_COSTS` on main confirms it:
**88 rollups = 13 fully unpriced (`pricedComponents = 0`) + 59 partially priced + 16 fully
priced.** This proposal covers all **13** fully-unpriced assemblies. Dropping two to force
the number 11 would have meant guessing which two to omit, so the full list is priced
(or given a documented reason) below. The reviewer may trim the list at review time;
nothing here is merged, so no harm is done by the wider scope.

Recipe quantities below are taken verbatim from `app/modules/costbook/tradeosAssemblies.ts`
on main. Where a rollup's `totalComponents` count differs from the recipe's component
count (mini-split, standing seam, spray foam, waterproofing, trench excavation), the
recipe count governs — the rollup convention counts material/equipment lines only in
some assemblies.

## 2. Pricing method and verification levels

- **Observation date for every price: 2026-10-28.** Market: Terre Haute, IN 47802
  retail (Home Depot, Lowe's, Menards) plus national online suppliers where retail
  does not stock the item (engineered lumber, standing-seam components, spray foam).
- **Verification levels used in this document (read them before using any number):**
  - **P — product page verified:** the product page itself was opened and showed the
    price on 2026-10-28. Only the oak flooring line meets this bar.
  - **S — search-result price:** the price appeared in a web search result on
    2026-10-28 but the product page was not opened to confirm it. Treat as a lead
    that needs one click of confirmation, not as a verified quote.
  - **G — published guide range:** a planning range from a published cost guide,
    not a purchasable quote. A dealer/rental-house quote is required before use.
  - **R — documented reason (no price):** the component is labor, contractor-owned
    equipment, or a jobsite offcut. No supplier price exists for it in this proposal,
    and none is invented.
- **Name-matched prices are never verified quotes.** Where the sourced product differs
  from the recipe spec in grade, width, density, or packaging, the difference is stated
  on the line. Do not present any line below as a supplier quote.
- **Historical baselines (NOT current prices):** the September 2026 supplier workbooks
  (`TradeOS_All_Normalized_Costbooks_47802.zip`) were used only as sanity checks.
  Where a baseline and a current price are both shown, the baseline is labeled with its
  September observation date and is never averaged into the current price.
- **Labor is never priced from supplier data.** Every labor component below keeps a
  documented reason. Labor benchmarks (e.g., Davis-Bacon) are a separate estimating
  input and are out of scope for this supplier-price proposal.
- **Disposal tonnage** is priced at a Terre Haute dumpster overage rate. That rate
  covers disposal weight only — container rental, haul, and delivery are separate
  lines the estimator must add.
- **Tax, delivery, and fuel are excluded** from every line below.

## 3. Per-assembly pricing

### 3.1 `demo-flooring-carpet-pad` — Carpet, Rebond Pad, and Tack Strip Removal — per SF

| Component | Recipe qty | Unit price | Extended / SF | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| labor_carpet_tearout (labor) | 0.018 HR | — | — | — | R | Labor is not a supplier price; apply labor benchmarks separately. |
| mat_duct_tape_rolls | 0.0015 ROLL | $7.98 / roll (Nashua 1.89 in. x 30 yd) | $0.012 | Home Depot | S | ⚠️ REVIEW BEFORE BIDS |
| equip_carpet_disposal | 0.0004 TON | $60.00 / TON (dumpster overage rate) | $0.024 | JBL Disposal, Terre Haute, IN | S | ⚠️ REVIEW BEFORE BIDS — disposal weight only; container + haul separate. A second Terre Haute broker quotes $155/TON overage, so confirm the hauler. |
| **Material + equipment subtotal** | | | **$0.036 / SF** | | | Labor excluded. |

### 3.2 `demo-roofing-shingle-tearoff` — Asphalt Shingle Roof Tear-Off (1 Layer) — per SQ

| Component | Recipe qty | Unit price | Extended / SQ | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| labor_roof_tearoff (labor) | 0.45 HR | — | — | — | R | Labor is not a supplier price. |
| equip_dumpster_roofing | 0.135 TON | $60.00 / TON | $8.10 | JBL Disposal, Terre Haute, IN | S | ⚠️ REVIEW BEFORE BIDS — disposal weight only; container + haul separate. |
| mat_tarps_magnetic_sweep | 0.02 EA | $87.95 / tarp (CORE 20 ft x 30 ft 8 mil blue poly) | $1.76 | Home Depot | S | ⚠️ REVIEW BEFORE BIDS — tarp priced; the magnetic sweeper is an owned tool and is not separately priced in this combined component. |
| **Material + equipment subtotal** | | | **$9.86 / SQ** | | | Labor excluded. |

### 3.3 `demo-concrete-slab-4in` — Concrete Slab Demolition (4 in. Unreinforced) — per SF

| Component | Recipe qty | Unit price | Extended / SF | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| labor_demo_concrete (labor) | 0.05 HR | — | — | — | R | Labor is not a supplier price. |
| equip_skidsteer_breaker | 0.025 HR | $180–$375 / day ÷ 8 hr = $22.50–$46.88 / HR | $0.56–$1.17 | Published rental planning ranges (Louisville/Denver 2026 guides) | G | ⚠️ REVIEW BEFORE BIDS — range, not a quote; rental-house quote required. Base skid-steer hire is a separate line. |
| equip_concrete_disposal_ton | 0.026 TON | $60.00 / TON | $1.56 | JBL Disposal, Terre Haute, IN | S | ⚠️ REVIEW BEFORE BIDS — disposal weight only. |
| **Material + equipment subtotal** | | | **$2.12–$2.73 / SF** | | | Labor excluded. No material components in this recipe. |

### 3.4 `flooring-hardwood-solid-oak-3-4` — Solid 3/4 in. x 3-1/4 in. Oak Hardwood Flooring (Blind-Nailed) — per SF

| Component | Recipe qty | Unit price | Extended / SF | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| mat_hardwood_oak_34x325 | 1.1 SF | $3.29 / SF (3/4 in. x 3-1/4 in. Select & Better red oak, model 314SELRO) | $3.62 | flooring.org | P | ⚠️ REVIEW BEFORE BIDS — exact dimension/species match. Grade is Select & Better; the recipe does not pin a grade, so a #2-grade product would be cheaper (published #2 3-1/4 in. prices run ~$1.89/SF). A $2.79/SF sale price on the same page expired 10/27/2026; $3.29 is the current regular price. Min. order 13 bundles (18.75 SF each). |
| mat_underlayment_felt_15lb | 1.1 SF | $34.98 / 432 SF roll = $0.0810 / SF | $0.089 | Lowe's (Warrior 15 lb felt, 36 in. x 144 ft) | S | ⚠️ REVIEW BEFORE BIDS — secondhand attribution: the $34.98 figure comes from a resale listing quoting a Lowe's price, not from a Lowe's product page. Sanity check: September baseline Niehaus $31.95/roll, same order of magnitude. |
| fast_flooring_cleats_16ga_2in | 5.5 EA | $304.13 / 15,000-ct box = $0.0203 / EA (Powernail 16 ga 2 in. L-cleats) | $0.112 | Powernail (manufacturer store) | S | ⚠️ REVIEW BEFORE BIDS — per-EA cost depends heavily on pack size (1,000-ct boxes run ~$0.03–$0.05/EA); the bulk-box conversion is used here. |
| labor_install_solid_hardwood (labor) | 0.05 HR | — | — | — | R | Labor is not a supplier price. |
| **Material subtotal** | | | **$3.82 / SF** | | | Labor excluded. |

### 3.5 `hvac-minisplit-singlezone-12k` — Single-Zone Ductless Mini-Split Heat Pump Installation (12,000 BTU) — per EA

| Component | Recipe qty | Unit price | Extended / EA | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| equip_minisplit_12k_system | 1.0 EA | $1,247.00 (LG indoor $498 + LG outdoor $749, sold separately) | $1,247.00 | Home Depot | S | ⚠️ REVIEW BEFORE BIDS — name-matched pair, NOT a single system SKU. A complete Pioneer 12k system lists at $918 but includes a 16 ft install kit, which would double-count the separate lineset line below; the LG pair is used so the recipe structure (system vs. lineset vs. accessories) stays intact. |
| mat_lineset_refrigerant_25ft | 1.0 EA | $180.00 (25 ft 1/4 in. x 3/8 in. insulated copper kit) | $180.00 | Pioneer Mini Split | S | ⚠️ REVIEW BEFORE BIDS |
| mat_lineset_cover_duct_kit | 1.0 KIT | $44.00 (12 ft PVC decorative cover kit, 3 in. wide) | $44.00 | South Mini Splits | S | ⚠️ REVIEW BEFORE BIDS — economy kit; premium Fortress/Slimduct 12 ft kits list around $151.52. Recipe does not pin a width or brand. |
| mat_condenser_pad_composite_risers | 1.0 EA | $35.59 (ProAire 18 in. x 38 in. x 3 in. equipment pad) | $35.59 | Menards (Terre Haute store chain) | S | ⚠️ REVIEW BEFORE BIDS — pad only; risers are typically separate and are not included in this price. |
| mat_electrical_disconnect_whip_kit | 1.0 KIT | $69.00 (Diversitech DDS-30 fused disconnect + 6 ft whip + fuses) | $69.00 | Total Home Supply | S | ⚠️ REVIEW BEFORE BIDS — kit was shown out of stock at observation; a la carte (disconnect ~$30 + whip ~$30) is a ~$60 alternative. |
| mat_cable_interconnect_14_4 | 30.0 LF | $37.50 / 50 ft = $0.75 / LF (14-4 ga mini-split wire) | $22.50 | Younits | S | ⚠️ REVIEW BEFORE BIDS |
| labor_install_ductless_minisplit (labor) | 6.5 HR | — | — | — | R | Labor is not a supplier price. |
| **Material subtotal** | | | **$1,598.09 / EA** | | | Labor excluded. Note: the rollup on main says 0/6 for this assembly while the recipe has 7 components (6 material + 1 labor); the recipe count governs. |

### 3.6 `framing-floor-ijoist-19-2oc` — Engineered Wood I-Joist Floor Framing System (19.2 in. OC, Rim Board, Web Stiffeners) — per SF

| Component | Recipe qty | Unit price | Extended / SF | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| mat_ijoist_series_1178 | 0.675 LF | $5.25–$6.75 / LF (TJI 210, 11-7/8 in.) | $3.54–$4.56 | Truitt & White TJI cost guide (Bay Area) | G | ⚠️ REVIEW BEFORE BIDS — guide range, NOT a Terre Haute quote. Engineered lumber is pro-dealer/special-order, not retail shelf stock; a local dealer quote is required. A second published table lists 11-7/8 in. at $6.18/LF, inside this range. |
| mat_rimboard_engineered_1178 | 0.127 LF | $62.29 / 18 ft = $3.46 / LF (1-1/4 in. x 11-7/8 in. x 18 ft LSL rim board/stringer blank) | $0.44 | Menards | S | ⚠️ REVIEW BEFORE BIDS. Sanity check: September baseline Niehaus $49.95/EA (length unstated in that extraction). |
| mat_web_stiffeners_plywood | 0.02 PAIR | — | $0 (allowance) | — | R | Documented reason: web stiffeners are cut from sheathing/rim offcuts on site; there is no separate purchasable SKU for a 0.02-pair allocation. Carried at $0, not hidden inside another line. |
| mat_squash_blocks_2x4 | 0.08 LF | $4.15 / 8 ft = $0.519 / LF (kiln-dried 2x4 stud) | $0.042 | Menards (price survey dated 2026-10-14) | S | ⚠️ REVIEW BEFORE BIDS |
| fast_nails_10d_16d_ijoist | 0.85 EA | $31.73 / ~220-ct 5 lb box = $0.144 / EA (Grip-Rite 16d 3-1/2 in. common) | $0.123 | Home Depot | S | ⚠️ REVIEW BEFORE BIDS — recipe units read "EA/LBS," which is ambiguous; treated here as 0.85 nails per SF. The 16d box price is used for the combined 10d/16d component (10d runs slightly cheaper). |
| labor_framing_ijoist_system (labor) | 0.024 HR | — | — | — | R | Labor is not a supplier price. |
| **Material subtotal** | | | **$4.15–$5.16 / SF** | | | Labor excluded; web stiffeners at $0 offcut allowance. |

### 3.7 `roofing-metal-standing-seam-24ga` — Standing Seam Metal Roofing (24 ga Steel, 16 in. Snap-Lock/Mechanical, Concealed Clips) — per SQ

Standing-seam panels are fabricated to spec and are not shelf stock. Every line in this
assembly except screws and butyl tape is a published guide range, not a purchasable
quote. The assembly total is therefore a range, and a fabricator quote is required
before any bid use.

| Component | Recipe qty | Unit price | Extended / SQ | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| mat_metal_panels_standing_seam_24ga | 1.12 SQ | $5.50–$6.50 / SF × 100 SF/SQ = $550–$650 / SQ (24 ga material) | $616.00–$728.00 | myhomequote 24-gauge guide (Angi 2026 guide gives $3–$8/SF for 24 ga) | G | ⚠️ REVIEW BEFORE BIDS — guide range; fabricator quote required. Panel width/profile/finish move the price materially. |
| fast_clips_standing_seam_expansion | 40.5 EA | $0.75–$1.50 / EA | $30.38–$60.75 | Published standing-seam material guide | G | ⚠️ REVIEW BEFORE BIDS — clips are system-specific and normally ship with the panel order; no standalone retail box price was found. Range only. |
| fast_screws_pancake_head | 81.0 EA | $20.65 / 100 pk = $0.2065 / EA (Teks #10 x 1-1/2 in. pancake head, star drive) | $16.73 | Zoro | S | ⚠️ REVIEW BEFORE BIDS |
| mat_trim_standing_seam_flashing | 12.5 LF | $3.00–$7.00 / LF | $37.50–$87.50 | Published standing-seam material guide | G | ⚠️ REVIEW BEFORE BIDS — guide range; trim profile drives the price. |
| mat_sealant_butyl_tape_metal | 25.0 LF | $7.98 / 50 ft roll = $0.1596 / LF (Gibraltar butyl tape, 1/2 in. x 3/32 in. x 50 ft) | $3.99 | Home Depot | S | ⚠️ REVIEW BEFORE BIDS. Sanity check: September baseline ABC Supply $11.50/roll (45 LF). |
| labor_install_standing_seam (labor) | 2.2 HR | — | — | — | R | Labor is not a supplier price. |
| **Material subtotal** | | | **$704.59–$896.97 / SQ** | | | Labor excluded. Note: the rollup on main says 0/3 for this assembly while the recipe has 6 components; the recipe count governs. |

### 3.8 `insul-sprayfoam-closedcell-2in` — Closed-Cell Spray Polyurethane Foam Insulation (2 in. Thickness, R-14) — per SF

| Component | Recipe qty | Unit price | Extended / SF | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| mat_sprayfoam_closedcell_boardfoot | 2.3 BF | $374.99 / 200 BF = $1.875 / BF (DuPont Froth-Pak 200) | $4.31 | Industrial Products | S | ⚠️ REVIEW BEFORE BIDS — name-matched, NOT identical spec: Froth-Pak is 1.75 lb/cu ft at R-6.1–6.7/in; the recipe specifies a 2.0 lb/cu ft system at R-14 over 2 in. (~R-7/in). Close, but not a spec match. Bulk alternative: Froth-Pak 630 at $889.99/630 BF = $1.413/BF → $3.25/SF at the same 2.3 BF quantity. |
| mat_masking_poly_film_prep | 0.15 SF | $45.69 / 2,400 SF roll = $0.0190 / SF (Napco clear poly, 2 mil, 12 ft x 200 ft) | $0.003 | Hardware World | S | ⚠️ REVIEW BEFORE BIDS — recipe units read "SF/ROLL"; treated here as 0.15 SF of film consumed per SF of assembly. |
| equip_sprayfoam_mobile_rig | 0.005 HR | — | — | — | R | Documented reason: contractor-owned mobile rig; the allocation is an internal equipment rate, not a supplier price. |
| labor_spray_closedcell_foam (labor) | 0.01 HR | — | — | — | R | Labor is not a supplier price. |
| **Material subtotal** | | | **$4.32 / SF** | | | Labor and rig excluded. Note: the rollup on main says 0/3 for this assembly while the recipe has 4 components; the recipe count governs. |

### 3.9 `waterproofing-foundation-spray-bituminous` — Bituminous Foundation Spray Dampproofing / Waterproofing — per SF

| Component | Recipe qty | Unit price | Extended / SF | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| mat_asphalt_waterproofing_coating | 0.0392 GAL | $52.42 / 5 gal = $10.48 / GAL (ALCM no-fiber liquid asphalt foundation coating) | $0.411 | All Contractors Supply | S | ⚠️ REVIEW BEFORE BIDS — corroborated by APOC 202 at $51.00/5 gal and Henry 788 at $56.20/5 gal. |
| mat_cove_mortar_hydro | 0.05 LB | $15.97 / 10 lb = $1.597 / LB (Quikrete Hydraulic Water-Stop Cement 112611) | $0.080 | Home Depot | S | ⚠️ REVIEW BEFORE BIDS — hydraulic water-stop cement is the closest retail product to the recipe's "cove mortar hydro"; it is a proxy, not an exact-spec match. |
| equip_airless_bitumen_spray_rig | 0.003 HR | — | — | — | R | Documented reason: contractor-owned spray rig; internal equipment rate, not a supplier price. |
| labor_apply_foundation_waterproofing (labor) | 0.008 HR | — | — | — | R | Labor is not a supplier price. |
| **Material subtotal** | | | **$0.49 / SF** | | | Labor and rig excluded. Note: the rollup on main says 0/3 for this assembly while the recipe has 4 components; the recipe count governs. |

### 3.10 `demo-roofing-shingle-tearoff-2layers` — Asphalt Shingle Roof Tear-Off (2 Layers) — per SQ

| Component | Recipe qty | Unit price | Extended / SQ | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| labor_roof_tearoff_2layers (labor) | 0.75 HR | — | — | — | R | Labor is not a supplier price. |
| equip_dumpster_roofing_2layers | 0.265 TON | $60.00 / TON | $15.90 | JBL Disposal, Terre Haute, IN | S | ⚠️ REVIEW BEFORE BIDS — disposal weight only; container + haul separate. |
| mat_tarps_magnetic_sweep_2layers | 0.03 EA | $87.95 / tarp (CORE 20 ft x 30 ft 8 mil blue poly) | $2.64 | Home Depot | S | ⚠️ REVIEW BEFORE BIDS — tarp priced; magnetic sweeper is an owned tool, not separately priced. |
| **Material + equipment subtotal** | | | **$18.54 / SQ** | | | Labor excluded. |

### 3.11 `demo-siding-exterior-lap` — Exterior Siding Demolition (Vinyl or Wood Lap Siding to Sheathing) — per SQ

| Component | Recipe qty | Unit price | Extended / SQ | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| labor_siding_demolition (labor) | 0.4 HR | — | — | — | R | Labor is not a supplier price. |
| equip_siding_disposal_ton | 0.085 TON | $60.00 / TON | $5.10 | JBL Disposal, Terre Haute, IN | S | ⚠️ REVIEW BEFORE BIDS — disposal weight only; container + haul separate. |
| mat_ground_tarps_magnetic_sweep_siding | 0.02 EA | $87.95 / tarp (CORE 20 ft x 30 ft 8 mil blue poly) | $1.76 | Home Depot | S | ⚠️ REVIEW BEFORE BIDS — tarp priced; magnetic sweeper is an owned tool, not separately priced. |
| **Material + equipment subtotal** | | | **$6.86 / SQ** | | | Labor excluded. |

### 3.12 `demo-deck-wood-framing-surface` — Exterior Wood Deck Demolition (Decking and Framing Removal) — per SF

| Component | Recipe qty | Unit price | Extended / SF | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| labor_deck_demolition (labor) | 0.05 HR | — | — | — | R | Labor is not a supplier price. |
| equip_deck_disposal_ton | 0.0075 TON | $60.00 / TON | $0.45 | JBL Disposal, Terre Haute, IN | S | ⚠️ REVIEW BEFORE BIDS — disposal weight only; container + haul separate. |
| mat_sawzall_blades_consumables | 0.01 EA | $59.47 / 25 pk = $2.379 / EA (Diablo Demo Demon 6 in. bi-metal, nail-embedded wood) | $0.024 | Ace Tool | S | ⚠️ REVIEW BEFORE BIDS |
| **Material + equipment subtotal** | | | **$0.47 / SF** | | | Labor excluded. |

### 3.13 `earthwork-trench-excavation-mini` — Continuous Footing Trench Excavation via Mini-Excavator — per CY

| Component | Recipe qty | Unit price | Extended / CY | Supplier / source | Verification | Review flag |
|---|---|---|---|---|---|---|
| labor_excavator_operator (labor) | 0.055 HR | — | — | — | R | Labor is not a supplier price. |
| labor_grade_trench_helper (labor) | 0.045 HR | — | — | — | R | Labor is not a supplier price. |
| equip_mini_excavator_3ton | 0.055 HR | $275–$450 / day ÷ 8 hr = $34.38–$56.25 / HR (3–4 ton class) | $1.89–$3.09 | Published rental planning ranges (2026 guides) | G | ⚠️ REVIEW BEFORE BIDS — range, not a Terre Haute quote; delivery, fuel, waiver, and damage protection are separate. |
| **Equipment subtotal** | | | **$1.89–$3.09 / CY** | | | Labor excluded. No material components in this recipe. Note: the rollup on main says 0/1 for this assembly while the recipe has 3 components (2 labor + 1 equipment); the recipe count governs. |

## 4. Summary of material + equipment subtotals (labor excluded throughout)

| Assembly | Unit | Proposed subtotal |
|---|---|---|
| demo-flooring-carpet-pad | SF | $0.036 |
| demo-roofing-shingle-tearoff | SQ | $9.86 |
| demo-concrete-slab-4in | SF | $2.12–$2.73 |
| flooring-hardwood-solid-oak-3-4 | SF | $3.82 |
| hvac-minisplit-singlezone-12k | EA | $1,598.09 |
| framing-floor-ijoist-19-2oc | SF | $4.15–$5.16 |
| roofing-metal-standing-seam-24ga | SQ | $704.59–$896.97 |
| insul-sprayfoam-closedcell-2in | SF | $4.32 |
| waterproofing-foundation-spray-bituminous | SF | $0.49 |
| demo-roofing-shingle-tearoff-2layers | SQ | $18.54 |
| demo-siding-exterior-lap | SQ | $6.86 |
| demo-deck-wood-framing-surface | SF | $0.47 |
| earthwork-trench-excavation-mini | CY | $1.89–$3.09 |

## 5. What this proposal deliberately does NOT do

- It does not change `app/modules/costbook/pricedAssemblies.ts`, `tradeosAssemblies.ts`,
  or any test. The 63 original rollups and all 75 priced assemblies are byte-identical
  after this change; the diff for the associated PR contains only this document.
- It does not price labor. Every labor line above is a documented reason, not a number.
- It does not present any name-matched, guide-range, or search-result price as a
  verified supplier quote. The only product-page-verified line is the oak flooring
  (level P); everything else needs confirmation before bid use.
- It does not resolve the post-merge follow-ups from PR #772 (borderline plate match,
  cap-nail size variances, bulk nails for collated, EPDM units). Those remain open
  decisions for the estimator, not numbers invented here.

## 6. Recommended next steps for the reviewer

1. Confirm the 13-assembly scope (vs. the idea's 11) or trim the list at review.
2. Confirm the Terre Haute disposal rate with the actual hauler ($60/TON used here;
   a second local broker quotes $155/TON overage — the spread matters on the
   tear-off and concrete assemblies).
3. Get a local dealer quote for TJI 210 11-7/8 in. joists and a fabricator quote for
   the 24 ga standing-seam system — those two assemblies carry the widest ranges.
4. Decide whether to wire these prices into `pricedAssemblies.ts` (a separate,
   code-changing PR with tests) or keep this document as a research-only reference.
   Wiring is NOT part of this proposal.

## Source traceability (review in progress)

The following original publishers provide identifiable evidence for selected planning rows:

- Home Depot lists the Nashua 1.89 in. x 30 yd. duct tape at $7.98: https://www.homedepot.com/p/207203956 . Confirm the exact tape variant before purchase.
- Powernail's 15,000-count 16-gauge 2 in. cleat case lists $304.13: https://store.powernail.com/black-box-2-16-ga-15-x-1m-powercleats . Confirm pack quantity and current price before use.
- JBL Disposal's Terre Haute listing states $60 per ton for extra weight: https://www.jbldisposal.com/dumpster-rental-terre-haute-in/ . This is an overage charge, not a standalone disposal quote.
- Truitt & White's TJI guide lists TJI 210, 11-7/8 in., at $5.25–$6.75 per linear foot: https://truittandwhite.com/cost-of-tji-joists . This is a regional guide, not a Terre Haute dealer quote.
- MyHomeQuote's standing-seam guide lists 24-gauge panels at $5.50–$6.50 per square foot: https://www.myhomequote.com/cost/roofing/standing-seam-metal-roof-cost . This is a planning guide, not a panel order.

**Evidence gap:** The other priced rows have no retained direct product or guide URL in this proposal, including the clip and trim ranges and rental guides. Their stated search-result prices cannot be independently traced from this document. Treat their subtotals as unverified research leads and obtain direct source evidence or fresh supplier quotes before approving this proposal or using any price in a bid.
