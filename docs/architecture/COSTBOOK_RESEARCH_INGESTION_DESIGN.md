---
status: current
owner: platform
last_verified: 2026-09-08
source_of_truth: true
related_code:
  - app/modules/costbook/provenance.ts
  - app/modules/costbook/candidateCostItem.ts
  - app/modules/costbook/candidateCostItemService.ts
  - app/prisma/migrations/20260908050000_add_costbook_research_candidates
  - app/backend/controllers/costbookCandidates.controller.ts
  - app/backend/routes/costbook.routes.ts
  - app/modules/knowledge-runtime/repository.ts
  - app/modules/knowledge-runtime/matcher.ts
  - app/modules/cost-database
  - app/modules/material-database
  - app/modules/labor-database
  - docs/reports/COSTBOOK_KNOWLEDGE_ENGINE_AUDIT_2026-09-08.md
  - docs/architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md
  - docs/modules/ai-estimate-assist.md
---

# Costbook Research Ingestion Design

## Why this document exists

The 2026-09-08 audit
(`docs/reports/COSTBOOK_KNOWLEDGE_ENGINE_AUDIT_2026-09-08.md`) found that
TradeOS has two disconnected "Costbook" systems — the relational Costbook
(the real, tenant-scoped pricing source Estimates consume) and the static
Knowledge Engine JSON corpus (an unscoped reference dataset used only for
AI Estimate Assist keyword matching) — with no write path between them, and
that 98.6% of the Knowledge Engine's items have no recorded provenance.

This document defines how future cost-data research (by a human, a script,
or a tool such as Gemini Deep Research or Claude) should enter TradeOS
**without** repeating that mistake: no researched number reaches a
tenant's live estimate, or becomes the next "unverified-legacy" pile,
without a recorded source and an explicit human review decision in
between. The candidate contract and the reviewed Stage 6 persistence,
review, and promotion service are now implemented; normalization and
Knowledge Engine regeneration remain deferred below.

## Target pipeline

```text
Research / source evidence
  -> candidate cost item          (app/modules/costbook/candidateCostItem.ts)
  -> normalization                (future: shared unit/trade normalization helpers)
  -> provenance + timestamp + confidence   (already required fields on the candidate)
  -> validation / review          (human reviewer; isEligibleForCostbookPromotion() gate)
  -> approved production Costbook item     [LANDED: app/modules/costbook/candidateCostItemService.ts]
  -> Knowledge Engine index/export         (future: regenerated from governed Costbook data)
```

Landed: the **candidate** stage's type/schema contract, the **provenance**
vocabulary it shares with the Knowledge Engine, and Stage 6's persisted
review queue and promotion service. Stage 3 (normalization) and Stage 7
(Knowledge Engine regeneration) remain future work — see "Deferred work"
below.

## Stage 1 — Research / source evidence

An external research process (a person reading a supplier catalog, a
script scraping a public government cost index, an LLM-assisted research
session) produces a **research package**: a plain, evidence-carrying
record, not yet validated against TradeOS's schema. Illustrative shape —
fit the real field names to `costbookResearchCandidateSchema` when
constructing one, this is not itself a wire contract:

```json
{
  "item": "30-Year Architectural Shingle Installation",
  "trade": "Roofing",
  "category": "Roofing",
  "unit": "SQ",
  "materialCostLow": 80,
  "materialCostTypical": 95,
  "materialCostHigh": 120,
  "laborHours": 1.5,
  "laborRateAssumption": 65,
  "equipmentCost": 15,
  "regionalBasis": "US national average",
  "sourceName": "Manufacturer published price sheet",
  "sourceUrl": "https://example.com/pricing/asphalt-shingles",
  "sourceDate": "2026-08-01",
  "retrievedAt": "2026-09-08T00:00:00.000Z",
  "confidence": "medium",
  "researchNotes": "Price sheet lists material only; labor hour and rate are an estimator assumption, not sourced."
}
```

A research package produced by an AI tool is **evidence input**, not an
authoritative price. It carries the same obligation as a human researcher:
name a real source, or the candidate cannot pass validation (see Stage 2).
Do not scrape or reproduce copyrighted/licensed cost-data content (RSMeans
and equivalents) to populate `sourceUrl`/`sourceName` — cite only sources
TradeOS is actually permitted to reference; see the audit's Provenance and
Licensing Risk Assessment section.

## Stage 2 — Candidate cost item

The research package is parsed into a `CostbookResearchCandidate`
(`app/modules/costbook/candidateCostItem.ts`,
`costbookResearchCandidateSchema`, a Zod schema). Parsing enforces:

