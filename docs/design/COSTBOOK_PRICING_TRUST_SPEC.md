# Costbook / Pricing Trust Workspace — Build-Ready Specification

## Outcome

Costbook should answer, with real evidence:

- What does this cost me?
- Where did the number come from?
- How fresh is the underlying observation?
- Which supplier/source is represented?
- Is this a catalog value, research evidence, or reviewed/promoted value?
- Which labor/equipment inputs are included?
- What changed?
- What should I use in this estimate?

It must not invent certainty.

## Current implemented foundation to preserve

Current repository documentation reports the canonical Costbook workspace already includes:

- divisions/categories/subcategories
- Materials
- Labor Rates
- Equipment
- Cost Items
- Assemblies and starter recipes
- calculation-only pricing preview
- Material price audit/history and Estimate pricing snapshots
- supplier proposal/review flow
- regional supplier evidence intake
- research review with explicit human review/promotion
- bounded search/filter/sort/pagination
- composite installed-price benchmark ingestion
- Assembly detail with recursively resolved current unit cost

Do not create a second Costbook or duplicate Estimate Workspace pricing controls.

## Current production component mapping

- Figma `PricingProvenance` maps to `web/src/components/costbook/pricing-provenance.tsx`.
- Catalog mode shows stored supplier/update facts and explicitly avoids confidence/current-local-market claims.
- Research mode uses `research-review-model.ts` for governed provenance labels, source/date/region/confidence presentation, review capability and factual age text.
- Figma `FreshnessIndicator`, `SupplierPriceRow` and `JobActualComparison` do not create a production enum/API by themselves; treat them as design contracts until backing data is proven.
- Open PR #506 owns Jones & Sons ingestion and must not be duplicated.

## Existing trust rules

Preserve the current product rule that ordinary catalog records do not receive invented labels such as:

- high confidence
- verified
- current local
- stale

merely because supplier/date fields happen to exist.

There is no canonical universal trust score and no canonical global stale threshold in the inspected current-state contract.

Research evidence may expose richer persisted provenance fields when they actually exist.

## Trust presentation model

### 1. Catalog fact

Show only persisted facts:

- name/code
- unit
- cost
- supplier name if stored
- last price update if stored

Missing supplier/date remains visibly missing.

### 2. Supplier observation/evidence

When the underlying evidence model supports it, show:

- supplier/source
- source identifier/reference
- observed/retrieved date
- region/branch basis
- unit
- observed price or unavailable/not-listed state
- review status

Do not convert unavailable/not-listed to zero.

### 3. Research candidate

When supported by the existing research contract, show:

- source/provenance status
- confidence field if persisted by that contract
- observation/retrieval dates
- named human review status
- promotion state
- promoted Cost Item link when present

Human review and promotion remain distinct actions.

### 4. Assembly

Show:

- assembly identity/scope
- output unit
- component quantities
- current recursively resolved unit cost
- setup-required mapping state
- component count

Do not invent:

- sell price
- margin
- job quantity
- component supplier/date provenance when the current detail contract does not supply it

Estimate-specific quantity and pricing snapshots belong in Estimate Items.

## Estimate handoff

When a Costbook/Assembly choice enters an estimate:

- the contractor explicitly selects/applies it
- source identity remains visible
- captured pricing uses the canonical estimate snapshot semantics
- later Costbook changes do not rewrite historical estimate pricing
- a refresh is explicit and reviewable
- a changed source/quantity/input makes the resulting price delta understandable

## Pricing freshness

Use factual date language first.

Examples:

- Updated Sep 28
- Observed Sep 25
- Retrieval date unavailable

A qualitative freshness state may be displayed only when the underlying product contract defines the threshold/meaning. Do not create a global stale threshold in UI copy.

## Supplier comparison

A supplier comparison may compare only normalized, commensurate evidence.

Before presenting one price as lower than another, confirm:

- same/equivalent item identity
- compatible unit
- comparable package/quantity basis
- applicable branch/region
- availability state understood
- dates visible

Do not silently normalize ambiguous package sizes or convert missing evidence into a winner.

## Open-work overlap

PR #506 currently owns a Jones & Sons ingestion implementation lane. This specification must not duplicate or supersede that data-ingestion work.

Before any Costbook implementation branch:

- inspect PR #506 current state/diff
- inspect any newer Costbook ingestion/review PRs
- continue an existing viable lane instead of opening a competing PR

## UI hierarchy

Primary surface order:

1. search/find the thing
2. see current cost and unit
3. understand provenance
4. compare/select when real evidence supports it
5. use in estimate
6. manage/administer deeper Costbook structure

Do not lead the contractor into hierarchy administration before answering the pricing question.

## Mobile

At 390 px:

- search first
- one price/source row at a time
- provenance collapses into readable disclosure
- `Use in Estimate` can be the dominant task action only when the current estimate context exists
- admin actions stay secondary

## Acceptance criteria

- Missing evidence is visibly missing.
- Unavailable/not-listed is not zero.
- Catalog and research evidence are visually/semantically distinct.
- Human review is attributable.
- Promotion is explicit.
- Historical estimate snapshots are not rewritten.
- Supplier comparison does not mix incompatible units/items.
- No universal trust score or stale threshold is introduced without a governed contract.
- Organization scoping and existing Costbook permissions remain intact.

## Next five TODO items

1. Reconcile PR #506 and any newer Costbook PRs before implementation.
2. Inventory every provenance field currently returned by Material, Research Review, Supplier evidence, and Assembly APIs.
3. Map those fields to one shared `PricingProvenance` grammar without collapsing distinct evidence types.
4. Prepare S064's embedded Assembly Picker using explicit add + snapshot/refresh behavior.
5. Add focused browser evidence showing missing evidence, unavailable evidence, setup-required, reviewed research, and a normal catalog item at 390/1440.
