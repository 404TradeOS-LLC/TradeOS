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
| 30111606 | Grout | All 9 GROUT-* keys | Dedicated commodity — see correction at A2 |

## 2. Ambiguities — the honest gaps (recorded, not forced)

**A1 — Bagged concrete mix: NO commodity exists.**
The codeset's class 30111500 ("Concrete and mortars") contains only foamed,
conductive, and insulating concrete plus mortars. There is no commodity for
bagged dry concrete mix (Quikrete/Sakrete 60/80 lb) — the highest-volume retail
masonry product. These 7 keys carry `unspsc_status: ambiguous` with EMPTY code
fields. Filling a code here would be invention. PSI rating, bag weight, and
brand are the identity attributes; the class-level fit is documented.

**A2 — Grout: 30111606 "Grout", mapped (correction).**
CORRECTION (2026-10-18, HUMAN-CALLS M7#26): this section originally claimed no
grout commodity exists in v8.1201 and recorded 30111504 "Mortars" as an
ambiguous closest fit. That claim was false — 30111606 "Grout" is a verified
commodity in UNSPSC Codeset v8.1201. All 9 GROUT-* keys now map to 30111606
(live map corrected in PR #763). Tile grout (Polyblend/Keracolor/Prism) and
structural non-shrink grout share the code but are different uses — never
merge on code.

**A3 — Pavers: no commodity; two candidate codes each.**
Concrete pavers: 30131502 vs 30131700. Clay pavers: 30131602 vs 30131700.
Code fields left empty; human review.

**A4 — Firebrick/refractory: specialty uses.**
Firebrick → 31371100 (ambiguous); refractory mortar → 30111504 (ambiguous).
CORRECTION (2026-10-18, HUMAN-CALLS M7#27): the package's 30131602 'Ceramic bricks' was superseded — 31371100 'Refractory bricks' is the class-level verified fit in UNSPSC Codeset v8.1201. Keeps ambiguous status because no fireclay commodity exists; Billy's call to confirm.
Specialty use, review required.

## 3. OmniClass Table 23 — NULL with cause

Standing finding: CSI publication required; no public source. All NULL.

## 4. Coverage register

- **Mapped:** 42 keys across 6 commodities (33 across 5 at the 2026-10-08 pass;
  +9 grout keys to 30111606 per the A2 correction).
- **Ambiguous:** 20 keys (concrete mix, pavers, firebrick, refractory).
- **Unmapped:** 0. **Invented codes:** zero. **New keys:** zero.

## 5. What this means for the costbook

This family has the lowest code yield of the five (68% mapped after the A2
grout correction; 53% at the original pass) because the
UNSPSC codeset genuinely lacks retail-masonry commodities. The ambiguous rows
are not failures — they are the provenance record that prevents silent
misclassification. Matching for concrete mix and pavers must rely on
canonical keys and attributes, with codes as a secondary signal only.
