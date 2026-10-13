# P0 First Estimate quick-start — initial implementation slice

Status: **draft / NOT DEMO CERTIFIED** (2026-10-13).

Canonical Figma: [TradeOS / 22 — Onboarding](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=54-3).
The Figma First Estimate views remain **TARGET** until exact-head runtime evidence is collected.

## What this PR does

- Gives an authenticated CRM writer a real `/onboarding` route to create the first Project and draft Estimate.
- Uses a dedicated first-estimate server action over the existing Project/Estimate APIs and `GET /api/v1/customers`; no new backend persistence path.
- Requires a real project name and work description; the server persists `Project.simpleScope` then creates the draft Estimate with the existing backend before navigating to it.
- Gives empty organizations a single primary next action on Today. Existing organizations are not automatically sent through setup.
- Provides a direct **Go to Today** path. Optional Customer lookup errors are displayed rather than misreported as an empty result.

## Truth / constraints

- The Figma `STEP 3 OF 3` is **not** implemented as a three-step persisted wizard. This slice implements the first useful value screen only.
- The action creates a **draft**, not automatically priced items. Structured Athena generation and applying reviewed lines remain separate.
- No fictional labor rate, location, supplier availability, verified price, or customer record is shown.
- No tenant bootstrap, RLS, authentication bypass, migration, ABC integration, payments or supplier synchronization change.
- No new auto-redirect for returning users.
- A failed draft Estimate POST retains the confirmed Project ID and controlled form inputs. Continue with saved project reauthorizes the reference through the current session and opens a persisted draft or the Project workspace. Resume never repeats either POST, including when an earlier request commits late. Saved fields are read-only. Action state is not authorization: malformed references and inaccessible Project reads fail closed.
- Existing onboarding target status must not be relabeled as shipped until PR checks, authenticated browser evidence, and full first-estimate workflow pass.

## Acceptance gates before demo

1. Web lint, typecheck/build, focused source contracts and repository checks pass at exact PR head.
2. Authenticated synthetic owner can reach `/onboarding` (unauthenticated requests redirect to login).
3. At 1440, 1024, 768 and 390px, submit a real job scope; verify Project and draft Estimate created once, and `Project.simpleScope` survives reload.
4. Confirm the new draft reaches the Estimate Workspace, review-first Athena is nonmutating until explicit Apply, and inaccurate Costbook data cannot be silently approved.
5. Verify returning organizations see Today normally; denied roles/foreign tenants cannot write; retry an interrupted creation without duplicate Projects/Estimates.

## Five next TODOs

1. Verify saved-project recovery against a sanitized non-production backend, including delayed commits and denied access.
2. Add a persisted skip/resume or first-value state only after choosing its tenant-scoped data model and measuring actual activation.
3. Complete desktop/mobile Figma parity and explicit loading/error/permission states.
4. Run the canonical Beta Evidence flow with 1440/1024/768/390 screenshots and tenant-isolation checks on a sanitized non-production deployment.
5. Certify Entry → Today → first estimate with exact deployed SHA; only then consider the P0 demo-ready.

## Verification checkpoint — 2026-10-13

Nine behavioral workflow tests and all 489 web tests pass; lint, TypeScript and production build pass locally. Docs ownership/preflight pass. No authenticated browser, live RLS or production verification is claimed. The pinned Chromium v1248 download returned an invalid ZIP, preventing viewport/keyboard/console evidence.

Desktop Figma context/screenshot `58:2` and mobile `59:4` were inspected. Full parity remains open: standalone onboarding shell, persisted step progression, known work/labor/region defaults, example controls and automatic Athena interpretation are not delivered by this repair. Figma remains TARGET. The primary button now uses the target's Build My First Estimate wording, with explicit saved-project recovery states.

Lost initial Project responses without an ID, reload recovery and cross-tab submissions remain limitations. The UI directs contractors to check Projects before resubmitting an ambiguous initial save. Backend idempotency is not claimed. See `FIGMA_TO_CODE_EXECUTION_LEDGER.md` for continuation.

Review repair: Today CTA, onboarding form and action consult the backend-reported role against canonical `crm.write`. Unknown/failed role reads fail closed; technicians/viewers see restricted feedback. This changes presentation, not backend role policy.
