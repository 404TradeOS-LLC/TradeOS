# P0 First Estimate quick-start — initial implementation slice

Status: **draft / NOT DEMO CERTIFIED** (2026-10-13).

Canonical Figma: [TradeOS / 22 — Onboarding](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=54-3).
The Figma First Estimate views remain **TARGET** until exact-head runtime evidence is collected.

## What this PR does

- Gives an authenticated owner/admin a real `/onboarding` route to create the first Project and draft Estimate.
- Reuses `createProjectAction` and `GET /api/v1/customers`; does not introduce a second Project/Estimate persistence path.
- Requires a real project name and work description; the server persists `Project.simpleScope` then creates the draft Estimate with the existing backend before navigating to it.
- Gives empty organizations a single primary next action on Today. Existing organizations are not automatically sent through setup.
- Provides a direct **Go to Today** path. Optional Customer lookup errors are displayed rather than misreported as an empty result.

## Truth / constraints

- The Figma `STEP 3 OF 3` is **not** implemented as a three-step persisted wizard. This slice implements the first useful value screen only.
- The action creates a **draft**, not automatically priced items. Structured Athena generation and applying reviewed lines remain separate.
- No fictional labor rate, location, supplier availability, verified price, or customer record is shown.
- No tenant bootstrap, RLS, authentication bypass, migration, ABC integration, payments or supplier synchronization change.
- No new auto-redirect for returning users.
- A failed draft Estimate POST after a successful Project POST is a known recovery gap of the reused action. Follow up before demo certification with a tested, idempotent resume path.
- Existing onboarding target status must not be relabeled as shipped until PR checks, authenticated browser evidence, and full first-estimate workflow pass.

## Acceptance gates before demo

1. Web lint, typecheck/build, focused source contracts and repository checks pass at exact PR head.
2. Authenticated synthetic owner can reach `/onboarding` (unauthenticated requests redirect to login).
3. At 1440, 1024, 768 and 390px, submit a real job scope; verify Project and draft Estimate created once, and `Project.simpleScope` survives reload.
4. Confirm the new draft reaches the Estimate Workspace, review-first Athena is nonmutating until explicit Apply, and inaccurate Costbook data cannot be silently approved.
5. Verify returning organizations see Today normally; denied roles/foreign tenants cannot write; retry an interrupted creation without duplicate Projects/Estimates.

## Five next TODOs

1. Fix failed draft creation recovery/idempotency on `createProjectAction`.
2. Add a persisted skip/resume or first-value state only after choosing its tenant-scoped data model and measuring actual activation.
3. Complete desktop/mobile Figma parity and explicit loading/error/permission states.
4. Run the canonical Beta Evidence flow with 1440/1024/768/390 screenshots and tenant-isolation checks on a sanitized non-production deployment.
5. Certify Entry → Today → first estimate with exact deployed SHA; only then consider the P0 demo-ready.
