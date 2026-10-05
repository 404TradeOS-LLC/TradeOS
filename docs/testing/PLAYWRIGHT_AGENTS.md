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
  - tests/playwright/target.mjs
  - .github/workflows/playwright-agent-evidence.yml
  - .codex/agents/playwright_test_planner.toml
  - .codex/agents/playwright_test_generator.toml
  - .codex/agents/playwright_test_healer.toml
---

# Playwright agents for Codex

Run Codex from the TradeOS repository root. The checked-in planner, generator
and healer definitions use the root Playwright configuration and installed
`@playwright/test` 1.63.0. There is no Autonoma account or token requirement.

## Setup and commands

```bash
npm ci
npx playwright install --with-deps chromium
npm run test:e2e:guards
npm run test:e2e:list
```

Start TradeOS separately using its existing app/web development instructions.
The default browser target is `http://127.0.0.1:3000`. To use another loopback port:

```bash
TRADEOS_AGENT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e
```

For a hosted login-shell check, supply the immutable approved
`https://tradeos-costbook-web-<preview-id>.vercel.app` origin, declare
`TRADEOS_AGENT_ENVIRONMENT=preview` (or `staging`), and confirm
`TRADEOS_AGENT_SANITIZED_TENANT=true`. Production aliases, main-branch Previews,
unknown hosts, credentials in URLs and origins containing paths/query/fragment
are refused by configuration. This declaration is not runtime deployment or
data-plane attestation and does not authorize authenticated business writes.

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
read-only authenticated checks across **Today**, **Customers**, **Projects**, and
**Estimates**. The suite verifies the canonical Today command board, the
Customers and Projects list workspaces, and the Estimates queue without the
known load-error fallback. When sanitized smoke records exist, it follows their
real hrefs with direct GET navigation to exercise Customer detail, Project
detail, and the focused Estimate workspace; when a list is empty, the test
requires the product's truthful empty state instead of inventing a fixture.
These checks do not create, edit, send, accept, invoice, pay, schedule, or
otherwise mutate contractor records.

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
TradeOS instructions. Reapply the runbook requirements, explicit MCP config
and `--no-install`, and remove upstream healer instructions that skip/fixme
correct failing tests. Never replace the meaningful seed with a blank test.

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
it before artifact upload. The uploaded evidence may contain the redacted auth
bootstrap report, but never the session file or an authenticated Playwright
trace.

The workflow does not run an LLM inside GitHub Actions; Codex remains the host
for planner/generator/healer work. GitHub Actions executes the deterministic
tests those agents produce. The MCP launcher now derives
`PLAYWRIGHT_MCP_ALLOWED_ORIGINS` from the validated target before starting the
Playwright test MCP server, which catches unintended cross-origin requests in
addition to the initial target validation.

This lane deliberately records
`exactDeploymentShaCorrelated: false`. It is useful browser evidence, but it is
not exact-head release certification and does not replace Beta Evidence, its
authenticated fixtures, data-plane proof, cleanup, or SHA-correlation contract.
