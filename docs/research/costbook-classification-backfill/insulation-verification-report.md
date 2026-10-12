# Insulation — Classification Verification Report

**Date:** 2026-10-08
**Family:** Residential insulation and weather barriers (batts, loose fill, rigid foam, spray foam, housewrap/WRB)
**Status:** UNSPSC verified from the published codeset. OmniClass Table 23 NULL per policy.
**Nature of this pass:** Classification backfill — all 116 keys exist in the corpus.

## 1. Verified UNSPSC mappings

Source: UNSPSC Codeset v8.1201, GS1 US. Family 30140000 ("Insulation"), classes
30141500 ("Thermal insulation") and 30141600 ("Specialty insulation").

| Code | Commodity title | Corpus keys mapped | Notes |
|---|---|---|---|
| 30141504 | Insulation batts | Fiberglass/rockwool batts and rolls | Batt/roll form; material is an attribute |
| 30141506 | Loose fill insulation | Blown fiberglass, cellulose, perlite block-fill | |
| 30141507 | Rigid board insulation | XPS, polyiso, EPS, roof coverboard | Material + thickness are attributes |
| 30141503 | Foam insulation | One-component sealant cans, two-part kits | DIY vs professional is an attribute |

## 2. Ambiguities (recorded, not silently resolved)

**A1 — Housewrap/WRB: no commodity exists.**
Tyvek HomeWrap and equivalents are weather-resistive barriers, not thermal
insulation. No UNSPSC commodity covers them. All 17 housewrap keys carry empty
code fields. Brand is the product identity for WRB.

**A2 — WRB accessories: tapes, baffles, sill seal.**
Flashing/seam tapes, attic baffles, and sill-seal gaskets have no verified
commodity in this pass (tapes belong to a future sealants/adhesives pass;
baffles are ventilation). Ambiguous with documented reasons.

**A3 — Vapor-barrier poly sheeting.**
No verified commodity; ambiguous, code-empty.

**A4 — Rockwool/mineral wool batts → 30141504.**
Mapped as batts (form decides), with material recorded as an attribute. Fire
performance differences vs fiberglass are an estimator concern, not a code
distinction.

## 3. OmniClass Table 23 — NULL with cause

Standing finding: CSI publication required; no public source. All NULL.

## 4. Coverage register

- **Mapped:** 83 keys across 4 commodities.
- **Ambiguous:** 33 keys (housewrap/WRB, tapes, baffles, sill seal, poly).
- **Unmapped:** 0. **Invented codes:** zero. **New keys:** zero.

## 5. Program wrap-up

Insulation completes the five-family program Billy approved on 2026-10-08:
framing lumber → engineered lumber → fasteners → concrete/masonry → insulation.
Totals: 397 classification rows (83 + 27 + 109 + 62 + 116), every code read
from UNSPSC Codeset v8.1201, zero invented, OmniClass 23 NULL throughout
pending the CSI publication. The per-family package shape (classifications CSV,
normalization JSON, verification report, prices CSV, recommendations) is proven
and repeatable for the next backfill wave.
