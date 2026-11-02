# TradeOS Forge — read-only Gatekeeper (initial slice)

This is a bounded first milestone for the proposed TradeOS engineering factory. It does not install Eve, run an agent, operate GitHub, deploy, migrate a database, or authorize a merge. Its only output is a next-gate recommendation for a PR snapshot.

The source of truth for PR eligibility remains scripts/merge-queue.mjs and the live GitHub ruleset; branch creation is governed separately by AGENTS.md and docs/agent-prompts/AUTONOMY_RECONCILIATION.md. Forge does not redefine those policies.

## Workflow

1. Run the existing autonomy reconciliation preflight before implementing a new issue. If a PR already owns the work, repair that PR instead of creating a duplicate.
2. Obtain a *complete* PR snapshot from the current head using PR_QUERY in scripts/merge-queue.mjs. Fetch all review threads and check contexts; incomplete pagination is a blocker.
3. Classify risk and record same-head staging and authenticated acceptance evidence. A PR description, old hosted check or local unit test is not proof of staging/production readiness.
4. Run the local, read-only command: node scripts/forge-gatekeeper.mjs path/to/snapshot.json
5. Investigate the single recommended gate. Re-read live GitHub state immediately before any protected decision. This command cannot itself establish live freshness or grant merge permission.

## Snapshot contract

The input is a JSON object with repository = "404TradeOS-LLC/TradeOS", pr = a full GraphQL PR_QUERY response pullRequest, and evidence = an operator-reviewed record:

- headSha: exact current 40-character PR head SHA
- risk: low or protected (unknown/missing fails closed)
- staging: not_required, verified, or missing
- acceptance: not_required, verified, or missing

For protected changes, staging and acceptance must both be verified. For low-risk changes, staging must explicitly be not_required; acceptance still requires an explicit classification. Missing or mismatched evidence blocks progress. These fields are operator assertions, **not independent verification**; the live ruleset, protected environment, and authenticated evidence remain authoritative.

## Boundaries and next phases

This milestone is read-only and deterministic. It cannot use production secrets, trigger protected workflows, modify tenant data, change branch rules, push to main, force-push, merge, or replace required reviews.

Next: integrate a least-privilege GitHub reader that captures complete head-bound snapshots; add a bounded repair agent with isolated worker execution; then add authenticated browser and staging evidence. Only after these pass repository checks should a separate Vercel/eve service be considered for unattended work.
