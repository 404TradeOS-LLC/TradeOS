---
status: current
owner: product-design
last_verified: 2026-10-02
source_of_truth: false
related_code:
  - web/src/app/globals.css
  - web/src/components/ui
  - web/src/components/shared
  - web/src/components/costbook
  - web/src/components/estimate-assist
  - web/src/components/field
related_docs:
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/ui-guide.md
---

# Product completion: design-to-implementation map

This is a working map for the founder's whole-product UI program. The
[Sprint Backlog](../SPRINT_BACKLOG.md) controls implementation eligibility and
dependencies; [Current State](../CURRENT_STATE.md) controls shipped behavior.
The canonical written visual contract landed through [PR #558](https://github.com/404TradeOS-LLC/TradeOS/pull/558). Do not treat a design specification as shipped runtime behavior; Current State and live implementation remain authoritative for implemented capability.

## Design source and handoff

- Canonical Figma product file: [TradeOS Product + Design System Source of Truth](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY).
- Production token authority: `web/src/app/globals.css`. The Blueprint and
  Carbon Figma color variables map to CSS variable names, not independent
  design values. The OKLCH colors have approximate sRGB previews in Figma;
  validate rendered CSS for exact contrast. Solid semantic hex values retain
  their exact production values.
- Production component authority: `web/src/components/ui/` and
  `web/src/components/shared/`. A Figma component is a specification; its
  behavior, data, and accessibility come from the production component.
- The live Figma connector used on 2026-10-01 enumerated only `00 — Product Design Cover` and `03 — Components`, while the canonical written design contract lists the full working page structure. Treat that as a connector/enumeration discrepancy, not evidence that the other canonical pages are absent. Do not recreate or delete pages until the discrepancy is reconciled.
- Canva owns subsequent marketing and sales materials after approved product
  screenshots and logo masters are available; it does not define product UI.

## Existing production seams to reuse

| Need | Existing owner | Next design-system task |
| --- | --- | --- |
| Color, type, radius, motion, themes | `web/src/app/globals.css` | Reconcile Figma swatches against both themes and current CSS; no wholesale retokenization. |
| Buttons, inputs, select, checkbox, card, badge | `web/src/components/ui/` | Document real variants, keyboard/focus, validation and small-screen states. |
| Page header, row links, priced rows, status | `web/src/components/shared/` | Map Figma variants to `PageHeader`, `ListRowLink`, `LineItemRow`, `StatusBadge`. |
| Navigation and create/command entry | `AppNav`, `GlobalCommandPalette` | Verify Control Dock at 390 px before changing labels or routes. |
| Today / decision queue | `TodayCommandBoard` | PR #553 is merged; preserve the single Today command surface rather than reintroducing duplicate dashboard regions. |
| Scope and contextual Athena | `web/src/components/estimate-assist/` | PR #560 is merged and PR #559 is closed/superseded; finish S053 certification on current `main` and retain explicit review before any estimate write. |
| Costbook and assembly catalog | `web/src/components/costbook/` | PR #520 is merged; S064 remains gated by S053 completion, with provenance and setup-required states preserved. |
| Field actions | `web/src/components/field/` | Build on merged PR #554 and S057 evidence before S066 expansion. |

Keep page files thin and reuse established API paths. Never copy a proposal,
invoice, or estimate status treatment into a second one-off component.

## Vertical slices and acceptance gates

| Order | Contractor outcome | Backlog gate | Design and production handoff |
| --- | --- | --- | --- |
| 0 | Consistent foundation | This map plus merged PR #558 | Audit existing tokens and components; map the canonical Figma source and release contract; verify 390/768/1024/1440, light/dark, focus, loading, error, and empty states. |
| 1 | Rough scope becomes reviewed priced estimate | S053 certification, then S064 | PR #560 landed the contractor-first estimator flow; certify one clarification at a time, explicit reviewed add, provenance, persisted refresh, and responsive behavior before unblocking S064. |
| 2 | Customer can review and approve work | S059 then S054 | Portal access and scope first; proposal acceptance, signature, and deposit behavior follow their separate governed contracts. |
| 3 | Customer work becomes dispatched field work | S052, S056, S057, then S061–S067 | CRM → project/job → schedule → field; preserve existing identity, conflict, and job transition rules. |
| 4 | Work changes can be priced and billed | S068, S058 | Change order review, invoice, payment state; protect historical snapshots and exact money values. |
| 5 | Plans and actual job cost connect to estimates | S065 and later eligible financial/time work | Reviewable quantities → assemblies → estimate; then expenses/time → estimated versus actual. |
| 6 | Whole product reads as one workspace | S070 and dependent readiness | Search, inbox, create, documents, communication, settings, onboarding and cross-workflow return/refresh behavior. |

For each eligible slice: product flow and states → Figma responsive specification
→ shared component mapping → implementation → focused tests → rendered mobile
and desktop review → backend/permission evidence → governed PR. Do not mark a
slice complete from a Figma frame, API test, or green build alone.

## First five implementation tasks

1. Reconcile the live Figma page-enumeration discrepancy before any structural page rewrite; keep file `xImUa9CYUjx3Cb3zTrkfnY` as the sole product-design authority.
2. Certify S053's landed PR #560 Scope → Athena → reviewed Costbook/assembly → Estimate Items path on current `main`; do not recreate the superseded PR #559 lane.
3. Prepare S064's embedded Assembly Picker only after S053 completion, building on the mapping hardening already merged through PR #520.
4. Complete the customer-portal transaction-state specification against S059/S054 contracts, then implement only eligible slices.
5. Carry the signature motion system into production only where TradeOS is understanding, connecting, changing, or completing, with acknowledged state and reduced-motion behavior.

## State rules that apply across screens

- No invented supplier prices, customer activity, crew location, score, or
  payment success. Label missing evidence and blocked actions clearly.
- Reserve copper for primary brand action; warning/success/info/destructive
  colors communicate their own semantic states. Never use the historical
  design bundle to override current contrast-corrected CSS.
- Mobile action priority comes before analytics. Show a single dominant next
  action when one exists, and make overflow actions reachable without hover.
- Athena suggestions stay distinguishable from reviewed, persisted records.
- Sending customer communication, moving a job, accepting a proposal,
  changing pricing, and applying AI output require their domain-specific
  confirmation and authorization paths.
