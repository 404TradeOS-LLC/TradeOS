---
status: current
owner: platform
last_verified: 2026-10-05
source_of_truth: false
related_docs:
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/testing/BETA_EVIDENCE.md
related_code:
  - playwright.config.ts
  - tests/playwright/seed.spec.ts
  - tests/playwright/authenticated.spec.ts
  - tests/playwright/beta-readiness.spec.ts
  - tests/playwright/evidence-links.mjs
  - tests/playwright/target.mjs
  - .github/workflows/playwright-agent-evidence.yml
  - .codex/agents/playwright_test_planner.toml
  - .codex/agents/playwright_test_generator.toml
  - .codex/agents/playwright_test_healer.toml
---

# Playwright agents for Codex

Run Codex from the TradeOS repository root. The checked-in planner, generator
and healer definitions use the root Playwright configuration and installed
`@playwright/test` 1.64.1. There is no Autonoma account or token requirement.

## Setup and commands

```bash
npm ci
npx playwright install --with-deps chromium
npx playwright install firefox
npm run test:e2e:guards
npm run test:e2e:list
```

Firefox is the interactive Playwright MCP agent browser (see
`playwright.mcp.config.ts`); install it alongside Chromium, which stays the
default for the root config and GitHub Actions evidence gates. Use the plain
`playwright install firefox` first — `--with-deps` pulls system packages
through apt and is only needed if a Firefox launch failure proves a system
library is missing.

Start TradeOS separately using its existing app/web development instructions.

**Interactive Playwright MCP is unrestricted for browser navigation.** The repo-level
`.mcp.json` and the three Codex agent definitions use
`tests/playwright/mcp-server.mjs`, which launches the separate
`playwright.mcp.config.ts` and removes inherited MCP allowed/blocked-origin
filters. Agents may navigate to any HTTP(S) site for observation; no sanitized
Preview declaration or Vercel hostname allowlist is needed for MCP startup.
This does not grant permission to change production records or bypass
application authentication, and does not certify a release.

The ordinary `npm run test:e2e` runner **remains guarded** by
`playwright.config.ts` and `tests/playwright/target.mjs`. Its default browser
target is `http://127.0.0.1:3000`. To use another loopback port:

```bash
TRADEOS_AGENT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e
```

For a **governed standard test/evidence run** targeting a hosted login shell,
supply the immutable approved
`https://tradeos-costbook-web-<preview-id>.vercel.app` origin, declare
`TRADEOS_AGENT_ENVIRONMENT=preview` (or `staging`), and confirm
`TRADEOS_AGENT_SANITIZED_TENANT=true`. Production aliases, main-branch Previews,
unknown hosts, credentials in URLs and origins containing paths/query/fragment
are refused by configuration. This declaration is not runtime deployment or
data-plane attestation and does not authorize authenticated business writes.

Each checked-in Codex Playwright agent uses `sandbox_mode = "workspace-write"`
so the planner can save plans and the generator/healer can save or repair tests
within the repository. This does not provide unrestricted operating-system
access or grant authority to mutate production data.

Invoke the Codex agents by name:

- `playwright_test_planner`: explore the configured login shell using
  `tests/playwright/seed.spec.ts` and write a plan under `specs/`.
- `playwright_test_generator`: turn a reviewed plan into real browser tests under
  `tests/playwright/`, verifying steps against the running app.
- `playwright_test_healer`: diagnose a named failing test, repair evidence-backed
  locator/environment errors and rerun it. Preserve product failures.

The seed checks Email, Password and Sign in on the logged-out `/login` page.
The hosted evidence workflow can also reuse the existing governed Beta smoke
identity to generate fresh runtime storage state outside the repository and run
read-only authenticated checks across **Today**, **Customers**, **Projects**,
**Estimates**, **Proposals**, **Contracts**, and **Invoices**. The suite verifies
the canonical Today command board, Customer and Project workspaces, the
Estimates queue, and the Project-backed proposal/contract/invoice tabs. When
sanitized smoke records exist, it follows their real hrefs with direct GET
navigation to exercise Customer, Project, Estimate, Proposal, Contract, and
Invoice detail surfaces; when a relevant list is empty, the test requires the
product's truthful empty state instead of inventing a fixture. These checks do
not create, edit, send, accept, sign, invoice, record payment, pay, schedule, or
otherwise mutate contractor records. With the current checked-in suite,
the general authenticated starter contributes eight tests, plus the logged-out login
seed. The additional eight Beta Readiness role/viewport tests skip by default
and **must never be counted as passing** without explicit non-production
owner/technician acceptance; see [Beta Control Surface](BETA_CONTROL_SURFACE.md).

Before any broader authenticated or mutating exploration, reuse the governed
[Beta Evidence](BETA_EVIDENCE.md) fixture, non-production data-plane,
credential handling, cleanup, SHA correlation and artifact scanning contracts.
Do not substitute an auth bypass or weaken RLS. Missing prerequisites remain
explicit blockers. Existing Beta/RC evidence workflows remain the certification
path; these agent definitions do not schedule tests or replace those workflows.

