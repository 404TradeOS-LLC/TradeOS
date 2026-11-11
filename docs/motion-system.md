# TradeOS Motion System — Implementation Record

Branch: `feat/tradeos-signature-motion` (off `main` 7aa851cf). No PR opened;
opening one needs Billy's separate word.

## Provenance and reconciliation

Billy supplied the motion specification as an image on 2026-10-29
("TRADEOS MOTION SYSTEM — Make meaningful work visible", 21 sections,
dated 2026-10-01). That image spec is a design proposal, not proof of
implemented backend behavior — its own §01 says so.

The repository already contained a prior design pass,
`docs/design/SIGNATURE_MOTION_SYSTEM.md`. This implementation reconciles
the two instead of treating either as sole authority:

- Token values agree where both speak: state 240ms, signature ceiling
  640ms, reduced 100ms. The image spec's full token table (§02) is the
  one implemented here.
- The Figma Connection Line prototype loops a 2-second `scaleX` sequence.
  Both sources forbid shipping that loop: the repo doc calls it prototype
  evidence, not permission, and the image spec stops the datum when the
  process resolves. `ConnectionLine` therefore travels once and stops.
- The repo doc prefers the existing Framer Motion seam for stateful JS
  motion. This implementation uses CSS transitions/keyframes instead,
  because the image spec's contracts are all transform/opacity work and
  the repo already ships `tw-animate-css` plus a `--dur-*` token scale.
  Framer Motion remains an installed but unused dependency in `web/src`
  (verified: no `framer-motion` import in `web/src`). A future stateful
  sequence that genuinely needs JS-driven motion should reuse that seam
  rather than adding a third mechanism.
- The repo doc's package note (`framer-motion ^13.4.4`) is stale:
  `web/package.json` now carries `^14.6.0`. Not changed here.
- `.stitch/DESIGN.md` and `docs/design/SIGNATURE_MOTION_SYSTEM.md` were
  deliberately NOT edited: design authority and implementation truth stay
  separate. Reconciling the motion spec into the canonical Figma master
  is a design pass, listed under follow-ups.

## What was implemented

### Motion collection (`web/src/lib/motion/`)

- `tokens.ts` — the §02 table as typed constants: micro 120, state 240,
  resolve 320, connect 280, recalculate 220, advance 280, complete 240,
  signature 640, reduced 100 (ms); stagger 35ms capped at 105ms;
  displacement 4px; settle `cubic-bezier(0.16,1,0.3,1)`, transit
  `cubic-bezier(0.4,0,0.2,1)`, exit `cubic-bezier(0.4,0,1,1)`. No spring,
  bounce, or overshoot anywhere. Helpers: `staggerDelayMs` (capped),
  `figmaSecondsToMs` / `msToFigmaSeconds` (ms / 1000).
- `motion.css` — the CSS counterpart, imported by `globals.css`. Where a
  spec value already exists in production it aliases it (`--motion-micro`
  → `--dur-1`, `--motion-resolve` → `--dur-3`, `--motion-settle` →
  `--ease-emphasized`) instead of restating it. The pre-existing global
  `prefers-reduced-motion` override in `globals.css` is untouched;
  component-level reduced variants (static paths, no travel, no stagger,
  opacity-only ≤100ms) are added on top, plus a `[data-motion="reduced"]`
  variant for the stored user preference.
- `coordinator.ts` — the §17 interrupt coordinator: keyed by
  organization + entity + request/revision; `start()` aborts the previous
  signal for the same entity; `isLatest()` is the version guard that
  rejects stale arrivals; `acceptEvent()` deduplicates repeats. It owns
  request state only — never UI, business actions, or persistence.
- `preference.ts` + `use-motion-preference.ts` — §16 resolution:
  OS reduced-motion media query plus an optional stored user preference
  (`tradeos-motion-preference`); reduced always wins. The hook mirrors
  the result onto `<html data-motion>` so CSS honors the preference on
  surfaces that do not use the hook.
- `price-delta.ts` — §05 recalculate model in integer minor units only.
  Non-integer or non-finite input throws rather than rendering a rounded
  or zero price. Numbers swap in one commit; digits never roll.
- `lifecycle.ts` — §§06/13 state mapping (precedence blocked > changed
  > current > completed > upcoming; blocked/changed always labelled, not
  color alone) plus `markerGeometry`, the advance marker's FLIP
  measurement helper.

