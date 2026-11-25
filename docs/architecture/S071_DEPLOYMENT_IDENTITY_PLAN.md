---
status: ready
owner: platform
last_verified: 2026-11-24
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/TRADEOS_BIBLE.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/RBAC_MATRIX.md
  - docs/ARCHITECTURE.md
  - docs/architecture/S073_RLS_COVERAGE_EVIDENCE.md
related_code:
  - app/backend/health.ts
  - app/backend/server.ts
  - app/scripts/s059-deployment-identity.mjs
  - app/scripts/s027-deployment-identity.mjs
  - app/scripts/beta-evidence/lib/staging-runtime-correlation.mjs
  - app/scripts/beta-evidence/lib/rc-target.mjs
  - .github/workflows/staging-orchestrator.yml
  - .github/workflows/s059-browser-evidence.yml
---

# S071 — Deployment Identity and Data-Plane Proof Plan

## Outcome

S071 must replace operator-attested RC data-plane identity with a safe
runtime build/environment identity contract: evidence automation verifies
commit, environment, backend host, and the non-secret data-plane identifier
from the deployment itself, and fails closed on any mismatch.

This sprint is contract + evidence-automation work over the identity
surfaces that already exist on current `main`. It is **not** a new
deployment pipeline, and it does **not** authorize a production change, a
secret, or a new trust boundary.

## Readiness reconciliation

- Dependencies: S051 (`DONE` through merged PR #538,
  `49cfb31ce8badf8a3440792e0f9aa7a8a01026db`). There is no other
  implementation dependency to satisfy.
