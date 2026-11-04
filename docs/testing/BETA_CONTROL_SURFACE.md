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

## Post-merge follow-up risks — PR #915

Captured against supplied final head `c41f3db77e17cc8589b260527dcf7ca96c76ba2e` and the complete supplied PR conversation. These are unresolved risks, not release acceptance or evidence of production exposure. Live GitHub state was not queried in this post-merge action.

| Priority / boundary | Concrete risk and source | Required follow-up and closure evidence |
| --- | --- | --- |
| High — platform metadata authorization | `BetaReadinessPage` checks only the caller's organization owner/admin role before `getBetaSnapshot()`. The collector uses shared credentials for fixed TradeOS resources, with no internal organization/user restriction. Customer-organization owners/admins can therefore reach the same platform snapshot when configured. [Review evidence](https://github.com/404TradeOS-LLC/TradeOS/pull/915#issuecomment-6594344849). | Security owner must establish the approved operator audience before enabling privileged readers. A separately reviewed authorization change must deny unapproved organizations/users before external reads, retain role checks, and prove denied callers receive no snapshot and cause no collector calls. Do not invent an allowlist policy in this documentation change. |
| Medium — required-check correctness | `parseRequiredCheckPolicy` combines multiple ruleset app IDs for a context; `evaluateChecks` can verify it with only one app's success. Separate requirements may remain unsatisfied. [Review evidence](https://github.com/404TradeOS-LLC/TradeOS/pull/915#pullrequestreview-5759478900). | Preserve individual applicable requirements and add a regression fixture with two app-bound rules for one context: one success must not verify both. Confirm semantics against authoritative GitHub rules before changing the evaluator. Promotion remains denied today. |
| Medium — misleading PR summary | `PrCard` can show verified with passing checks/reviews despite a closed PR, a behind branch, unknown mergeability or unknown draft state. The promotion gate denies these states, but the summary can mislead an operator. [Review evidence](https://github.com/404TradeOS-LLC/TradeOS/pull/915#pullrequestreview-5758445119). | Require verified branch/draft/open state for a verified card and cover these combinations with rendered-component tests. Keep the detail and summary consistent. |
| High — security validation gaps | The added tests exercise pure helpers, not the page authorization or `getBetaSnapshot()` fetch orchestration. The unknown-thread promotion test asserts only denial, which always occurs even if that guard disappears. [Review evidence](https://github.com/404TradeOS-LLC/TradeOS/pull/915#pullrequestreview-5746824515). | Add behavioral route tests for session/token failures, denied roles, organization restrictions and settings timeout/401/403; mocked collector tests for pagination exhaustion, malformed responses, missing credentials and request failures; assert the specific incomplete-PR reason with otherwise valid proof. Capture authorized owner/admin and denied technician acceptance at 1440/1024/768/390 on approved synthetic nonproduction accounts. Hosted CI reported in the final PR description does not supply this authenticated evidence. |
| High — release/data integrity evidence | All protected gates still initialize to unverified with no proof. Vercel branch/target metadata does not attest effective database bindings. No dashboard merge establishes migration, forced-RLS, tenant-denial, private-receipt, concurrency or rollback acceptance. | Release owner must retain HOLD until exact-source staging inventory/checksums, approved protected runs, ledger postflight, runtime binding attestation and full validated Beta Evidence artifacts are independently reviewed. Preserve the completed `20261028151000_accepted_proposal_job_handoff` checksum and never replay it. Any evidence adapter needs separate review; green CI must not populate these gates. |
| Medium — documentation and dependency drift | `docs/CURRENT_STATE.md` still labels #915 unmerged/proposed; dependency prose describes #905/#906 as proposed even though collection supports closed-unmerged disposition. Older PR summaries conflict with the final-head CI report. | Documentation owner should reconcile merged source status and dependency disposition against verified landed/current state, retain the distinction from production deployment, and link exact-head checks separately from missing authenticated/release evidence. Do not treat historical PR prose as live state. |

The four final-head repairs (collector-error downgrade, conflicting same-name statuses, closed-unmerged alternate lanes, and failed review reads) are present in the supplied code and are not reopened here. No API/schema migration was introduced by #915. Reader scope approval and head-specific independent release review remain separate requirements; this register authorizes neither credentials nor operational execution.
