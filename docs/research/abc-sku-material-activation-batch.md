# ABC SKU → Costbook Material Activation Batch (Proposal)

**Date:** 2026-10-23
**Status:** REVIEW-ONLY PROPOSAL. Nothing in this batch activates a Material,
creates database rows, or approves a price. Activation remains the operator's
separate decision, per product, through the single-item gate
(`app/scripts/activate-abc-supply-material.ts`, PR #701). PR #705 established
that new Materials require explicit reviewed activation; this batch is the
reviewable input to that decision for the full seeded ABC catalog.

## Why this exists

The 47802 seed (PR #682, workflow run 37873731035) landed 3,188 supplier price
observations, including **584 ABC Supply products**. The live database holds
those 584 ABC supplier products but **0 active Costbook materials** behind
them, and the seed deliberately does not promote workbook canonical keys
(`supplierPrices47802Seed.ts`). The supplier-price sync therefore proposes
nothing for ABC: no Material rows carry ABC SKUs. This batch maps every seeded
ABC product to a candidate canonical Costbook material, with provenance and a
stocking-unit verdict per row, so the operator can approve an activation batch
with evidence in hand.

## Deliverable

- `app/modules/costbook/abcSkuMaterialActivationBatch.ts` — the 584-row batch
  (generated; do not hand-edit).
- `app/scripts/generate-abc-activation-batch.ts` — the deterministic generator
  (`npm run costbook:generate-abc-activation-batch`). It reads only checked-in
  corpus data, never touches a database, and never calls the ABC API.
- `app/tests/costbook-abc-activation-batch.test.ts` — invariant tests:
  full 584-row coverage, every row UNAPPROVED, no invented candidates,
  PROPOSED gating rules, summary-count consistency.

## Results (2026-10-23 generation)

| Disposition | Rows | Meaning |
| --- | ---: | --- |
| PROPOSED | 157 | Exact SKU present, STRONG name evidence, no unit conflict. Ready for operator review — **not approved**. |
| REVIEW | 407 | Candidate proposed, but a blocking reason must be resolved first (see below). |
| UNMAPPED | 20 | Name evidence too weak to defend a candidate; workbook key retained for reviewer context only. |
| **Total** | **584** | One row per seeded ABC product. |

REVIEW reasons (rows can carry more than one): **378** rows have no SKU in the
seed source (398 of 584 rows overall carry no SKU; 20 of those are in the
UNMAPPED set), **111** carry a stocking-unit conflict, **44** have only
MODERATE name evidence.

| Unit verdict (PR #708) | Rows |
| --- | ---: |
| COMPATIBLE | 0 |
| CONFLICT | 128 |
| UNKNOWN | 456 |

**Zero rows are unit-COMPATIBLE, and that is the honest headline.** Under
PR #708, a stocking unit is verified only against a governed reference or the
live provider response. Workbook units are unverified: 456 rows are consistent
within their canonical key but remain UNKNOWN, and 128 rows CONFLICT — most
visibly architectural shingles, which ABC records per roofing square (SQ)
while the governed pilot material is stocked per BUNDLE. Every activation
still needs the provider stocking-unit verification step at activation time;
PROPOSED does not waive it.

Classification evidence (CANONICAL_MATERIAL_CODES, UNSPSC v8.1201): 192 rows
sit under a mapped key, 54 under an ambiguous key, 338 under an unmapped key.
Codes narrow candidates; they never alone establish identity.

## Method

- **Candidate:** the workbook `canonicalKey`/`materialName` each ABC product
  already carries in `app/modules/costbook/supplierPrices47802.ts`. No
  candidate is invented; where evidence fails, the row is UNMAPPED.
- **Name evidence:** Dice token-overlap between the ABC product name (brand
  tokens removed, light stemming) and the canonical material name. STRONG
  ≥ 0.4 — the acceptance band used for the priced-assemblies matching —
  MODERATE 0.25–0.4, WEAK < 0.25 (→ UNMAPPED).
- **Unit verdict:** workbook stocking unit (seed `purchaseUnit`) checked for
  within-key consistency and against the governed pilot catalog's reference
  units (`canonicalProductMatcher.ts`), under the PR #708 rule.
- **Provenance:** every row records its source file and URL. Source data is
  Billy's supplier costbook workbooks (Google Drive, observed 2026-09-13; row
  observations dated 2026-09-14), Terre Haute 47802, retail tier. **These are
  dated workbook observations, not live ABC API pricing** — no live ABC
  pricing ran for this batch, and prices must be refreshed before quoting.

## Limitations and operator notes

- 398 of 584 products have no SKU in the source. The activation gate requires
  an exact SKU, so those SKUs must be confirmed from the ABC catalog (the
  account/catalog discovery work) before those rows can activate.
- ABC's workbook canonical-key vocabulary (250 keys) is disjoint from the
  other five suppliers' shared vocabulary — no cross-supplier key
  corroboration exists in the corpus, which is why name evidence and
  classification are recorded per row instead.
- Variant rows (color/size) share one candidate material by design; the
  operator approves the material mapping, not each variant.
- Nothing here changes sync behavior. Once the operator activates materials
  through the gate, the existing sync and price-review flow (with PR #708
  stocking-unit enforcement) takes over.