- Current `main` at readiness start is
  `0d2ec04be885d885142c9ad039466fb6e347fd57` (ABC selected-price-probe SKU
  allowlist widened to ABC-provided test SKUs, #1076, merged 2026-11-24).
- Live GitHub overlap rechecked 2026-11-24: zero open PRs; no remote
  branch implements S071; no live S071 lane exists. The F7 public-portal
  approval/signature lane owns disjoint customer-portal/proposal files.
- What already exists on current `main` (verified in code):
  - `/health` reports `commitSha` from `VERCEL_GIT_COMMIT_SHA ??
    GIT_COMMIT_SHA` (`app/backend/health.ts`).
  - `/ready` reports the non-secret data-plane identifier
    `checks.database.projectRef`, resolved from `DATABASE_URL` /
    `SUPABASE_URL` and omitted when neither parses, so callers fail closed
    rather than guessing (`app/backend/health.ts`,
    `app/backend/server.ts` `/ready` route).
  - Per-workflow identity proof already exists:
    `app/scripts/s059-deployment-identity.mjs` (reused by the S068 and
    S069 browser-evidence workflows) proves before capture that the web
    origin is the expected READY Vercel deployment of the expected SHA and
    that the backend serving it reports the same SHA on `/health` and the
    expected non-production data plane on `/ready`, following the
    `correlateStagingRuntime` pattern in
    `app/scripts/beta-evidence/lib/staging-runtime-correlation.mjs`.
  - The staging orchestrator already correlates one SHA across both Vercel
    deployments and verifies runtime identity before capturing beta
    evidence.
- What is missing — the gap S071 closes:
  - The expected SHA is operator-attested: it arrives from the
    `BETA_RC_DEPLOYMENT_SHA` repository variable / `S059_EXPECTED_SHA`
    workflow input, not from the deployment itself. A wrong operator value
    is caught only as a mismatch, never as a wrong attestation.
  - The runtime publishes no environment and no backend host as part of
    its identity: nothing in `app/backend/` reads `VERCEL_ENV` or an
    equivalent, so evidence automation cannot verify from the deployment
    that it is staging/preview rather than production, or which backend
    host is actually serving the web origin.
  - Each browser-evidence workflow re-proves identity ad hoc
    (`s027-deployment-identity.mjs` fetches a full Preview env inventory;
    `s059-deployment-identity.mjs` proves from the live runtime instead);
    there is no single canonical identity contract they all share.
- What S071 still must prove: that evidence automation, given only the
  deployment under test, verifies the commit, the environment, the backend
  host, and the non-secret data-plane identifier against the expected
  values, and fails closed — refusing capture — on any mismatch, missing
  value, or unparseable identity, without fetching, decrypting, or
  asserting any secret or env inventory.

## Authoritative scope discovery

The implementation must derive the build set from current code, not memory:

1. Start with the runtime identity surfaces (`app/backend/health.ts`,
   `app/backend/server.ts`): what `/health` and `/ready` already publish,
   what each field's source is, and where environment/host would belong
   without leaking a secret. Any new field must be a public identifier
   (environment name, host) — never a credential, token, URL with
   embedded credentials, or env inventory.
2. Trace the existing identity scripts
   (`app/scripts/s059-deployment-identity.mjs`,
   `app/scripts/s027-deployment-identity.mjs`,
   `app/scripts/beta-evidence/lib/staging-runtime-correlation.mjs`,
   `app/scripts/beta-evidence/lib/rc-target.mjs`): which checks each
   performs, which values are operator-supplied vs deployment-derived,
   and where the single canonical contract should live so the
   browser-evidence workflows share it instead of re-proving identity ad
   hoc.
3. Trace the consumers: the S059/S068/S069 browser-evidence workflows and
   the staging orchestrator. The contract must slot into their existing
   pre-capture gates (identity proven before any capture; re-verified
   after capture so a deployment change during capture fails
   verification) without changing what they capture.
4. Trace the attestation inputs: `BETA_RC_DEPLOYMENT_SHA` and
   `BETA_RC_SUPABASE_PROJECT_REF`. The contract must state explicitly
   which of these remain operator inputs and which the runtime now
   derives, and must keep refusing production deployments and
   production data planes.

## Required evidence fields

Each build step must record:

- the identity field verified (commit, environment, backend host,
  data-plane identifier) and its source (runtime response vs Vercel API
  vs operator input);
- the expected value and where it came from;
- the mismatch/missing/unparseable case and the fail-closed outcome
  (capture refused, run failed, no evidence retained as passing);
- the workflow(s) consuming the contract and the pre/post-capture
  verification result;
- proof that no secret, env inventory, or credential was fetched,
  decrypted, asserted, or retained.

## Bounds

- No secret is fetched, decrypted, asserted, or retained. The contract
  verifies public identifiers only (commit SHA, environment name, host,
  Supabase project ref). Env inventories stay out of evidence automation.
- No production deployment or production data plane is ever accepted:
  the contract refuses production targets and production project refs
  the same way the current scripts do.
- No new deployment pipeline, hosting change, or trust boundary. S071
  binds the deployments and evidence workflows that already exist; it
  does not re-platform them.
- No silent fallback: a missing, unparseable, or mismatched identity
  field fails the run. The contract never substitutes a guessed value,
  a stale attestation, or a different deployment's identity.
- No new role, permission, auth/RBAC/RLS policy, schema/migration, or
  production data change is authorized by this promotion.

## Founder-decision boundary

NO for the bounded contract + evidence-automation work above. YES before
any production deployment or production data-plane acceptance, any new
secret or credential handling, any change to which environments count as
approved non-production targets, or any production database change.
S057's and S058's separate certification decisions are not dependencies
of S071 and are not decided by this promotion.

## Required validation

- Focused unit tests for the identity contract: each field verified,
  each mismatch/missing/unparseable case failing closed, production
  target/refusal cases, and no-secret handling (no env inventory
  fetched).
- Contract test shared by the consuming workflows: the S059/S068/S069
  browser-evidence identity gates pass through the single canonical
  contract instead of their ad hoc proofs, with pre- and post-capture
  verification.
- Live non-production evidence: a run against a real staging/preview
  deployment proving commit, environment, backend host, and data-plane
  identifier from the deployment, plus a negative run proving a
  mismatched SHA fails closed before capture.
- `git diff --check`; `npm run pr:preflight -- --base origin/main`;
  `npm run pr:test`; `npm run docs:test`;
  `npm run docs:check -- --base origin/main`;
  `(cd app && npm test && npm run lint && npm run build && npm run test:integration)`;
  applicable web test/lint/build lanes where touched; exact-head CI.

## Implementation status (2026-11-25)

Implementation branch `feat/s071-deployment-identity-contract` (base main
`0ad368b6`), on Billy's word 2026-11-25 ~00:33 EST ("Start the next tasks
that are not blocked"). Live overlap rechecked 2026-11-25: only open PRs
are the lane-owned drafts #1090 (DES-10-F1) and #1091 (#518), disjoint
scope; no S071 remote branch, no live S071 lane — NEW_WORK_REQUIRED.

What landed:

- Runtime: `/health` reports `environment` from `VERCEL_ENV`
  (`resolveRuntimeEnvironment` in `app/backend/health.ts`, exact-match
  only, omitted when unrecognized); the web staging-runtime-identity
  endpoint reports `environment: "preview"` in its 200 body (the value
  it already gated on). Backend host is published by the web identity
  endpoint as `backendOrigin` (pre-existing) and by the API origin the
  evidence fetches `/health` from — the contract cross-checks both.
- Canonical contract
  `app/scripts/beta-evidence/lib/deployment-identity-contract.mjs`:
  `verifyDeploymentIdentity` (commit, environment, backend host,
  data-plane identifier; production refusal; `requireShaCorrelation`
  option preserved for the s059 script's opt-out mode),
  `collectRuntimeIdentity` (the three public runtime surfaces only, no
  headers, no env inventory), `verifyIdentityUnchanged` (pre/post-capture
  drift). The S059/S068/S069 identity gate
  (`app/scripts/s059-deployment-identity.mjs`) and the staging
  orchestrator correlation
  (`app/scripts/beta-evidence/lib/staging-runtime-correlation.mjs`) now
  verify through the contract. The s027 env-inventory script is
  untouched.
- The web's backend claim is checked for shape and non-production only,
  NOT for equality with the API origin host: the web points at the
  backend by its stable alias while evidence fetches `/health` from the
  selected deployment's own URL, so the two hosts legitimately differ;
  the alias-to-deployment binding is proven separately by the caller's
  Vercel deployment lookup (deployment-uid equality). Equating the
  hosts would fail closed on every real staging run.
- `requireWebIdentity` (Codex P1 on PR #1096, fixed in-branch): staging
  correlation and S059 evidence require the web identity to be
  published (`IDENTITY_WEB_IDENTITY_UNPUBLISHED` otherwise); without it
  the web SHA, branch, backend binding, and data plane are
  unverifiable, and the pre-S071 implementation rejected a 404 web
  identity. Ordinary previews keep the optional behavior.
- CodeRabbit review fixes (PR #1096, fixed in-branch): the collector
  re-reads `/health` after `/ready` and the two SHAs must agree,
  binding both observations to one deployment (`IDENTITY_CHANGED`
  otherwise — `/ready` reports no commit SHA); the web/API SHA
  equality is gated on `requireShaCorrelation`, so the s059 opt-out
  mode does not re-impose correlation between the web and API surfaces.
- Tests: contract test 33/33 (each field verified; each
  mismatch/missing/unparseable case failing closed; production refusal;
  no-secret handling), staging-runtime-correlation test updated with
  environment cases, health + web identity tests extended; the new
  contract test is wired into `npm run pr:test`.

Rollout note: the new gate requires deployments built from this PR
onward — it fails closed on the missing environment field against older
deployments by design. Live non-production evidence (a contract run
against a real preview/staging deployment plus a negative
mismatched-SHA run) is owed after merge + staging promotion; S071 stays
`IN_REVIEW` until it passes. No secret fetched, decrypted, asserted, or
retained; no production deployment or data-plane acceptance; no new
deployment pipeline, hosting change, or trust boundary.
