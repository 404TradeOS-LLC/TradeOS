# Engineered Lumber — Classification Verification Report

**Date:** 2026-10-08
**Family:** Residential engineered lumber (LVL, LSL rim board, wood I-joists, glulam; trusses code-mapped only)
**Status:** UNSPSC verified from the published codeset. OmniClass Table 23 NULL per policy.

## 1. Verified UNSPSC mappings

Source: UNSPSC Codeset v8.1201, GS1 US. Segment 30000000, Family 30100000,
Class 30103600 ("Structural products") — same class extracted for the framing
pass on 2026-10-08.

| Code | Commodity title | Maps to | Rationale |
|---|---|---|---|
| 30103601 | Wood beams | Glulam beams | Glulam is the commodity the title describes: solid-wood beams. LVL/LSL/PSL are excluded — they are composites, covered by 30103602. |
| 30103602 | Wood composite beams | LVL, LSL (rim board), PSL | "Composite" = manufactured from veneers/strands: laminated veneer lumber, laminated strand lumber, parallel strand lumber. |
| 30103606 | Wood trusses | Prefab roof/floor trusses | Trusses are custom-quoted per plan; code recorded, no retail canonical keys in this pass. |
| 30103607 | Wood joists | Wood I-joists | I-joists are joists by function and trade name. Recorded with the A2 ambiguity below. |

## 2. Ambiguities (recorded, not silently resolved)

**A1 — Rim board: 30103602 vs 30103603.**
LSL rim board is a composite panel product (argues 30103602) that functions as
framing closure in a floor system (argues 30103603 "Framing lumber"). Both CSV
rows carry `unspsc_status: ambiguous`. Matching must route rim-board candidates
to human review rather than auto-confirming on either code.

**A2 — I-joists: 30103607 vs 30103603.**
A retail I-joist could be read as "framing lumber" in the loose sense, but the
codeset gives joists their own commodity and the trade treats I-joists as a
distinct engineered product with series-specific capacity. Mapped to 30103607
with this note; never merge an I-joist observation with dimensional 2x joists
on code proximity.

**A3 — LVL vs glulam vs PSL for the same opening.**
All three can serve as a header/beam of similar dimensions, but they are
different materials under different codes (30103602 vs 30103601). Structural
substitution is an engineering decision, never a code-driven auto-merge.

**A4 — No truss granularity.**
30103606 does not distinguish roof vs floor trusses, and trusses are
engineered-to-order. No canonical keys defined; integration belongs to the
quote/takeoff path.

## 3. OmniClass Table 23 — NULL with cause

Same finding as the framing pass: no authoritative public listing of OmniClass
Table 23 product codes exists; the CSI publication is required. All
`omniclass23` fields are NULL/unmapped. Backfill deterministically once the
publication is obtained.

## 4. Corpus compatibility

The static corpus already contains 4 LVL keys
(`BEAM-LVL-1_3_4X9_1_2-16FT/-20FT`, `BEAM-LVL-1_3_4X11_7_8-16FT/-20FT`). This
package keeps those keys byte-identical (`in_corpus: yes` in the CSV) and adds
23 new keys (12-ft LVL lengths, 7-1/4 in and 14 in depths, double-ply header,
LSL rim board, I-joists, glulam). No renames, no collisions.

## 5. Manufacturer terminology (attributes, not codes)

Weyerhaeuser (TJI joists, Microllam LVL, Parallam PSL), Boise Cascade (BCI
joists, Versa-Lam LVL), LP (SolidStart LSL). Series and grade are recorded as
observation attributes; they never change the UNSPSC mapping but they do gate
matching — cross-series substitution requires engineering review.

## 6. Coverage register

- **Mapped:** 24 keys (LVL → 30103602, I-joists → 30103607, glulam → 30103601).
- **Ambiguous:** 2 keys (LSL rim board → 30103602 vs 30103603); 1 key
  (double-ply LVL header — factory unit vs field assembly).
- **Unmapped (OmniClass 23):** all 27 keys.
- **Code-mapped only, no keys:** prefab trusses → 30103606.
- **Invented codes:** zero.
