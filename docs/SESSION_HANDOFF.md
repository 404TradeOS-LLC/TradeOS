---
status: current
owner: platform
last_verified: 2026-10-21
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Active bounded mission — cinematic entry implementation, 2026-10-24

- `NEW_WORK_REQUIRED`, Sprint ID: NONE. Founder approved the cinematic Sites
  entry and directed product implementation. Branch `feat/cinematic-entry`,
  isolated worktree `/workspace/scratch/fb80abefb51d/tradeos-cinematic`, from
  main `7013cdcaab8faabcb9c0dd8e7a045ac776c9c748`. No existing open PR implements
  the entry; #787 is a separate Costbook controls lane and was left untouched.
- Allowed scope: `/login` presentation, scoped entry components, official
  vectors/fonts, renderer dependencies, entry tests and owner documentation.
  Existing auth/session/bootstrap, routes, backend, database/RLS and workspace
  themes remain unchanged. Approved design provenance is in `.stitch/DESIGN.md`.
- Implemented: silent mark-first copper scene, four/2.5-second timing,
  reduced-motion bypass, skip/focus/cleanup, GPU fallback, centered real sign-in,
  curated greetings, client validation and failure/pending retention. The
  Sites prototype's simulated auth and inspection affordances are excluded.
- Verified locally: 513 frontend tests, lint, TypeScript, production build,
  zero production audit vulnerabilities. Browser harness uses the production
  component with synthetic transport; it proves presentation/interactions only.
  Local component Playwright execution is blocked at launch by missing Chromium
  after the official CDN returned an invalid archive. No live successful auth,
  deployed Lighthouse score or real-GPU visual certification is claimed.
- Merge/deployment remain subject to exact-head hosted checks and repository
  review policy. Rollback: revert this bounded PR; no data migration exists.
- Next five: publish the bounded PR; inspect hosted browser and required checks;
  resolve scoped review findings; verify live staging auth and GPU/Lighthouse;
  merge through protection and verify the deployed entry with the approved design.


## Openings/appliance retarget and validation — PR #774 (2026-10-23)

- `EXISTING_WORK_FOUND`, Sprint ID: NONE. Existing branch
  `feat/costbook-openings-appliance-gaps-20261018` retained; original head
  `45278dcf`. Parent #773 is verified merged as `ef983efc`, with a landed tree
  identical to reviewed head `97709786`. Retarget #774 to main and reconcile
  the squash-merge ancestry without duplicating the parent's kitchen recipes.
- Preserve main's Estimate Builder changes, Figma checkpoint, dependencies and
  all three research scopes. Catalog total: 107. No schema, auth/RLS, financial
  policy, supplier pricing or Estimate snapshot change. Keep qualified
  installation, product-specific instructions and native EA mapping explicit.
- The JELD-WEN JII001 source repair is retained. Hono 4.13.13 is already on
  main through merged #783; the retargeted diff must contain no lockfile change.
- Fresh focused API/type/build/docs validation and hosted exact-head checks
  are required after reconciliation. No staging, browser or production
  certification is claimed; this task leaves #774 open after revalidation.
- Next five: validate the reconciled tree; publish to the existing branch;
  reconcile source/lockfile review findings; verify fresh required checks;
  record remaining review/certification limits for a separate merge decision.

## Retained parent review checkpoint

The following #773 checkpoint predates its verified merge as `ef983efc`;
its pending-merge instructions are historical. The retained Figma/runtime
certification boundaries remain in force.

## Costbook kitchen recipe reconciliation — PR #773 (2026-10-23)

- `EXISTING_WORK_FOUND`, Sprint ID: NONE. Continue
  `feat/costbook-kitchen-assembly-gaps-20261018`; original head `955492cb`.
  Reconcile with main `762bb992`, retaining its Estimate Builder implementation
  and the Figma handoff below. No new feature branch or numbered sprint.
- Preserve two price-neutral research scopes (wall cabinet EA, straight-run
  laminate LF), registered sources and tenant-owned exact-unit mapping.
  Catalog total: 104. No schema, authorization, RLS, financial policy or
  Estimate snapshot change; rollback is revert of the additive PR.
- The original head passed all four required checks, including live PostgreSQL
  integration/migration rehearsal. All three earlier inline findings are fixed
  and resolved. The reconciled head still requires fresh required CI and
  reviewed-head evidence before merge; authenticated mapping/install remains
  a separate nonproduction certification gate.