### Primitives (`web/src/components/motion/`)

Presentation-only, props-driven, no fetches, no mutations, no timers
that confirm persistence, no `animationend` business logic:

- `LifecycleLine` — contextual lifecycle, never navigation (plain list
  items, no links/buttons).
- `PriceDelta` — previous labelled "Previous" beside the new value,
  delta beside it, reason when known.
- `ChangeDiff` — previous / current / reason as readable text; no
  animation replaces the text.
- `ConnectionLine` — fixed SVG datum, travels once while pending, rests
  at full span when confirmed; failure keeps the source and renders a
  scoped retry only when the caller supplies one.
- `ResolveSequence` — raw input retained verbatim; categories reveal
  whole (never typed) with the capped stagger; unrevealed state is the
  neutral "Interpreting scope…" skeleton, never invented stages.
- `StatusRegion` — one `aria-live` channel (polite results, assertive
  errors); callers announce only genuinely new messages, so no counter
  chatter.

### The one wired surface (bounded proof)

Estimate builder stage navigation (`Scope → Items → Price → Review`):
a single copper marker now moves to the acknowledged active stage
(280ms transit; instant under reduced motion). Stage changes in this
surface are already acknowledged — `goToStage` awaits a successful scope
save before advancing — so the marker never moves on a prediction.
Semantics are unchanged: buttons keep `aria-current="step"`, focus moves
to the stage heading exactly as before, and the pre-existing mobile
contract test passes unmodified (attribute order on the `<ol>` was
adjusted so its source-shape assertion still matches; no test was
weakened, disabled, or deleted).

## What was deliberately NOT wired (follow-ups, not omissions by accident)

