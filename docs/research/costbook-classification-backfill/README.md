# Costbook classification backfill — research evidence

Source data for the 397 rows added to `CANONICAL_MATERIAL_CODES`
(`app/modules/costbook/canonicalMaterialCodes.ts`) in the 2026-10-08
five-family backfill (framing lumber, engineered lumber, fasteners,
concrete/masonry, insulation).

## What's here

- `<family>-classifications.csv` — the exact rows the map was generated from.
  Columns: `canonical_key`, `unspsc`, `unspsc_title`, `unspsc_status`
  (mapped | ambiguous), `omniclass23` (always empty — see below), provenance,
  and the per-row reason note.
- `<family>-verification-report.md` — how each code was verified and every
  recorded ambiguity.

## Provenance

All codes were read from UNSPSC Codeset v8.1201 (GS1 US) on 2026-10-08.
Zero codes were invented. OmniClass Table 23 is NULL throughout because the
CSI publication is not publicly verifiable; a future pass can fill it
deterministically once a verifiable source exists.

## Regenerating the map entries

For each CSV row whose key is not already in the map:

- `mapped` → `{ unspsc, unspscTitle, status: "mapped", provenance, note }`
- `ambiguous` → `{ status: "ambiguous", provenance, note }` (code fields empty)

Ambiguities (bagged concrete mix, pavers, housewrap/WRB, tapes,
baffles, sill seal, vapor barrier, proprietary structural
screws, hurricane ties, 2x8+ generic-vs-joist, LSL rim board, LVL/glulam/PSL
substitution, custom trusses) are recorded in the map notes and the reports —
never silently merged. (Grout and Tapcon screws were removed from this list by
the 2026-10-18 corrections: grout maps to UNSPSC 30111606 and Tapcon-style
screws to 31162104 — see the family reports.)

## Follow-up package: sheathing (2026-10-18)

- `sheathing-classifications.csv` + `sheathing-verification-report.md` — 63 rows
  researched 2026-10-18 and ingested into `CANONICAL_MATERIAL_CODES` as a
  follow-up to the five-family backfill: 62 mapped to UNSPSC 30103604
  "Wood sheathing or sheets" (OSB, softwood plywood, ZIP and radiant-barrier
  panels, subfloor and underlayment panels), 1 ambiguous
  (`SHEATHING-DENSGLASS-1_2-4X8` — glass-mat gypsum sheathing, not a wood
  product; no verified gypsum-panel commodity in this pass, left code-empty).
  Commodity 30103604 rests on the 2026-10-08 full class-30103600 codeset read
  documented in `framing-lumber-verification-report.md` §2. Same provenance
  and regeneration rules as above; OmniClass 23 stays NULL. The map now
  holds 491 entries (347 mapped / 69 ambiguous against the static corpus).

## Full packages

The complete research packages (normalization rules JSON, supplier price
observations, implementation recommendations) live in the workspace goal
directory, outside the repo:

`~/workspace/goals/tradeos-costbook-data-source-research/files/{framing-lumber,engineered-lumber,fasteners,concrete-masonry,insulation}/`