- required trade/category/item/unit/regional-basis fields;
- `materialCostTypical` plus optional low/high bounds, validated so
  low ≤ typical ≤ high;
- either `sourceUrl` or `sourceIdentifier` — a candidate with neither is
  rejected outright, not accepted with a blank provenance field;
- `sourceDate` and `retrievedAt`, so a stale candidate can later be
  distinguished from a fresh one;
- `confidence` (`"low" | "medium" | "high"`) — a qualitative research
  confidence, distinct from the Knowledge Engine's existing numeric
  `confidenceScore` (`schemas/cost-item.schema.json`), because a candidate
  is a research artifact nobody has scored yet;
- `provenanceStatus`, reusing the same
  `"documented" | "unverified-legacy" | "placeholder"` vocabulary as the
  Knowledge Engine (`app/modules/costbook/provenance.ts`) — one vocabulary
  for "how much do we trust this number," not two;
- `reviewStatus`, defaulting to `"candidate"` and never defaulting to
  `"approved"`.

Parsing a well-formed research package into a candidate is a pure,
side-effect-free operation. It does not touch Prisma, does not touch an
organization, and does not require authentication — a candidate is not
tenant data yet; it is a proposal for the platform's own reference corpus.

## Stage 3 — Normalization (deferred)

Not implemented in this slice. Future normalization work should reuse, not
duplicate, exact patterns already established for the relational Costbook:
unit-of-measure conventions from `CostItem.unitOfMeasure`
(`app/prisma/schema.prisma`), and rounding via the shared `round2()`
helper (`app/modules/estimate-engine/formulas.ts`) that `cost-database`,
`assemblies-database`, and `knowledge-runtime` already share. A
normalization pass should not invent a third rounding or unit convention.

## Stage 4 — Provenance, timestamp, confidence

Already required at Stage 2 — a candidate cannot be constructed without
them. This stage exists in the pipeline diagram to make explicit that
these fields are not optional metadata bolted on later; they are part of
what makes something a valid candidate at all.

## Stage 5 — Validation / review

This is the **critical control boundary**: a candidate must never become a
production Costbook item merely because it parsed successfully or because
an AI produced it.

`isEligibleForCostbookPromotion(candidate)` (`candidateCostItem.ts`) is the
single function a future ingestion service must call before copying a
candidate's fields into a real `CostItem`/`Material`/`LaborRate` write. It
returns `true` only when:

- `reviewStatus === "approved"` (never `"candidate"` or `"needs-review"`,
  and never true for `"rejected"`);
- `reviewedBy` is a non-empty human reviewer identifier;
- `reviewedAt` is set.

