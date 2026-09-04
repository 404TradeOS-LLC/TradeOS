---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - .github/workflows/verify-repository.yml
  - .github/workflows/sprint-governance.yml
  - .github/workflows/migration-safety.yml
  - .github/workflows/stale-pr-check.yml
  - .github/workflows/s027-browser-evidence.yml
  - .github/workflows/merge-readiness.yml
  - .github/workflows/docs-reconciliation.yml
  - .github/workflows/nightly-full-regression.yml
  - .github/workflows/workflow-health-report.yml
  - .github/workflows/rc-smoke.yml
---

# CI Acceleration

TradeOS keeps the existing governance and validation requirements while reducing wall-clock delay through parallel verification and automated evidence checks.

## Pull-request critical path

`Verify repository` keeps the established required-check names for App, App integration, and Web, but App and Web work is split into independent child jobs so lint/typecheck, unit tests, Athena checks, builds, and dependency audits can execute concurrently.

Additional targeted workflows provide:

- sprint dependency/state validation and governance-only readiness scope checks;
- live merge-evidence validation for DONE sprints;
- migration/PostgreSQL/RLS safety when persistence paths change;
- branch-current-with-main enforcement;
- a merge-readiness summary after relevant workflow completion.

## Scheduled maintenance

- `Live documentation reconciliation` validates DONE sprint evidence against live GitHub.
- `Nightly full regression` runs the expensive app unit, PostgreSQL integration/RLS, and web unit suites outside the PR critical path as additional evidence.
- `Workflow health report` summarizes recent failures and slow runs so CI bottlenecks remain visible.
- Existing dependency review, workflow security, and nightly repository-health workflows remain authoritative for their existing lanes.

## Authenticated browser evidence

`S027 authenticated browser evidence` is manual because it requires authenticated state and a chosen deployment URL. Add repository secret:

`S027_E2E_STORAGE_STATE_B64`

The value must be a base64-encoded Playwright storage-state JSON file for a non-production test account with only the permissions needed to view Costbook. The workflow captures full-page screenshots at 1440, 1024, 768, and 390 pixels and uploads a JSON report plus screenshots.

`Release candidate authenticated smoke` uses:

`BETA_RC_SMOKE_EMAIL`

`BETA_RC_SMOKE_PASSWORD`

It accepts an explicitly selected Preview or Staging URL, a dedicated sanitized
smoke-tenant label, and route list. The base URL must be HTTPS and match the
approved `tradeos-costbook-web-*.vercel.app` Vercel Preview host pattern for
the selected non-production environment. The workflow drives the real login
form with the Beta smoke owner credentials, verifies that the resulting session
belongs to the named smoke organization, and writes owner/admin storage state
to the runner temporary directory with owner-only permissions for the business
golden path and Dispatch. It fresh-authenticates the organization-matched
technician before the resource-backed Field lifecycle instead of consuming a
serialized technician cookie jar. The owner authentication lifecycle uses the
same maintained Beta smoke credentials plus the deliberately invalid
`RC_E2E_LIFECYCLE_AUTH_REJECTED_PASSWORD` secret to exercise rejected credentials,
successful login, refresh, logout, and protected-route denial. The dedicated
field technician remains isolated behind `RC_E2E_LIFECYCLE_AUTH_PASSWORD`; the
workflow exposes that value only to the field login as `RC_FIELD_PASSWORD`. It then runs
route smoke, the customer → project → estimate → proposal golden workflow,
contract/invoice creation, portal resource checks, and the Dispatch/Field job
surfaces. Golden-workflow mutations require `RC_ALLOW_MUTATIONS=true` inside
the script, are bound to the approved `tradeos-costbook-web-*.vercel.app`
Preview host pattern, and are fail-closed outside Preview or Staging. The
authentication lifecycle runs before owner storage-state generation so its
logout cannot revoke the session used by the remaining evidence steps.

The workflow uploads both the RC report directory and the detailed golden
workflow report, including reports written by failed steps, with safe artifact
publication under `if: always()`.

Screenshots are opt-in. They require `sanitized_tenant=true` and are refused
for production-targeted direct script runs; the workflow itself only offers
Preview and Staging. Without that confirmation, uploaded artifacts contain
machine-readable reports only. Runtime storage state is removed in an
`always()` step before artifact publication. The workflow does not commit or
upload credentials or storage state, and the generated reports never include
authentication secrets.

`Repair staging Supabase auth configuration` is a separate, manual recovery
workflow rather than an evidence shortcut. With explicit confirmation, it
restores only the stable staging backend's branch-scoped Preview
`SUPABASE_URL`, redeploys that backend, and verifies database readiness before
the RC smoke is rerun. The workflow embeds only the public staging project URL;
its Vercel token remains a repository secret. The Vercel CLI update is explicit
and non-interactive (`--value` plus `--yes`); redeploy uses the current command
contract, which does not accept the legacy `--yes` option.

### Beta evidence

`Beta Evidence` (`.github/workflows/beta-evidence.yml`) is the release-candidate
evidence lane. It is operator-dispatched in one of two modes: `preflight`, which
verifies configuration, guards, and credential availability and reports
readiness without capturing anything or claiming a PASS; and `full`, which
captures real evidence and therefore creates records in the release-candidate
tenant.

Unlike the S027 and RC lanes, it does not consume a pre-baked storage-state
secret. It generates authenticated storage state at runtime by driving the real
login form, validates that the resulting session is genuinely authenticated and
scoped to the expected smoke organization, writes that state outside the working
tree with owner-only permissions, and deletes it in an `always()` step. Session
state is never uploaded, and the evidence bundle is scanned for cookie jars,
Supabase auth tokens, TradeOS session cookies, and bearer tokens before
publication.

It drives the canonical customer -> project -> estimate -> line items -> pricing
-> save/reload -> finalize -> proposal -> contract -> invoice workflow at 1440,
1024, 768, and 390 pixels, capturing a truth-checked screenshot checkpoint at
each product state, and proves tenant isolation with a negative probe against a
foreign resource. Artifact validation reads each PNG's intrinsic width and fails
when it does not match the viewport it claims, so a resized desktop capture
cannot pass as mobile evidence.

The target is resolved once from a priority-ordered source list and fails as
ambiguous rather than guessing. Production hosts, the Production alias, and
`-git-main-` previews are refused outright, and a mutating run additionally
requires a Supabase project ref proving the release-candidate deployment does
not share the production database. Runs are serialized through the
`tradeos-beta-evidence` concurrency group.

Required secrets are `BETA_RC_SMOKE_EMAIL`, `BETA_RC_SMOKE_PASSWORD`,
`BETA_RC_SUPABASE_PROJECT_REF`, and at least one foreign resource id
(`BETA_RC_FOREIGN_PROJECT_ID`, `BETA_RC_FOREIGN_CUSTOMER_ID`, or
`BETA_RC_FOREIGN_ESTIMATE_ID`). Beta evidence is UNVERIFIED until a `full` run
passes. See [testing/BETA_EVIDENCE.md](testing/BETA_EVIDENCE.md).

Do not place credentials or raw cookies in workflow YAML, repository files, PR comments, or uploaded artifacts.

## Safety boundaries

These workflows do not:

- mark sprints READY automatically;
- decide founder-protected architecture/product questions;
- merge pull requests;
- mutate production databases;
- rotate or expose secrets;
- attempt to repair the known Vercel Git control-plane issue.

Automation validates evidence and shortens feedback loops; repository governance remains authoritative.
