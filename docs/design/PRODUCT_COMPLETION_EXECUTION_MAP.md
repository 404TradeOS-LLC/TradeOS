---
status: current
owner: product-design
last_verified: 2026-09-25
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
The proposed visual contract is in [PR #558](https://github.com/404TradeOS-LLC/TradeOS/pull/558)
until that PR merges. Do not treat proposed screens as shipped features.

## Design source and handoff

- Figma product file: [TradeOS Product Design System](https://www.figma.com/design/fplIK62FyhCqnA5N1KLjei).
- Production token authority: `web/src/app/globals.css`. The Blueprint and
  Carbon Figma color variables map to CSS variable names, not independent
  design values. The OKLCH colors have approximate sRGB previews in Figma;
  validate rendered CSS for exact contrast. Solid semantic hex values retain
  their exact production values.
- Production component authority: `web/src/components/ui/` and
  `web/src/components/shared/`. A Figma component is a specification; its
  behavior, data, and accessibility come from the production component.
- The connected Figma Starter plan limits collections to one mode. Light and
  dark variables are currently separate collections. This does **not**
  implement a design-time theme toggle. The visible swatch board, component
  instances, and Code Connect mappings remain pending; the account reached
  its MCP call limit while composing the board.
- Canva owns subsequent marketing and sales materials after approved product
  screenshots and logo masters are available; it does not define product UI.

## Existing production seams to reuse

| Need | Existing owner | Next design-system task |
| --- | --- | --- |
| Color, type, radius, motion, themes | `web/src/app/globals.css` | Reconcile Figma swatches against both themes and current CSS; no wholesale retokenization. |
| Buttons, inputs, select, checkbox, card, badge | `web/src/components/ui/` | Document real variants, keyboard/focus, validation and small-screen states. |
| Page header, row links, priced rows, status | `web/src/components/shared/` | Map Figma variants to `PageHeader`, `ListRowLink`, `LineItemRow`, `StatusBadge`. |
| Navigation and create/command entry | `AppNav`, `GlobalCommandPalette` | Verify Control Dock at 390 px before changing labels or routes. |
| Today / decision queue | `TodayCommandBoard` | Reconcile open PR #553 before editing the dashboard. |
| Scope and contextual Athena | `web/src/components/estimate-assist/` | Reconcile PRs #559/#560 before S053 UI certification; retain explicit review before any estimate write. |
| Costbook and assembly catalog | `web/src/components/costbook/` | Reconcile PR #520 before S064 assembly selection; show provenance and setup-required states. |
| Field actions | `web/src/components/field/` | Build on merged PR #554 and S057 evidence before S066 expansion. |

Keep page files thin and reuse established API paths. Never copy a proposal,
invoice, or estimate status treatment into a second one-off component.

## Vertical slices and acceptance gates

| Order | Contractor outcome | Backlog gate | Design and production handoff |
| --- | --- | --- | --- |
| 0 | Consistent foundation | This map plus PR #558 | Audit existing tokens and components; map Figma source and release contract; verify 390/768/1024/1440, light/dark, focus, loading, error, and empty states. |
| 1 | Rough scope becomes reviewed priced estimate | S053, then S064 after PR #520 | One clarification at a time; explain cost and assembly matches; require explicit add and price refresh. |
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

1. Finish the visible Figma foundation board and make the light/dark token map
   inspectable; resolve the Starter plan's one-mode limitation before claiming
   a fully switchable Figma library.
2. Reconcile PR #558 and the stale color/radius/loading descriptions in
   `docs/ui-guide.md`; maintain one visual contract.
3. Certify S053's Scope → Athena → reviewed Costbook/assembly → Estimate Items
   path, accounting for PRs #559 and #560 rather than duplicating them.
4. Prepare S064's embedded Assembly Picker only when S053 is complete and
   PR #520's mapping gate is resolved.
5. Design the customer portal transaction states against S059/S054 contracts,
   then implement only the slices made eligible in the backlog.

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
