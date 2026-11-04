# Beta readiness control surface

Path: `/beta-readiness` (TradeOS web application, authenticated owner/admin only).

This is a **read-only observation console** around `.github/workflows/beta-evidence.yml`, not a new test runner, migration executor, deployment orchestrator, release approver, or merge bot. The existing workflow remains the sole canonical preflight/full evidence runner. The site never dispatches workflow runs, writes databases, touches production, uploads receipts, or changes PR state.

## Data sources

- Live GitHub REST: PR heads, branch currency against current `main`, mergeability, check runs on the **exact head** SHA, branch-required check contexts, review records, and recent Beta Evidence Actions runs.
- Live GitHub GraphQL: resolved/unresolved review threads (requires a server-side read-only token; if unavailable or paginated beyond the supported coverage, report `UNVERIFIED`).
- Optional Vercel read-only deployment observations: recent non-production API/web commit SHAs and readiness. This is *metadata*, never proof of runtime data-plane identity. The console does not read secret values.
- Protected staging DB ledger, checksum checks, RLS evidence, storage security, runtime effective bindings, browser screenshots, role/isolation tests, rollback and concurrency evidence are displayed `UNVERIFIED` until an authoritative, independently verified evidence integration is provided. Do not derive them from PR descriptions, green CI, or workflow names.

Server-only optional environment variables:

- `TRADEOS_GITHUB_READ_TOKEN`: minimal read-only repository access; enables protected policy reads and GraphQL review threads. **Never prefix with `NEXT_PUBLIC_`.**
- `TRADEOS_VERCEL_READ_TOKEN`, `TRADEOS_VERCEL_TEAM_ID`, `TRADEOS_VERCEL_STAGING_API_PROJECT_ID`, `TRADEOS_VERCEL_STAGING_WEB_PROJECT_ID`: optional non-production metadata. Never provide production project IDs for this console. Never treat deployment metadata as runtime-binding proof.

If required checks or thread state cannot be fetched, release readiness fails closed. The UI refreshes source reads when the operator selects **Refresh live**; no snapshots are cached between refreshes. Staging and browser gates cannot be toggled by the operator.

## Dependency order

1. #810: canonical accepted-Proposal → Job handoff. Staging Job handoff migration is **already applied**; preserve its checksum, never replay.
2. #907: merged protected staging-only Expense migration runner. Its source merge is **not** migration execution.
3. #905 / #906: overlapping proposed staging paths. Reconcile their remaining unique value with #907 and dispose of superseded paths under review; **do not merge both**.
4. #891: Expense/payer feature requiring separately approved baseline and payer migration, staged ledger/RLS proof, private receipt acceptance, role/tenant checks, and four widths.
5. #904: separate staged Job UI promotion after ledger/source parity, followed by authenticated step-9/concurrency/rollback evidence and final review.

## Security model and caveats

- Authenticated TradeOS session and owner/admin organization role required **server-side**. Unknown role denies access.
- GitHub and Vercel credentials are server-only; all browser props contain non-sensitive public metadata.
- No API mutation routes. No GitHub dispatch, commit, merge or review writes. No production target support.
- `gatePromotion` deliberately denies all promotion even if every observed signal turns green: human-controlled protected workflows remain outside the console.
- Reviews/comments and workflow run status are not independently approved release evidence. Required checks must be head-specific; workflow runs must be correlated to the exact RC and authoritative artifacts in the canonical evidence process.
- Query counts and API permissions can affect completeness; missing data is `UNVERIFIED` rather than green.

## Verification

`cd web && npm test` (repository test command). Focused: `node --experimental-strip-types --test src/lib/beta-control.test.ts` when using Node 22 locally; Node versions in CI may strip TypeScript natively.