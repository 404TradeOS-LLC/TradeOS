# TradeOS Build-Ready Package — 2026-10-01

This package turns the current product/design direction into bounded implementation work while implementation-generation capacity is constrained.

It is a working handoff, not a competing source of truth. Current `main`, canonical repository docs, the canonical TradeOS Figma master, and live CI/PR evidence remain authoritative.

## Autonomy preflight

- Repository: `404TradeOS-LLC/TradeOS`
- Base: `main`
- Base SHA inspected: `9e53cde9c35396bf5d5b2bd22b154c9b37e3d9de`
- Base commit: `ci: add guarded native merge queue and merge-group checks (#605)`
- Relevant live work inspected:
  - PR #506 — open Costbook Jones & Sons ingestion. This overlaps Costbook data ingestion, not this documentation package. Do not duplicate its ingestion work.
  - PR #507 — open financial intelligence. No direct overlap with this package.
  - PR #560 — merged S053 estimator implementation; PR #559 is closed/superseded. Do not create a second estimator implementation lane.
  - PR #520 — merged assembly-catalog mapping hardening; treat it as landed prerequisite context rather than pending overlap.
  - PR #553 — merged Today-command-surface cleanup; do not continue describing it as open.
- Design authority: `.stitch/DESIGN.md` names Figma file `xImUa9CYUjx3Cb3zTrkfnY` as canonical.
- Classification: `NEW_WORK_REQUIRED` for this documentation/specification package.
- Chosen action: create one docs-only branch and hand off the next implementation slices without changing runtime behavior.

## Important Figma reconciliation note

The written design contract lists the full canonical page structure, while the live Figma metadata call used for this pass enumerated only `00 — Product Design Cover` and `03 — Components`. The same live file does expose Estimate Workspace frames and motion components under those returned pages.

Treat this as a connector/enumeration discrepancy, not evidence that the other canonical pages are gone. Do not delete, recreate, or broadly restructure Figma until the page enumeration discrepancy is reconciled.

## Master TODO list

### P0 — do now

- [x] Reconcile live `main`, repository authority docs, open PR overlap, and canonical Figma key.
- [x] Create a bounded docs-only branch from current `main`.
- [x] Write the Estimate Workspace build-ready interaction specification.
- [x] Write the signature motion-system implementation contract.
- [x] Write the Costbook pricing-trust workspace contract.
- [x] Write the Customer Portal state matrix.
- [x] Figma page enumeration verified: the canonical file contains all 21 documented pages.
- [x] Reconcile `PRODUCT_COMPLETION_EXECUTION_MAP.md` to the one canonical Figma master and current merged PR state.
- [ ] Run documentation validation on this branch.
- [x] Open governed PR #607; required CI must verify the final head before readiness.

### P0 — next executable product slice

- [ ] Finish S053 certification against the implementation already merged through PR #560; do not open a duplicate estimator feature branch.
- [ ] Preserve the established loop: rough scope → Athena interpretation → at most one necessary clarification → reviewed Costbook/assembly choices → Estimate Items → Price → Review.
- [ ] Prove explicit human review before persistence; no silent AI write.
- [ ] Prove source/provenance and setup-required behavior.
- [ ] Retain 1440 / 768 / 390 authenticated evidence and permission/tenant denial evidence.
- [ ] Open a repair branch only if certification finds a concrete defect on current `main`.

### P1 — prepare now, implement only when eligible

- [ ] Prepare S059 customer-portal session/access certification from the portal state matrix.
- [ ] Prepare S064 embedded Assembly Picker implementation against the Estimate Items contract; do not start while S053 remains incomplete.
- [ ] Prepare S054 proposal/customer acceptance certification after its dependencies are satisfied.
- [ ] Prepare S066 mobile job action workspace against existing field contracts; do not invent offline capability.
- [ ] Prepare S065 takeoff MVP only after S053 + S064 are complete.

### P1 — design/system hardening

- [x] Confirm the production motion seam (`framer-motion` + existing CSS/reduced-motion protections) and map Figma motion primitives by purpose before implementation.
- [ ] Confirm reduced-motion behavior for every signature motion before implementation.
- [ ] Confirm that no routine hover, tab, row, or dashboard motion is being added only for decoration.
- [x] Reconcile Costbook trust copy so factual provenance is never converted into an invented universal score.
- [x] Classify current Customer Portal access/document/signature/payment states from current module docs; keep customer actions separate from staff capabilities and unsupported payment/legal claims.