Traces, screenshots and videos are off in this starter configuration. Do not
commit session material or capture real customer data through MCP tools.
Only the three reviewed `.codex/agents/playwright_test_*.toml` definitions are
allowlisted; other local Codex state remains ignored.

## Regeneration

`npm run playwright:agents` regenerates upstream definitions using the pinned
local Playwright version. Review its diff before committing: it overwrites
TradeOS instructions. Reapply the runbook requirements, the distinct
unrestricted agent MCP launcher/configuration and `--no-install`, and remove upstream healer instructions that skip/fixme
correct failing tests. Never replace the meaningful seed with a blank test.

## Assembly Catalog browser evidence (issue #518)

A separate manual Action, `.github/workflows/assembly-catalog-browser-evidence.yml`,
now executes `tests/playwright/assembly-catalog.spec.ts` with the real owner/admin
and read-only smoke identities at desktop 1440px and mobile 390px. Unlike this
agent diagnostic lane, it reuses the **S027 Vercel deployment identity check**
before and after browser capture, verifies non-production Supabase branch
configuration and exact deployed SHA, and requires a single canonical smoke
organization ID for both accounts. It requires two additional secrets for a
read-only smoke member: `BETA_RC_READONLY_SMOKE_EMAIL` and
`BETA_RC_READONLY_SMOKE_PASSWORD`. The Assembly-only auth path confirms the same organization and effective role through the read-only Costbook workspace API; it never loads Settings or its potentially mutating legacy-branding initialization. It fails rather than skipping a role,
withholds credentials from PR/artifacts, removes runner-temp session state,
and uploads screenshots only after a credential scan. A reviewer must inspect
the actual run and its artifacts before checking off the browser-evidence gate;
this workflow alone does not certify a release, run against production, or
change tenant records.

## Evidence boundary

The target guard regression tests also run in the existing required Docs consistency
job through `npm run pr:test`; no workflow trigger or permission changes.

Test discovery and target guard checks validate the setup, not a live TradeOS
release. Record any actual browser run separately with its exact deployment,
SHA, environment and sanitized evidence. No numbered sprint changes status from
this setup alone.


## GitHub Actions Chromium evidence

`.github/workflows/playwright-agent-evidence.yml` is a manual, read-only
diagnostic lane for tests produced or healed by the checked-in Playwright
agents. It resolves only the same approved Preview/Staging host contract as the
agent target guard, requires explicit sanitized-tenant confirmation, installs
Chromium plus Linux dependencies with
`npx playwright install --with-deps chromium`, runs the root Chromium suite,
and uploads the HTML report, test results, screenshots, permitted failure
artifacts, Playwright version and discovered-test list for 30 days. Authenticated
specs explicitly disable Playwright trace capture so session cookies cannot be
retained in uploaded traces; the logged-out seed may still use the evidence-mode
failure trace policy.

By default the workflow also runs the bounded authenticated smoke. It consumes
only the existing `BETA_RC_SMOKE_EMAIL` and `BETA_RC_SMOKE_PASSWORD` GitHub
secrets inside the prerequisite/authentication steps that need them, verifies
the configured smoke organization through the existing `auth-setup.mjs`
contract, writes storage state only under the runner temp directory, and removes
it before artifact upload. When the `use_test_org` input is set **and
`authenticated_smoke` is enabled**, the same prerequisite/authentication steps
consume `TEST_STAGING_EMAIL` and `TEST_STAGING_PASSWORD` instead, and
`estimate_stage_path` plus `spec_file` can target a single estimate spec (for
example the §19 stage-navigation spec) against a seeded draft route. With
`authenticated_smoke=false` both TEST Org steps are skipped, so `use_test_org`
alone selects no credentials. When `use_test_org` is enabled, set
`smoke_tenant_label` to the TEST Org's actual name: the default `TradeOS Beta
Smoke` label does not match the TEST Org tenant, and the prerequisite step
fails before the estimate spec runs. The uploaded evidence may contain the redacted auth
bootstrap report, but never the session file or an authenticated Playwright
trace.

The workflow does not run an LLM inside GitHub Actions; Codex remains the host
for planner/generator/healer work. GitHub Actions executes the deterministic
tests those agents produce. The agent MCP launcher deliberately leaves browser origins unrestricted and
uses its own configuration file. The deterministic GitHub Actions evidence jobs
continue to validate non-production targets and retain separate release gates.

This lane deliberately records
`exactDeploymentShaCorrelated: false`. It is useful browser evidence, but it is
not exact-head release certification and does not replace Beta Evidence, its
authenticated fixtures, data-plane proof, cleanup, or SHA-correlation contract.


Current Vercel Preview deployments may use either `tradeos-costbook-web-<id>.vercel.app` or `tradeos-costbook-<id>.vercel.app`. The latter hostname pattern is also used by Production builds, so it is permitted **only in the Assembly evidence workflow after a successful S027 immutable Preview/Supabase attestation**, not merely because a workflow input declares Preview. The standard CI login checks still refuse un-attested hosts.