- Next five: validate the reconciled tree; publish on the existing branch;
  reconcile the stale review; verify exact-head checks and protected merge;
  verify landed main before retargeting and revalidating stacked PR #774.

## Retained Figma handoff checkpoint

The following checkpoint is preserved from main. PR #785 subsequently merged
as `762bb992`; its earlier pending-review text is historical. Its runtime and
certification limitations remain in force.

## Active bounded mission — Custom Item control ergonomics

Sprint ID: NONE. Founder-authorized Figma-to-code continuation, not a new
numbered sprint or release-certification claim.

- Classification: `NEW_WORK_REQUIRED` for scoped sizing/alignment only.
  Main `218639bc8d2ff2aa95d586e7dc072355bdf8e69e` includes prior progressive
  entry, explicit cost, preview retry and mapping keyboard repairs. Open PRs
  #782/#778/#775/#774/#773/#772/#744/#702 do not implement this repair.
- Branch: `fix/estimate-custom-controls`, isolated worktree from current main.
  The old `feat/figma-to-code-completion` lane is retained with its separate
  history; PR #781 already merged its preview-retry implementation.
- Changes: only Custom Item phone/tablet text-input sizing, Add/select and
  Taxable label targets, label spacing and desktop control alignment. Shared
  primitives, DOM order, mutation payloads, validation, defaults, and
  pending/failure/success behavior are preserved.
- Figma: authoritative handoff `793:11017` in master
  `xImUa9CYUjx3Cb3zTrkfnY`; sixteen initial/pending/failure/invalid specimens
  at 390/768/1024/1440 exist. These are design targets, not full-app runtime
  certification. The entire illustrated shell is outside this code slice.
- Verification: Web 507/507, lint, TypeScript and production build passed;
  documentation ownership and 40/40 documentation tests passed. Hosted run
  39713763198 at head 0da62c1 passed all eight Chromium component cases
  (Custom Item and mapping at all four widths). All four synthetic failure
  screenshots were downloaded and inspected. Artifact 12398047963 has SHA-256
  c7331692622edd8d51b573231b67662b679bdc67149e9503c0246a51909efdcf.
  This verifies isolated components with controlled transport, not authenticated
  persistence, tenant boundaries, the full shell, or deployed runtime.
- Current-head review identified a Web scope-filter gap. The repair includes
  component tests/config, root runner manifests and the workflow in Web scope.
  A real temporary-Git regression fails before the repair and passes after it.
  Current-head CI/review for this follow-up remains pending; do not merge
  based only on the prior green head. PR #785 is ready for review, not merged.
- The local autonomy helper could not query PRs because `gh` is absent;
  authenticated GitHub connector reads supplied current open/recently-closed
  PR reconciliation instead. No repository guard was weakened.

## Next five bounded TODOs

1. Complete exact-head CI and review for the scope-filter repair; retain the
   passing component evidence and inspect any new findings.
2. Merge this repair only
   when every applicable gate passes, then verify landed main content.
3. Reconcile Costbook search/result/cost-review Figma states and canonical entry.
4. Reconcile Add assembly picker entry and canonical pricing labels/totals.
5. Verify an isolated nonproduction target and sanitized fixtures for the
   authenticated Install → Add → reload/failure-recovery evidence lane.

## Standing boundaries

Existing S052/S053/S064/S066 and Assembly Catalog browser certification gates
remain open until their retained authenticated evidence passes. Production
readiness is separate from implementation. Preserve existing auth/RBAC,
forced RLS, Estimate snapshots and financial accuracy. Production credentials,
protected migrations, supplier activation and ABC API licensing remain governed
by their dedicated runbooks; this mission authorizes none of those operations.

## Next Eligible Sprint

Sprint ID: S073
Eligibility: S073 is `READY`; S051 is `DONE`; founder authorization is explicit.
Dependencies: S051 — DONE through merged PR #538.
Overlap check: Recheck live PRs/branches before starting; this non-numbered repair does not advance S073 or authorize a second active sprint.
Startup prompt: Execute S073 from current main using `docs/architecture/S073_RELEASE_CRITICAL_RLS_COVERAGE_PLAN.md` after canonical startup/reconciliation; stop on protected policy gaps.