### P2 — evidence and release follow-through

- [ ] Retain exact-head CI results for each implementation PR.
- [ ] Capture rendered browser evidence for release-critical UI at the required viewports.
- [ ] Preserve tenant isolation and forced-RLS evidence on every new persisted path.
- [ ] Update `docs/CURRENT_STATE.md` only after implementation has actually landed.
- [ ] Do not mark backlog work DONE from Figma, a build, or an unmerged PR.

## Next five implementation slices

Only the first item is currently actionable from the inspected backlog state, but its implementation lane already merged through PR #560. The action is certification on current `main`, not a second implementation. The others are preparation targets and must be re-reconciled immediately before implementation.

1. **S053 — Scope-to-Athena-to-estimate certification**
   - Current implementation evidence: PR #560 merged; PR #559 was closed as superseded.
   - Default action: certify current `main`; create `fix/s053-estimate-certification-findings` only if browser/runtime evidence exposes a concrete defect.
   - Outcome: prove one continuous, reviewable estimating act from rough scope to persisted Estimate Items.
   - Safety: no schema/RLS/payment/auth redesign; no silent AI writes.
   - Required verification: repository preflight/docs checks; applicable app + web tests/lint/build; Postgres/RLS evidence; authenticated 1440/768/390 rendered flow evidence; exact-head CI.

2. **S059 — Customer portal access and session certification**
   - Target branch when eligible: `feat/s059-customer-portal-session-certification`
   - Outcome: prove issuance/redeem/session/expiry/replay/revocation/cross-tenant denial.
   - Safety: preserve the separate customer principal, single-use link/session boundaries, forced RLS, and narrow customer capability surface.

3. **S064 — Embedded Assembly Picker in Estimate Items**
   - Target branch when eligible: `feat/s064-estimate-items-assembly-picker`
   - Outcome: search/select/preview quantity + provenance + explicit add without leaving Items.
   - Dependency: S053 complete.
   - Safety: no duplicate Costbook or estimator; no auto-apply.

4. **S054 — Proposal and customer acceptance certification**
   - Target branch when eligible: `feat/s054-proposal-customer-acceptance-certification`
   - Outcome: reviewed estimate → proposal → attributable customer decision under existing lifecycle contracts.
   - Safety: do not broaden contract-signature or payment semantics.

5. **S066 — Mobile job action workspace**
   - Target branch when eligible: `feat/s066-mobile-job-action-workspace`
   - Outcome: make the current job/project mobile surface action-first using existing field contracts.
   - Safety: no invented offline, GPS, messaging, timekeeping, or unsupported field persistence.

## Package files

- `docs/design/ESTIMATE_WORKSPACE_BUILD_READY_SPEC.md`
- `docs/design/SIGNATURE_MOTION_SYSTEM.md`
- `docs/design/COSTBOOK_PRICING_TRUST_SPEC.md`
- `docs/design/CUSTOMER_PORTAL_STATE_MATRIX.md`

## Verification for this docs-only package

Run before declaring this package ready:

```bash
git diff --check
npm run pr:preflight -- --base origin/main
npm run pr:test
npm run docs:test
npm run docs:check -- --base origin/main
```

Do not report these as passed until they actually run on the final branch head.


## Current-main reconciliation pass — 2026-10-01

The first five post-Figma handoff tasks are now active on this same PR lane:

1. Figma → production component/state traceability is recorded in `CORE_WORKFLOW_FIGMA_CODE_TRACEABILITY.md`.
2. Estimate Workspace was reconciled against the landed builder/assist/mobile contract; persisted lines do not carry all pre-apply Athena provenance, so no fabricated post-apply trust detail is allowed.
3. Customer Portal/Copperline was reconciled: Proposal and Invoice are read-only; pending Contract signing is the current customer mutation; Figma accept/change/pay/selection actions are target-only.
4. Field Workspace was reconciled against `/field`, FieldJobActions and its contract test; offline/photo/change/inventory capabilities remain target-only.
5. Costbook trust was reconciled against PricingProvenance/research-review logic: catalog facts stay factual, research provenance uses governed vocabulary, and no universal stale/trust threshold is introduced.

No runtime code was changed in this pass. A repair branch is warranted only if certification reproduces a concrete current-main defect.
