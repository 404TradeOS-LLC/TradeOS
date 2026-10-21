# Estimate scope review freshness

Classification: NEW_WORK_REQUIRED. Base main `6096d806`; branch `fix/estimate-stale-athena-suggestions`. Open PRs #731/#732/#733 own onboarding, Entry and required CI. Existing estimator implementation is on main; no open stale-context repair was found.

Canonical reference: Figma `378:440` Scope context/screenshot inspected. Reuse existing contextual Athena, Button, Badge and semantic warning/status tokens. This slice restores current-scope review semantics; it does not implement target clarification states or redesign the estimator.

Concrete defect: review scope A, edit to B, then old suggestions retain working Add buttons. Code had no result-to-scope/estimate association and left old results actionable during refresh/error states. Fix: snapshot the requested project/estimate/trimmed scope, compare against current context, disable stale/loading/error/pending writes in both the control and handler, and show refresh guidance. A late response is bound to its original snapshot. Preserve explicit Add, existing API, sourceKey, quantities and tenant/pricing boundaries.

Allowed: contextual panel, pure freshness helper/tests, Current State/estimating/design docs. Excluded: backend, schema, auth/RLS, price calculations, dependencies, scope persistence and unrelated screens.

Verification: run three freshness predicate tests, full web suite, lint, typecheck/build and docs/preflight. Browser validation remains blocked; no visual parity, live API, RLS, merge/deployment or production claim. No static asset changes.

Next five TODOs:
1. Verify exact-head CI/review.
2. Update from the required integration gate fix once merged.
3. Exercise scope A → review → edit B → denied stale Add → refresh B → explicit Add in sanitized Preview.
4. Capture desktop/mobile warning/loading/error/late-response behavior and tenant negatives.
5. Continue approved Scope → Items → Price → Review gaps without enabling unsupported clarification.

Local validation: 479/479 web tests pass, including three scope/record freshness cases. ESLint, TypeScript, Next.js production build, docs/preflight and whitespace checks pass. The branch is updated to main `acfb78e6`, inheriting #733 real integration execution. No browser/backend mutation evidence is claimed.
