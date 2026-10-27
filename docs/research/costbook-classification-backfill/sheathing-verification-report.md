# Sheathing — Classification Verification Report

**Date:** 2026-10-18
**Family:** Residential structural wood panels and sheathing (OSB, softwood plywood, ZIP system, radiant-barrier OSB, subfloor panels, hardwood/utility panels, underlayment panels)
**Status:** UNSPSC verified from the published codeset. OmniClass Table 23 NULL per policy.
**Nature of this pass:** Classification research — all 63 keys exist in the supplier price corpus (`app/modules/costbook/supplierPrices47802.ts`); zero keys are in the live `CANONICAL_MATERIAL_CODES` map. Research only; nothing ingested.

## 1. Verified UNSPSC mappings

Source: UNSPSC Codeset v8.1201, GS1 US. Segment 30000000, Family 30100000
("Structural materials and basic shapes"), Class 30103600 ("Structural products").

Commodity 30103604 "Wood sheathing or sheets" was extracted by the 2026-10-08
five-family program via a full read of class 30103600 (documented in
`framing-lumber-verification-report.md` §2, which lists all eight commodities
30103601–30103608). This pass applies that verified commodity to the sheathing
keys; no code was invented and no code text was altered.

| Code | Commodity title | Corpus keys mapped | Notes |
|---|---|---|---|
| 30103604 | Wood sheathing or sheets | OSB sheathing (7/16–5/8 in, 4x8/4x9/4x10), radiant-barrier OSB, ZIP roof panel, CDX/AC/BCX softwood plywood, pressure-treated plywood, T&G subfloor panels (OSB + plywood), hardwood/utility plywood (birch, oak, lauan), 1/4 in underlayment panels | Thickness, panel size, veneer grade, species, treatment, edge profile, and application (wall/roof/floor/underlayment) are attributes, not code distinctions |

## 2. Ambiguities (recorded, not silently resolved)

**A1 — DensGlass exterior sheathing: not a wood product.**
`SHEATHING-DENSGLASS-1_2-4X8` is glass-mat faced gypsum sheathing. Commodity
30103604 covers wood sheathing/sheets only. No verified gypsum-panel commodity
was established in this pass; the key carries empty code fields with the reason
recorded. A future gypsum/drywall pass should resolve it.

**A2 — ZIP system and radiant-barrier panels mapped as wood sheathing.**
`OSB-ZIP-ROOF-5_8-4X8-TG` (integrated WRB coating) and the radiant-barrier OSB
keys remain wood structural panels; the coating/facing is a product attribute.
This follows the five-family convention (form decides; material/coating is an
attribute), not a judgment that WRB coatings need no code — they don't have one
in this class.

**A3 — Scope boundary: roofing underlayments and floor underlayments excluded.**
Felt/synthetic roof underlayments (`ROOF-UNDERLAY-*`, `ROOFING-UNDERLAYMENT-*`,
`UNDERLAY-ROOF-*`) belong to a future roofing-family pass; foam/poly/leveling
floor underlayments (`UNDERLAY-FLOOR-*`, `UNDERLAYMENT-FOAM-*`,
`UNDERLAY-LEVELING-*`) belong to a flooring pass. Adhesives
(`ADHES-CONSTR-*`, `ADHESIVE-SUBFLOOR-*`) belong to a sealants/adhesives pass.
`PANEL-SUBFLOOR-MOISTUREBARRIER-2X2` (moisture-barrier accessory panel) was
excluded as an accessory, not structural sheathing. None were silently merged;
all are named here for the next wave.

## 3. OmniClass Table 23 — NULL with cause

Standing finding: CSI publication required; no public source. All NULL, same
as the five families.

## 4. Coverage register

- **Mapped:** 62 keys under 1 commodity (30103604).
- **Ambiguous:** 1 key (DensGlass gypsum sheathing — A1).
- **Unmapped:** 0. **Invented codes:** zero. **New keys:** 63 (all 63 keys are
  new to the map; none were in `CANONICAL_MATERIAL_CODES`).

## 5. Evidence chain

The commodity title and code were not re-read from a fresh codeset copy on
2026-10-18. They rest on the 2026-10-08 full codeset read documented in
`framing-lumber-verification-report.md` §2, which extracted every commodity
under class 30103600 and recorded 30103604 as "Wood sheathing or sheets —
Plywood/OSB". The per-key application (which panel maps, which is ambiguous)
is this pass's original work. If a future codeset re-read contradicts the
title, this package's mappings must be re-verified before ingest.
