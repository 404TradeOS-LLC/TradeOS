# Estimate Workspace — Build-Ready Interaction Specification

## Outcome

Make the existing TradeOS estimator implementation-ready without creating another estimator or a second visual system.

Canonical product loop:

```text
ROUGH SCOPE
→ ATHENA INTERPRETATION
→ ONE CLARIFICATION IF NECESSARY
→ ITEMS
→ PRICE
→ REVIEW
→ COPPERLINE PROPOSAL
```

The four primary stages remain:

1. Scope
2. Items
3. Price
4. Review

## Governing contracts

- Current implementation and module docs define capability truth.
- Canonical Figma defines visual hierarchy and responsive composition.
- `.stitch/DESIGN.md` defines the written design contract.
- S053 is the current backlog gate for certifying Scope → Athena → reviewed Costbook/assembly → persisted Estimate Items.
- No AI suggestion may silently become a persisted estimate line.
- Mobile focused stages get one dominant next action.

## Stage contract

### 1. Scope

Primary job: capture enough rough contractor input for Athena to interpret the work.

Required states:

- empty / first entry
- editing
- submitting for interpretation
- interpretation available
- one clarification required
- interpretation failed
- restored/saved input

Rules:

- Preserve the contractor's raw scope separately from structured interpretation.
- Ask only one clarification at a time and only when the unresolved fact materially changes scope, quantity, assembly choice, price, or customer-facing promise.
- The clarification must allow a direct answer plus free text when needed.
- A failed interpretation keeps the raw scope editable and retryable.
- No estimate line exists merely because Athena produced a suggestion.

Primary mobile action examples by state:

- Interpret scope
- Answer and continue
- Review items

Never show two competing copper actions in the same focused stage.

### 2. Items

Primary job: turn reviewed interpretation into explicit priced work components.

Each proposed item must make the following distinguishable when the data exists:

- item/assembly identity
- quantity and unit
- material/labor/equipment composition where supported
- Costbook or Assembly source identity
- supplier/source provenance where supported
- missing mapping or setup-required state
- current calculated cost
- whether it has been explicitly accepted into the estimate

Required states:

- no reviewed suggestions yet
- suggested items awaiting review
- setup/mapping required
- accepted item
- edited quantity
- source changed
- price refresh pending
- refresh failed
- item removed
- all items reviewed

Rules:

- Suggestion ≠ persisted line.
- Setup-required cannot masquerade as zero cost.
- Supplier/date absence must remain missing evidence, not become a confidence label.
- Changing an assembly, supplier-backed input, quantity, or labor assumption must make the resulting price change reviewable.
- Embedded Assembly Picker belongs here once S064 is eligible; do not create a parallel catalog workflow.

### 3. Price

Primary job: show how the customer price is formed and surface unresolved price facts.

Required presentation:

- material subtotal where available
- labor subtotal where available
- equipment subtotal where available
- overhead/markup/tax only according to implemented estimate semantics
- customer total
- margin/profit only when backed by the actual estimate model
- unresolved price warning when a required item is not safely priced
- contextual Athena explanation only when it can cite the real inputs being discussed

Required states:

- ready
- recalculating
- unresolved pricing input
- refresh failed
- changed since last review

Rules:

- Do not fabricate a discrepancy, savings amount, confidence score, market comparison, or supplier availability.
- A change to price must preserve enough context for the contractor to understand what changed.
- Money remains exact to the persisted estimate semantics; display formatting must never become a new calculation model.

### 4. Review

Primary job: prove the estimate is ready for customer-facing proposal generation.

Checklist should reflect real readiness only:

- scope reviewed
- items reviewed
- required pricing resolved
- customer-facing scope/exclusions available
- total derived from current estimate state
- any supported acceptance/validity terms present

Required states:

- incomplete
- ready
- proposal creation requested
- proposal creation failed
- proposal created

Rules:

- A successful UI state appears only after the backend operation is acknowledged.
- Failure must retain the reviewed estimate and provide a retry path.
- Proposal generation is a lifecycle handoff, not an animation-only success.

## Cross-stage behavior

### Save and restore

- Never imply data is saved from local UI state alone.
- If persistence is pending, label it as pending.
- If save fails, keep user input and show the failure at the point it matters.

### Back navigation

- Moving backward must not silently discard accepted edits.
- If the implementation has unsaved state, require an explicit decision before destructive navigation.

### Athena

Athena is contextual intelligence inside the estimator, not a generic chat surface.

Athena may:

- interpret rough scope
- identify missing facts
- suggest Costbook/Assembly matches
- explain why a source/assembly appears relevant
- explain a price change from real estimate inputs

Athena must not:

- silently persist estimate lines
- invent supplier evidence
- invent customer requirements
- invent measurements
- present uncertainty as verified fact
- imply a backend write succeeded before acknowledgement

## Responsive contract

### 390 px

- stage track remains visible but compact
- one dominant bottom action
- primary work surface gets the viewport; secondary context becomes inline disclosure/sheet
- controls remain thumb reachable
- no horizontal data table dependency

### 768 px

- split context only when it materially helps review
- Items remains the central surface

### 1024 / 1440 px

- use width for provenance, explanation, and review context
- do not turn the estimator into a dashboard card wall

## Acceptance criteria for S053 implementation

- Rough scope can be submitted and restored on failure.
- Athena interpretation distinguishes suggestion from persisted truth.
- At most one necessary clarification is presented at a time.
- Reviewed Costbook/Assembly choices can be explicitly applied.
- Setup-required/missing-price states fail safely.
- Persisted Estimate Items retain source/provenance information required by the current contract.
- Price refresh after a reviewed change is explicit.
- 1440 / 768 / 390 flows preserve the same content priority.
- Permission failures and cross-tenant attempts do not leak data or imply success.
- No customer-facing proposal is created until the existing proposal contract acknowledges success.

## Certification and repair branch

PR #560 is merged and owns the landed S053 estimator implementation. PR #559 is closed as superseded. The next action is certification against current `main`, not a duplicate feature branch.

If certification exposes a concrete defect, use one bounded repair branch such as:

`fix/s053-estimate-certification-findings`

Required safety constraints:

- preserve JWT + organization membership + request-scoped forced RLS
- no auth/RLS redesign
- no payment/billing semantic change
- no duplicate estimator, Costbook, or Athena architecture
- no broad Dashboard/CRM/Schedule redesign

Verification commands must include the repository-required gates plus focused app/web tests for every touched surface. Retain rendered evidence at 1440 / 768 / 390 and exact-head CI before calling the slice complete.

## Next five TODO items

1. Run S053 certification against the PR #560 implementation already on current `main`.
2. Map each Figma Scope/Items/Price/Review frame to the landed production components/routes and record mismatches instead of assuming them.
3. If a concrete mismatch is reproduced, repair only the smallest root cause on one bounded branch.
4. Add focused regressions only for validated defects, preserving no-silent-write, setup-required, refresh-failure, and tenant-denial contracts.
5. Capture final authenticated 1440/768/390 evidence and update sprint/current-state evidence only after the governing completion gates are satisfied.