Per `docs/design/SIGNATURE_MOTION_SYSTEM.md` ("validate one motion end
to end before applying a pattern broadly") and the repo's smallest-scope
rule, the remaining image-spec adapters are follow-ups, each needing its
own acknowledged-state seam verified before wiring:

1. Scope/Items resolve + Athena interpretation states (ResolveSequence
   needs a real interpretation payload contract).
2. Provenance + supplier switch recalculation (PriceDelta needs a real
   previous-value source; no caller carries previous totals today).
3. Copperline estimate → proposal transformation (needs the confirmed
   document ID/version acknowledgement boundary).
4. Field voice/photo/change/dependency states.
5. Lifecycle/phase on Today, job, and invoice surfaces.
6. Actuals → future-assumption review states.
7. Payment + boot completion states (completion renders only on
   acknowledged payment + reconciled zero balance; that gate is backend
   truth, not animation).
8. Screen-reader announcement audit on physical devices, 390px + desktop
   browser evidence, and Figma reconciliation of this spec.

## Adapters wired in this phase (same branch, second commit)

Shared seams live in `web/src/lib/motion/adapters.ts` (pure mappings,
unit-tested): `jobLifecycle`, `invoiceLifecycle`, `draftCategories`,
plus `toMinorUnits` in `price-delta.ts`. Each mapping returns null when
the record does not support an exact mapping, so callers render the
existing badge/status UI alone instead of a promoted or invented stage.

1. **ResolveSequence → Athena interpretation (Scope/Items), WIRED.**
   The real contract is POST `/estimates/{id}/ai-estimator/draft` →
   `StructuredAIEstimateDraft` (verbatim `scopeOfWork` echo, detected
   trade, draft line items, validation block), review-only until the
   user accepts suggestions and applies them through the existing
   engine path. Wired into the assist page's "Athena review pipeline"
   card: categories are the draft line-item descriptions, in payload
   order, via `draftCategories`; revealed only when a payload has
   arrived and no newer generation is in flight (a regeneration
   invalidates the prior draft and shows the neutral skeleton with the
   scope captured verbatim in `onMutate`). Human acknowledgement
   (accept/apply) stays in the existing review flow; the sequence
   renders the interpretation only. The builder's smaller
   `ContextualAthenaPanel` (`/ai-suggestions`) was inspected and left
   unwired: one interpretation surface, done well, beats two.
2. **PriceDelta → estimate repricing, WIRED (supplier-switch: BLOCKED
   with cause, see below).** No caller carried previous totals, so the
   previous-totals source is implemented, not assumed: pricing
   mutations funnel through the builder's `invalidate`, and the
   snapshot is taken in `onSuccess`, when query data is still the
   pre-mutation server record (the refetch lands later). The Price
   stage renders "Last recalculation" only when the saved total
   actually moved. Reasons name the change ("Line item added/updated/
   removed", "Custom line item added", "Overhead / tax saved", "Athena
   suggestion added"). Deliberately excluded: finalize (locks the
   version, no price change), scope saves, pricing-mode switches (same
   math, different expression), and the starter-catalog `install`
   (writes the catalog, not the estimate). A real footgun was fixed
   en route: `finalize` previously passed `invalidate` bare as
   `onSuccess`, which would have fed the mutation result in as the
   reason once `invalidate` accepted one; it now calls
   `invalidate()` explicitly. USD is the product's existing money
   convention (both `formatCurrency` helpers hardcode it); estimates
   carry no currency field.
3. **Copperline estimate → proposal transformation, WIRED.** The
   confirmed boundary is the created proposal record itself:
   `createProposalAction` POSTs `/api/v1/proposals` and redirects to
   `/projects/{id}/proposals/{proposal.id}`. The proposal detail page's
   snapshot card renders `ConnectionLine` confirmed (Estimate →
   Proposal) only when `proposal.estimateId` is non-null. The creation
   form renders no confirmed line (nothing is created yet), and the
   preview page gets none either: preview must never mean generated.
   The form's existing "Creating…" state, error box, and
   check-proposals recovery link already cover pending/failed, so no
   duplicate pending/failed line was added. (Copy correction during
   the work: estimates have no "finalized" status — the enum is
   draft/ready/sent/viewed/approved/declined/expired/superseded — so
   the line says "Created from an estimate", not "finalized".)
4. **LifecycleLine → field, Today, job/invoice, payment, WIRED.**
   - Field page: the selected job renders "Job progress" for linear
     statuses only (scheduled → dispatched → traveling → on_site →
     completed). The field action model offers exactly one next
     transition per status, so prior stages are confirmed by the
     workflow itself. Unscheduled, paused, and cancelled render no
     line; the StatusBadge remains sole truth there.
   - Today: the selected work item renders "Job progress" only when
     its kind is `job` AND its plain status string maps exactly onto
     the linear job lifecycle. Tasks, visits, and any other status
     keep the existing status text alone.
   - Invoice page: "Invoice progress" (draft → sent → viewed →
     partially paid → paid) derives completion from the record's own
     fields, not stage order, because the product allows bypasses
     (office-recorded offline payments, mark-paid without a payment):
     draft by the record existing, sent by `sentAt`, partially-paid by
     a recorded payment. Viewed has no timestamp or delivery
     vocabulary on the record, so it is never claimed completed — it
     renders upcoming (view not recorded) unless it is the current
     status. Overdue and voided render no line.
   - Payment completion gate: paid renders as current only when
     `status === "paid"` AND `balanceDue === 0` (reconciled zero
     balance from backend truth). A paid status with any other
     balance (including negative or non-numeric) renders no line.
     Recording a payment refetches the invoice, so the line advances
     only on server-confirmed state.
5. **Actuals → future-assumption review, BLOCKED (exact gap).** No
   first-party actuals surface exists to wire: no actual-cost entity,
   route, or component was found (field-page "actual" hits are the
   `actualStart` timestamp and prose; Expense is target-only per
   `.stitch/DESIGN.md` §22 until persistence exists). The image
   spec's actuals adapter has no acknowledged-state seam in the
   product, so nothing was built for it rather than a fabricated UI.
6. **Supplier-switch recalculation, BLOCKED (premise mismatch).** No
   supplier-switch UI or endpoint exists in the estimate flow, and
   the product invariant forbids what the spec title implies:
   estimate prices are snapshots ("Estimate Engine captures a new
   snapshot on Add"; DESIGN.md §18: persisted prices "must not
   silently drift when Costbook changes later"). A Costbook supplier
   change must never recalculate an estimate. The PriceDelta wiring
   above therefore covers user-driven estimate repricing only.

## Still not wired

- Actuals (blocked, see above) and boot completion states.
- Field voice/photo/change/dependency states (no verified seam).
- Screen-reader announcement audit on physical devices, 390px +
  desktop browser evidence (§19), and Figma reconciliation of this
  spec.

## Guards that hold by construction

- Motion never delays an actionable result, hides uncertainty, invents
  source verification, or confirms persistence on a timer.
- No completion UI renders until the caller passes acknowledged state.
- No internal data is exposed in customer DOM, PDFs, or export snapshots
  by any motion primitive (they render only caller-supplied labels).
- No price is auto-completed, rolled, or calculated inside animation.
- Business state, permission gates, and financial controls are untouched:
  this branch changes no backend code, no schema, no workflow file, no
  secret, and no deployment configuration.

## Validation (exact commands, worktree `~/workspace/tradeos-motion`)

- `cd web && node --test 'src/lib/motion/*.test.ts'` — 26 pass, 0 fail.
- `cd web && npm test` — 559 pass, 0 fail (includes the 26 motion tests
  and the unmodified estimate mobile contract tests).
- `cd web && npm run lint` — clean (one real finding fixed during the
  work: `react-hooks/set-state-in-effect` in the preference hook,
  resolved with a lazy state initializer, not a suppression).
- `cd web && npm run build` — succeeds; the estimate page
  `/projects/[id]/estimates/[estimateId]` builds. Note: the first build
  attempt failed on Turbopack rejecting the worktree's symlinked
  `web/node_modules`; fixed with a real `npm ci` in the worktree
  (lockfile verified unchanged afterwards). No `package-lock.json`
  change is included in this branch.

### Adapters phase validation (same worktree, second commit)

- `cd web && node --test 'src/lib/motion/*.test.ts' 'src/components/motion/*.test.ts'` — 37 pass, 0 fail (32 lib tests + 5 adapter-contract tests).
- `cd web && npm test` — 570 pass, 0 fail (559 + 11 new: 5 adapter-mapping tests, 1 `toMinorUnits` test, 5 adapter-contract tests).
- `cd web && npm run lint` — clean.
- `cd web && npm run build` — succeeds (route table renders; no type errors).
- Two test-harness adjustments, neither a weakening: the field page's
  vm-sandbox test allowlist gained stubs for the two new field-page
  imports (the real `adapters` module plus a minimal `LifecycleLine`
  stand-in) and a new assertion that the scheduled job renders
  "Scheduled (Current)"; the estimate mobile contract test's
  `onAdded()` regex was widened to `onAdded(` because the add-success
  callbacks now intentionally carry a repricing reason — the
  success-to-parent-notification contract it pins is unchanged, and
  the exact reason strings are pinned by the new adapter-contract
  test.
- A real defect caught by the build during this phase: `finalize`
  passed `invalidate` bare as `onSuccess`, which would have fed the
  mutation result in as the repricing reason once `invalidate`
  accepted one; it now calls `invalidate()` explicitly. A second
  defect caught the same way: the repricing delta was first computed
  in `EstimateBuilder` while the Price stage renders in
  `EstimateStageFlow`; it is now passed as a prop.
- `npm run docs:check` — fails locally with the repo's known pre-existing
  gap, confirmed exactly: `Cannot find package 'minimatch' imported from
  scripts/docs-check-lib.mjs` (worktrees have no root `node_modules`).
  CI's Docs check arbitrates; the docs change here is
  `docs/motion-system.md` (new) plus the `docs/CURRENT_STATE.md` entry
  required by `docs/DOC_OWNERSHIP.yml` for `web/src/**` changes.
- App backend validation (`cd app && npm test ...`) — not run: this
  branch touches no `app/` code. CI still runs it on the branch.
- Browser evidence (desktop/mobile/reduced/error, §19) — NOT captured
  locally: no live-browser operation is available to this task. The
  existing journey `tests/playwright/estimate-stage-navigation.spec.ts`
  covers exactly the wired surface, but it skips without
  `TRADEOS_ESTIMATE_STAGE_PATH` + an authenticated storage state and a
  running app on :3000, none of which can be fabricated here — running
  it skipped would prove nothing. CI + a manual pass must run it with
  real inputs and supply before/mid/after + error captures on desktop
  and mobile before this is called done.
- Build-artifact evidence (verified, not claimed): the production build
  output contains the motion collection —
  `.next/static/chunks/3ol4v3yj6uezy.css` carries
  `motion-advance-marker` and `--motion-signature`.
