# Concrete & Masonry — Classification Verification Report

**Date:** 2026-10-08
**Family:** Residential concrete and masonry (bagged mix, mortar, grout, cement, CMU, brick, pavers)
**Status:** UNSPSC verified from the published codeset. OmniClass Table 23 NULL per policy.
**Nature of this pass:** Classification backfill — all 62 keys exist in the corpus.

## 1. Verified UNSPSC mappings

Source: UNSPSC Codeset v8.1201, GS1 US. Families 30110000 ("Concrete and cement
and plaster") and 30130000 ("Structural building products").

| Code | Commodity title | Corpus keys mapped | Notes |
|---|---|---|---|
| 30131502 | Concrete blocks | All BLOCK-CMU-* | Hollow/solid/partition/header are form variants |
| 30131602 | Ceramic bricks | Clay/face/building bricks | Fired clay = ceramic |
| 30131603 | Concrete bricks | BRICK-CONCRETE-* | |
| 30111601 | Cement | Portland + masonry cements | Masonry cement is a cement blend |
| 30111504 | Mortars | Mason/thinset/specmix/veneer mortars | |

## 2. Ambiguities — the honest gaps (recorded, not forced)

**A1 — Bagged concrete mix: NO commodity exists.**
The codeset's class 30111500 ("Concrete and mortars") contains only foamed,
conductive, and insulating concrete plus mortars. There is no commodity for
bagged dry concrete mix (Quikrete/Sakrete 60/80 lb) — the highest-volume retail
masonry product. These 7 keys carry `unspsc_status: ambiguous` with EMPTY code
fields. Filling a code here would be invention. PSI rating, bag weight, and
brand are the identity attributes; the class-level fit is documented.

**A2 — Grout: no commodity; 30111504 is the closest fit.**
Tile grout (Polyblend/Keracolor/Prism) and structural non-shrink grout share
30111504 "Mortars" as an ambiguous mapping. The two grout uses must never merge
on the shared code.

**A3 — Pavers: no commodity; two candidate codes each.**
Concrete pavers: 30131502 vs 30131700. Clay pavers: 30131602 vs 30131700.
Code fields left empty; human review.

**A4 — Firebrick/refractory: specialty uses.**
Firebrick → 30131602 (ambiguous); refractory mortar → 30111504 (ambiguous).
Specialty use, review required.

## 3. OmniClass Table 23 — NULL with cause

Standing finding: CSI publication required; no public source. All NULL.

## 4. Coverage register

- **Mapped:** 33 keys across 5 commodities.
- **Ambiguous:** 29 keys (concrete mix, grout, pavers, firebrick, refractory).
- **Unmapped:** 0. **Invented codes:** zero. **New keys:** zero.

## 5. What this means for the costbook

This family has the lowest code yield of the five (53% mapped) because the
UNSPSC codeset genuinely lacks retail-masonry commodities. The ambiguous rows
are not failures — they are the provenance record that prevents silent
misclassification. Matching for concrete mix, grout, and pavers must rely on
canonical keys and attributes, with codes as a secondary signal only.
