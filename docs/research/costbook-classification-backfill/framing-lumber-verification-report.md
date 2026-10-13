# Framing & Lumber — Classification Verification Report

**Date:** 2026-10-08
**Family:** Residential dimensional framing lumber (SPF, SYP, Douglas Fir-Larch, Hem-Fir, pressure-treated)
**Status:** UNSPSC verified. OmniClass Table 23 unverifiable from public sources — left NULL per policy.

## 1. Method

1. Read the published UNSPSC Codeset v8.1201 (GS1 US) in full and extracted every commodity under class 30103600 "Structural products."
2. Searched the codeset for lumber-adjacent terms ("treated", "pressure") to check for dedicated commodities.
3. Searched for an authoritative public listing of OmniClass Table 23 product codes covering lumber.
4. Cross-checked species-group and grade terminology against the grading authorities (NLGA, SPIB, WCLIB/WWPA).
5. Recorded every ambiguity as ambiguous rather than forcing a mapping.

## 2. Verified UNSPSC mappings

Source: UNSPSC Codeset v8.1201, GS1 US. Segment 30000000, Family 30100000
("Structural materials and basic shapes"), Class 30103600 ("Structural products").

| Code | Commodity title | Applies to |
|---|---|---|
| 30103601 | Wood beams | Glulam, LVL, PSL beams — not dimensional retail lumber |
| 30103602 | Wood composite beams | Engineered beams — not dimensional retail lumber |
| **30103603** | **Framing lumber** | **All dimensional framing lumber in this package: studs, 2x4–2x12, all species, treated and untreated** |
| 30103604 | Wood sheathing or sheets | Plywood/OSB — out of scope for this family |
| 30103605 | Wood planks | Boards/planking — not dimensional framing |
| 30103606 | Wood trusses | Prefab trusses — not dimensional retail lumber |
| 30103607 | Wood joists | See ambiguity A1 below |
| 30103608 | Wooden poles or telephone poles | Out of scope |

## 3. Ambiguities (recorded, not silently resolved)

**A1 — 30103603 "Framing lumber" vs 30103607 "Wood joists."**
Retail 2x8, 2x10, and 2x12 are sold as generic dimensional lumber and map to
30103603. A piece explicitly specified, graded, or sold as a floor/ceiling joist
arguably maps to 30103607. The CSV rows for 2x8/2x10/2x12 carry this ambiguity in
their note field. TradeOS matching must route joist-specified pieces to human
review rather than auto-merging on the shared family code. This is exactly the
"codes narrow, never decide" rule.

**A2 — No treated-lumber commodity exists in the codeset.**
A full-text search of v8.1201 for "treated"/"pressure" returned no lumber
commodity. Pressure-treated dimensional lumber therefore maps to 30103603 with
treatment recorded as a product attribute (canonical key boundary:
`LUMBER-PT-SYP-...` vs `LUMBER-SYP-...`). Never invent a treated-specific code.

**A3 — The codeset does not distinguish species or grade.**
SPF, SYP, Douglas Fir, stud grade vs #2, KD vs green — none of these appear as
separate commodities. All map to 30103603; species/grade/treatment are enforced
by the canonical key and matching rules, not by the classification code. Two
materials sharing 30103603 are never interchangeable on that basis alone.

## 4. OmniClass Table 23 — NULL with cause

No authoritative public source for OmniClass Table 23 product codes covering
lumber could be located. OmniClass is a CSI publication; its code tables are not
published openly in a verifiable form. Accordingly:

- Every `omniclass23` field in this package is **NULL / unmapped**.
- This is compliant with the approved strategy: both Prisma fields stay nullable,
  and unverified codes are never populated.
- To complete this column later: obtain the OmniClass Table 23 publication from
  CSI, verify the lumber product entries, and backfill with provenance citing the
  publication edition and date — one deterministic pass, same as this one.

## 5. Species and grade authorities (terminology verification)

| Term | Authority | Verified meaning |
|---|---|---|
| SPF (Spruce-Pine-Fir) | NLGA Standard Grading Rules for Canadian Lumber | Species combination: white/Engelmann/black/red spruce, lodgepole/Jack pine, alpine/balsam fir. A combination stamp may be any one species or a mixture — never infer exact species from the stamp. |
| Stud grade | NLGA / WCLIB / SPIB | Structural grade for 2x4 and 2x6, lengths ≤ 10 ft, for load-bearing walls. Distinct grade, not a size label. |
| Construction / Standard / Utility | NLGA / SPIB | Descending visual grades; Construction and Standard apply to 2x4; Utility is the lowest. |
| No.1 / No.2 / No.3 / Select Structural | NLGA / SPIB / WCLIB | Structural light-framing grades (2–4 in. thick); Select Structural is the top visual grade. |
| SYP (Southern Yellow Pine) | SPIB Standard Grading Rules | Loblolly, shortleaf, longleaf, slash pine; dominant US retail treated species. |
| Douglas Fir-Larch / Hem-Fir | WCLIB / WWPA | Western species groups with their own grading rules. |
| Nominal vs actual dimensions | Industry standard (S4S) | 2x4 → 1.5 × 3.5 in actual; full table in the normalization JSON. |

## 6. Coverage register

- **Mapped (UNSPSC):** 83 canonical keys → 30103603 "Framing lumber."
- **Ambiguous:** 2x8/2x10/2x12 rows carry the A1 joist ambiguity; treated rows carry the A2 no-commodity note.
- **Unmapped (OmniClass 23):** all 83 keys — pending CSI publication access.
- **Invented codes:** zero. Every code in this package was read from the published codeset.

## 7. What would change this report

- A newer UNSPSC codeset version: re-run the class 30103600 extraction; the
  package's provenance string names v8.1201 so the next pass is deterministic.
- CSI publication access: enables the OmniClass 23 backfill.
- Retail evidence that a supplier grades or markets joists as a distinct product
  line: would justify splitting 30103607 mappings instead of the current
  review-route.