The schema itself reinforces this: `costbookResearchCandidateSchema`
rejects any candidate whose `reviewStatus` is `"approved"` or `"rejected"`
without both `reviewedBy` and `reviewedAt` present. Nothing in this module
— no default, no helper, no code path — ever sets `reviewStatus` to
`"approved"` on its own. That transition must come from a human decision
recorded by a future reviewed service, the same review-first posture
already established for AI Estimate Assist
(`docs/modules/ai-estimate-assist.md`: "all generated drafts require human
review before line items are applied").

## Stage 6 — Approved production Costbook item (landed)

Implemented by `app/modules/costbook/candidateCostItemService.ts`
(`CostbookCandidateService`) and migration
`20260908050000_add_costbook_research_candidates`.

**Persistence.** `CostbookResearchCandidate` is a new, org-scoped Prisma
model persisting the Stage 2 contract's fields plus a review/promotion
lifecycle, mirroring the `SupplierPriceUpdate` staged-review precedent
(queued proposal -> named human reviewer -> approved/rejected) rather than
inventing a new review-queue shape. Forced RLS matches
`materials_write_policy`: any org member with `costbook.read` may see the
queue; insert/update requires `current_app_can_manage_costbook()`
(owner/admin), matching `costbook.write`/`costbook.manage` both being
owner/admin-only today. Database check constraints independently require a
named human `reviewedByUserId`/`reviewedAt` whenever `reviewStatus` is
`approved`/`rejected`, and require an approved review plus
`promotedAt`/`promotedByUserId` whenever `promotedCostItemId` is set — this
holds even if the application-layer gate is somehow bypassed.

**Review.** `POST /api/v1/costbook/candidates/:id/review` (`costbook.manage`,
mirroring supplier-integration's approve/reject boundary) records
`reviewedByUserId` as the authenticated caller's own user id — never a
free-text field, so a synthetic identity like `"AI"`, `"system"`, or
`"Claude"` can never be recorded as a reviewer. A claim predicate
(`updateMany` scoped to the row's current `reviewStatus`) makes concurrent
review attempts mutually exclusive, the same pattern
`SupplierIntegrationService.approve/reject` already uses.

**Promotion.** `POST /api/v1/costbook/candidates/:id/promote`
(`costbook.manage`) is the *only* code path that may copy a candidate's
fields into a real `CostItem`. It:

1. acquires a per-candidate Postgres advisory lock so two concurrent
   promote calls cannot both pass the "not yet promoted" check;
2. re-validates `isEligibleForCostbookPromotion()` against the persisted
   row — never trusting `reviewStatus` alone;
3. resolves an existing Subcategory in the organization's Costbook
   hierarchy whose name matches the candidate's `category`
   (case-insensitive); if none exists, it fails with a 422 explaining what
   to create rather than inventing Division/Category/Subcategory structure
   on the candidate's behalf;
4. writes any evidenced cost components (Material/LaborRate/Equipment)
   through the **existing** `CostbookService.createMaterial`/
   `createLaborRate`/`createEquipment` methods, then the `CostItem` itself
   through the **existing** `CostDatabaseService.create` — the same
   organization-scoped, RLS-forced write paths every other Costbook
   mutation already uses. No second write path or parallel pricing store is
   introduced;
5. records `promotedAt`/`promotedByUserId`/`promotedCostItemId` on the
   candidate in the same transaction, so a candidate can promote to at most
   one `CostItem`.

An approved candidate is a *starting point* an organization's estimator
reviews and adds to their own catalog — it does not appear automatically in
any tenant's live Costbook without that organization's own `promote` action,
consistent with the existing tenant-scoped Costbook model
(`docs/architecture/COSTBOOK_DOMAIN_ARCHITECTURE.md`). See
`docs/API_REFERENCE.md` for the full route contract and
`docs/CURRENT_STATE.md` for the plain-language summary.

## Stage 7 — Knowledge Engine index/export (deferred)

Not implemented in this slice. The target end state, per the mission this
document was written for, is that the Knowledge Engine's search/match
corpus is **derived from** governed Costbook data rather than existing as
an independently authored, separately maintained JSON tree. Concretely,
future work should regenerate (some or all of) `packages/knowledge-engine/
exports/json/costbook.json` from approved Costbook/candidate records
carrying real provenance, rather than continuing to hand-author entries in
`pipelines/generation/seeds/**` with no source trail. This slice does not
attempt that regeneration; the Knowledge Engine's static corpus is
unchanged in content (only `trade-progress.json`'s new `provenanceStatus`
field was added — see the audit-follow-up PR).

## What this design deliberately does not do

- It does not let any code path — AI-authored or otherwise — set
  `reviewStatus` to `"approved"` without a human `reviewedBy`, and it does
  not let anything other than `promote()` write a candidate's fields into a
  production `CostItem`/`Material`/`LaborRate`/`Equipment` row.
- It does not change any existing Knowledge Engine cost value, any existing
  production `CostItem`/`Material`/`LaborRate`/`Equipment` row, or any
  Estimate's persisted pricing. Promotion only ever creates new rows from an
  already-approved candidate.
- Promotion does not create Division/Category/Subcategory hierarchy on a
  candidate's behalf — it requires an existing Subcategory matching the
  candidate's `category` and fails with a 422 otherwise.
- It does not scrape, store, or reproduce licensed/proprietary cost-data
  content. A future ingestion tool must independently confirm it has the
  right to use whatever source it cites.
- It does not regenerate the Knowledge Engine's static corpus (Stage 7) —
  see below.

## Deferred work

- Stage 3 normalization helpers (unit/trade canonicalization for
  candidates).
- Stage 7: regenerating Knowledge Engine export data from governed
  Costbook/candidate records instead of hand-authored seed files.
- Item-level (not just trade-level) provenance once individual Knowledge
  Engine items carry their own source/date/confidence fields.
- Autonomous research integration (Gemini Deep Research, Claude, scrapers,
  or scheduled jobs submitting candidates) — Stage 6 is the controlled
  intake and promotion mechanism those systems would use; none of them are
  wired up yet, and every candidate today is submitted by whatever
  authenticated, owner/admin-permissioned caller invokes
  `POST /api/v1/costbook/candidates`.
- A richer normalization of the candidate's cost-evidence fields into
  Costbook components: today `promote()` maps `materialCostTypical` to a
  zero-waste Material, `laborHours`/`laborRateAssumption` to a LaborRate
  with `billRate` equal to the researched `hourlyCost` (no markup assumed),
  and the flat `equipmentCost` entirely to `operatingCostPerHour` (no
  ownership/operating split). An org can adjust any of these after
  promotion via the existing Costbook endpoints.
