# Entry control parity — 2026-10-13

Classification: **NEW_WORK_REQUIRED** after fetch/prune, open/closed PR and branch/commit reconciliation. Entry implementation #640 is merged; no open Entry-control repair lane was found. #731 is the independent onboarding lane.

Base: `6096d806782382c987c7e0c15df1da9cb4d30ad4`.
Branch: `fix/entry-mobile-control-parity`.
Allowed: login page and meaningful Current State/design evidence docs. Backend/auth actions, shared primitive defaults, brand assets, dependencies, onboarding and schema are excluded.

## Reference and change

Canonical Figma mobile response context/screenshot [548:2780](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=548-2780) specifies 48px Email, Password and Sign in geometry; recovery is 44px. Production shared Input is `h-8` and default Button is 36px, with no prior page override. Add `min-h-12` at these three page callsites and `min-h-11` for recovery. Expose the existing pending state as form `aria-busy`. Keep auth and password reveal unchanged.

## Verification and limitations

Run web tests, ESLint, TypeScript, production build, docs ownership/preflight and diff check. No new test that merely mirrors the class strings is added; existing Entry contracts preserve auth action, password reveal, assets and recovery links. Actual rendered 390/768/1024/1440 geometry, focus/keyboard, console health and assets still need evidence. Chromium installation was attempted with repo v1248 and runtime v1234; both returned invalid ZIP archives. No browser, full visual parity, merge, deployment or production claim is made by this document.

## Next five TODOs

1. Verify exact-head CI/review/currency and normal merge gates.
2. Measure Entry controls at all four viewports and verify password reveal/recovery focus targets.
3. Reconcile remaining brand-surface assets/slots against canonical default frames.
4. Map pending/invalid/connection/expired/reset states to supported auth responses without changing policy.
5. Verify authenticated Entry → Today; implement boot states only from actual workspace readiness.

Local verification complete: 476/476 web tests pass, ESLint and TypeScript pass, Next.js production build passes after installing worktree-local dependencies, docs ownership/preflight and diff check pass. The first build attempt with a dependency symlink failed Turbopack filesystem-root validation; no source/dependency change was needed. Browser evidence remains blocked.
