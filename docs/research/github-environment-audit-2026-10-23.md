# GitHub environment forensic audit — 2026-10-23

Forensic audit of the deployment-environment architecture across GitHub
Actions, Vercel, and Supabase for `404TradeOS-LLC/TradeOS`, triggered by the
observation that the repository appeared to contain two Production and two
Preview environments.

Method: live GitHub API inventory (authenticated as the repository owner),
full read of `.github/workflows/**`, Vercel project/deployment/variable-scope
reads, and repository-side reconciliation of Supabase and ABC Supply
references. Secret and variable **names only** — no secret value was read,
printed, or moved at any point. GitHub/Vercel configuration changes made
during remediation are listed under "Completed changes"; this document is the
evidence record, and the accompanying guard test
(`app/tests/github-environment-guard.test.ts`) is the drift prevention.

## 1. Executive verdict

There were **eight** GitHub environments, not four, and **no case-sensitive
duplicates**. The "two Production / two Preview" impression came from
Vercel's per-project deployment-record shells (`Production – <project>`,
`Preview – <project>`, en-dash names) sitting next to one plain `Preview`
shell — all five are inert records that hold no secrets, no variables, and no
protection rules, and none of them gates or configures anything.

Only three environments are real, workflow-managed configuration:

- `production` — the only hardened environment (required reviewer,
  `main`-only branch policy, the production database secrets).
- `abc-sandbox` — holds the ABC Supply sandbox credentials; it had **no**
  branch policy at audit start (fixed during this audit, see §7).
- `staging` — referenced by `deploy-staging-migrations.yml` but **did not
  exist**, and its expected credential names existed nowhere in GitHub. The
  first dispatch would have auto-created it unprotected and then failed its
  credential check. It was created deliberately, with protections, during
  this audit (see §7).

The audit found **no P0 findings**. The most serious issue is on the Vercel
side, not in GitHub: a `SUPABASE_SERVICE_ROLE_KEY` is scoped into the
frontend project where it has no legitimate use (§6, P1-a), and the frontend
production deployment is one merge behind the API because the two newest
web production deployments were canceled (§6, P1-b). ABC Supply sandbox
credentials are isolated by construction — there is no production ABC
credential path in the codebase at all (§4.3).

**CORRECTION (2026-10-23):** The two original P1 claims no longer stand as
written: P1-a was disproven (the service-role key has verified, test-pinned
server-only uses), and P1-b is informational (the web build skips were
consistent with API-only changes). See the dated corrections in §6 and
follow-up status in §§9–10.

No environment was deleted, no secret was changed, and no production action
was executed during this audit.

## 2. Environment inventory

All environments as found on 2026-10-23, plus `staging` created during
remediation. Names are case-exact; the four qualified Vercel names use an
en dash (U+2013) as separator, which is Vercel's naming convention.

| # | Name (exact) | ID | Created (UTC) | Protection rules | Branch policy | Secrets / variables (names only) | Deployments | Latest deployment |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `production` | 17149036718 | 2026-06-24 | Required reviewer: BillyKShowalter; no wait timer; `prevent_self_review=false`; `can_admins_bypass=true` | Custom: `main` only | Secrets: `APP_DB_ROLE_NAME`, `APP_DB_ROLE_PASSWORD`, `DATABASE_ADMIN_URL`; no variables | 49 | 2026-10-19, sha `c5f70ac4`, actor BillyKShowalter, status **waiting** (§5) |
| 2 | `abc-sandbox` | 24317563217 | 2026-10-14 | None at audit start | None at audit start; **`main`-only added 2026-10-23** | Secrets: `ABC_SUPPLY_SANDBOX_CLIENT_ID`, `ABC_SUPPLY_SANDBOX_CLIENT_SECRET`; no variables | 3 | 2026-10-15, sha `049ff512`, success |
| 3 | `copilot` | 17587991107 | 2026-07-03 | None | None | None | **0** | — |
| 4 | `Preview` | 18865959513 | 2026-07-28 | None | None | None | 7 (all on creation day) | 2026-07-28, actor vercel[bot] |
| 5 | `Production – tradeos-costbook-web` | 18876460370 | 2026-07-28 | None | None | None | 44 | 2026-08-11, actor vercel[bot] |
| 6 | `Production – tradeos-costbook` | 18876490277 | 2026-07-28 | None | None | None | 43 | 2026-08-10, actor vercel[bot] |
| 7 | `Preview – tradeos-costbook` | 18876769120 | 2026-07-28 | None | None | None | 206 | 2026-08-11, actor vercel[bot] |
| 8 | `Preview – tradeos-costbook-web` | 18876800163 | 2026-07-28 | None | None | None | 212 | 2026-08-11, actor vercel[bot] |
| 9 | `staging` | 25153001213 | **2026-10-23 (created by this audit)** | Required reviewer: BillyKShowalter | Custom: `main` only | **None yet — deliberately.** Awaiting `STAGING_DATABASE_ADMIN_URL` + `STAGING_APP_DB_ROLE_PASSWORD` (secrets) and `STAGING_APP_DB_ROLE_NAME` (variable), values to be entered by the owner (§8) | 0 | — |

Repo-level baseline: 9 repo secrets and 1 repo variable exist (RC/beta
evidence credentials and `VERCEL_TOKEN` among them); none of the
environment-scoped names above are duplicated at repo level. Org-level
secrets/variables are **not visible** at the audit token's scopes (org
endpoints return 403) — see §6, P2-f.

Workflow reference map (complete — 7 jobs declare an environment, all
literal strings, no dynamic `environment: ${{ … }}` expressions anywhere on
`main`, and no repository code calls the GitHub environments API):

| Workflow | Job | Environment |
|---|---|---|
| `deploy-migrations.yml` | `deploy` | `production` |
| `reconcile-production-migration.yml` | `reconcile` | `production` |
| `backfill-abc-materials.yml` | `link` | `production` |
| `preview-abc-supply-material.yml` | `preview` | `production` |
| `seed-costbook-supplier-prices-47802.yml` | `seed` | `production` |
| `abc-sandbox-catalog-evidence.yml` | `probe` | `abc-sandbox` |
| `deploy-staging-migrations.yml` | `deploy` | `staging` |

Four of the five `production` jobs are `workflow_dispatch`-only with typed
confirmation inputs; `deploy-migrations.yml` also fires on pushes to `main`
touching migration paths, and every such run still stops at the
`production` approval gate. The `abc-sandbox` probe job additionally
hard-gates itself with `if: github.ref == 'refs/heads/main'`, and all three
of its recorded deployments carry `ref: main`.

## 3. Root-cause analysis

The sprawl has three independent, benign mechanisms — none of them is
workflow drift, and there is no case-drift mechanism in the repository:

1. **GitHub auto-creation on first reference.** When a job first runs under
   a new `environment:` name, GitHub creates the environment with no
   protection rules. `production` and `abc-sandbox` both show the signature:
   environment `created_at` exactly equals the first deployment timestamp.
   Both were deliberate, workflow-driven creations.
2. **The Vercel GitHub integration.** All five shells' deployment records
   are authored by `vercel[bot]`, one per Vercel project × target, created
   minutes apart on 2026-07-28. Records stopped landing after 2026-08-11
   even though Vercel deployments continued (§4.1) — an integration-side
   staleness issue, not a configuration change in this repo.
3. **Copilot auto-provisioning.** `copilot` (2026-07-03) is empty,
   unreferenced, and consistent with GitHub Copilot coding-agent
   infrastructure provisioning.

`staging` is the inverse case: referenced by `deploy-staging-migrations.yml`
(merged via PR #770) but never created, because that workflow has never been
dispatched.

**Attribution limitation.** The GitHub environments API exposes no creator
field, and the org audit log is not accessible at the audit token's scopes.
Who or what created each environment therefore cannot be proven from
GitHub-retained data; the attributions above are inferences from timestamp
equality, deployment actor, and naming convention, and are labelled as such.

## 4. Cross-platform reconciliation

### 4.1 Vercel

Account/team `team_nY1VrcaEYEr4rcW7Gxweq7LP`. Eight projects exist in the
account; three are linked to this repository:

| Project | ID | Role | Status |
|---|---|---|---|
| `tradeos-costbook` | `prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD` | API (Express), `api.404tradeos.com` | **Live.** Production branch `main` (established from deployment evidence: every production deployment carries `githubCommitRef: main`). Latest production READY 2026-10-23 at `e17a166d` (current `main` tip at audit time). |
| `tradeos-costbook-web` | `prj_jDyORkIa7ug3ZtgtNujwEa65hQ36` | Frontend (Next.js) | **Live.** Latest production READY 2026-10-23 at `762bb992`; subsequent API-only changes did not require a web rebuild (see §6, P1-b correction). |
| `tradeos` | `prj_iDDuPvsaUsS5p2IwzbYYMM5YuK3Q` | Leftover from the S027 browser-completion era | **Dormant** since 2026-09-07, still git-linked to this repo, holds exactly one env var (`BACKEND_API_URL`). No corresponding GitHub shells — consistent with the 2026-08-11 records freeze. |

**CORRECTION (2026-10-23):** The web row's "one merge behind the API"
framing above is withdrawn. Vercel records identify two canceled web
production deployments at `ef983efc` and `e17a166d`, and link the
cancellations to the ignored-build-step behavior. The available report
records an aggregate comparison of `762bb992..e17a166d` with no
web-relevant changes; it does not include separate changed-path output for
each deployment. The existing web deployment at `762bb992` was verified
READY. The deployment sequence is informational, not evidence of a
demo-integrity defect.

All five GitHub shells map to live projects/targets (bare `Preview` cannot
be definitively attributed to one of the two costbook projects, but both
still exist, so it is not an orphan of a deleted project). Deleting a shell
would remove history, not fix anything.

Deployment gating: `app/vercel.json` and `web/vercel.json` set
`git.deploymentEnabled` so only `main` (→ production) and `staging`
(→ preview) auto-deploy. The staging that actually exists today is therefore
**not** a GitHub environment: it is the `staging` git branch plus a bundle
of branch-scoped Preview variables on both Vercel projects
(`DATABASE_URL`, `SUPABASE_URL`, `AUTH_JWT_SECRET`,
`PLATFORM_PROVISIONING_SECRET`, `TRADEOS_STAGING_FIXTURE_SECRET`,
`TRADEOS_AUTH_BYPASS`, …). One cron exists: `/api/cron/supplier-price-sync`
(daily 12:00 UTC) on `tradeos-costbook`, which by platform behavior runs
against the Production deployment and Production-scope variables.

Connector limitation (stated, not worked around): team-scoped reads returned
403 under the audit connection, and project responses do not expose the
`link`/`productionBranch` fields; production-branch attribution above rests
on deployment metadata, and team-level GitHub-installation settings could
not be read.

### 4.2 Supabase

Exactly two Supabase projects are referenced anywhere in tracked files, and
code guards fail closed against confusing them
(`app/db/seed/productionGuard.ts`, `app/scripts/beta-evidence/lib/rc-target.mjs`):

| Ref | Identity | Credential sources |
|---|---|---|
| `kssaceuetdjwfqnbzhly` | **Production** ("404TradeOScostbook") | GitHub `production` environment secrets (the 5 jobs in §2); Vercel Production-scope variables |
| `qfbgdkbamfaasmtjfyru` | **Staging** ("TradeOS Staging") | Vercel branch-scoped Preview bundles (the staging branch — live today); the GitHub `staging` environment once the owner enters its 3 credential names (§8) |

No preview/staging workflow can receive production database credentials
through GitHub: environment secrets are scoped to jobs declaring that
environment, all `production` jobs are dispatch-only (plus the gated
main-push migration trigger), and the `production` environment itself is
`main`-only. RC/beta evidence workflows run environment-less against
repo-level `BETA_RC_*` / `RC_E2E_*` secrets and assert their data plane is
not the production ref.

### 4.3 ABC Supply isolation verdict

**Sandbox credentials cannot be used as production credentials or vice
versa, by construction.** The ABC client hardcodes its sandbox hosts
(`https://partners-sb.abcsupply.com`, the sandbox Okta issuer) as constants
that never come from env, database, or request input; **no production ABC
host string and no `ABC_SUPPLY_PRODUCTION_*` variable name exists anywhere
in the codebase**. Feed routing reaches the ABC fetcher only when a sync
target's supplier ID equals `ABC_SUPPLY_SANDBOX_SUPPLIER_ID`. On the GitHub
side, the only consumer of the `abc-sandbox` environment secrets is the
read-only probe workflow (manual dispatch, typed confirmation, `main`-gated,
metadata-only output validation). On the Vercel side, the sandbox credential
set is deliberately scoped into `tradeos-costbook` Production **and**
Preview — production deployments are what run the ABC *sandbox* integration,
per the documented sandbox-only posture; the durable refresh token lives in
Supabase Vault, with the env var as bootstrap/recovery fallback only. When
ABC eventually grants production access, supporting it requires new code and
new variable names, not a configuration flip — a deliberate tripwire.

## 5. The October 19 pending production run — verdict: CANCEL

Run `39192898810` ("Deploy database migrations", deployment `7164724331`)
has been waiting at the `production` approval gate since 2026-10-19. It was
inspected read-only; nothing was approved, rejected, or executed.

- Trigger: push to `main` at `c5f70ac4` (PR #700 merge touched
  `app/prisma/migrations/**`).
- **Payload: exactly one migration** — `20261008180000_davis_bacon_wage_determinations`
  — the delta between the last successful production run (2026-10-11,
  `2eba53ca`, whose tree already contained 60 of 61 migration directories)
  and the waiting run's tree. It is purely additive: two new tables
  (`davis_bacon_determinations`, `davis_bacon_rates`), four indexes, RLS
  enabled and forced with org-scoped policies; zero `DROP` statements, zero
  alterations of existing tables.
- The two flagged invoice migrations (`20260902193000` expand /
  `20260902200000` contract, the latter irreversibly dropping
  `unit_cost`/`line_cost`) were already in the Oct 11 successful run's tree
  and are **not** part of what this run would apply; the NULL-preflight
  concern attaches to staging's first run, not this one.
- The migration tree, the workflow file, and both deploy scripts at
  `c5f70ac4` are **byte-identical** to current `main`. The 11 commits since
  touch none of them, so approving and re-dispatching are payload-identical.
- Recommendation — **cancel (reject) and re-dispatch fresh when the
  Davis-Bacon tables are actually wanted in production**: a 4+ day-old
  waiting run is a stale approval context; the run occupies the workflow's
  `deploy-migrations-production` concurrency group (no cancel-in-progress),
  queueing every future production migration behind a decision on it; and
  the production workflow lacks the hostname check / NULL preflight /
  ledger verification the staging workflow has, so the eventual run should
  be deliberate and attended rather than released from an old queue entry.
  Canceling starts no job and touches no database; the deployment record
  remains for audit.
- Evidence gap, stated: the production `_prisma_migrations` ledger was not
  read (no database access in this audit's scope), so "one pending
  migration" is inferred from the last successful run's tree vs. this tree
  (`prisma migrate deploy` exiting 0 on Oct 11 makes a partial application
  unlikely). The `DATABASE_ADMIN_URL` target host is likewise unverifiable
  through the API; the secret is unchanged since 2026-08-04 and is the same
  one the successful Oct 11 run used.
- **The cancel decision sits at the gate with the owner. This audit and its
  PR do not touch the run.**

## 6. Security and deployment-risk findings

**P0 — none.**

### P1

| # | Finding | Remediation |
|---|---|---|
| a | `SUPABASE_SERVICE_ROLE_KEY` is set on the **frontend** project `tradeos-costbook-web` in **Production and Preview** scopes. A service-role key bypasses RLS. The web project has verified server-only uses for brand assets, project-file downloads, and settings asset cleanup (see correction below). The Preview scope's key scoping remains an open hygiene question. | No removal: the key has verified server-only uses. Decide whether Preview should use a staging-scoped key. |
| b | **[INFORMATIONAL] API-only deployment sequence.** The web project's production deployment remains at `762bb992`; later API-side commits triggered canceled web builds. The report's aggregate comparison found no web-relevant changes. | No remediation indicated by the recorded evidence. See correction below; the sequence is not a demo-integrity finding. |
| c | **[FIXED during audit] Staging environment/secrets vacuum.** `deploy-staging-migrations.yml` referenced a `staging` environment that did not exist, with its credential names present nowhere; first dispatch would have auto-created it unprotected and failed its credential check. | `staging` environment pre-created with required reviewer + `main`-only policy (§7). Credential entry remains the owner's (§8). |

**CORRECTION (2026-10-23) — P1-a is withdrawn as written.** The claim that
`tradeos-costbook-web` "has no legitimate use" for
`SUPABASE_SERVICE_ROLE_KEY` is false. Verified against `main` @ `7013cdca`:
`web/src/lib/supabase/admin.ts` (marked `import "server-only"`) reads the
key and powers brand-asset upload/serving (`web/src/app/actions/settings.ts`,
`web/src/app/api/brand-assets/[orgId]/[assetKey]/route.ts`), project-file
downloads (`web/src/app/api/project-files/[projectId]/[fileId]/route.ts`),
and settings asset cleanup (`web/src/lib/settingsAssetCleanup.ts`); the
design is pinned by tests (`web/src/lib/settingsAssetUpload.test.ts`,
`web/src/lib/envSecurity.test.ts`). The owner's removal order was
conditional on confirming the key was not required; that confirmation
failed, and the key was **not** removed. The residual, narrower hygiene
question is whether the Preview scope should share the production project's
service-role key or carry a staging-scoped key for staging previews.

**CORRECTION (2026-10-23) — P1-b is informational, not an active
deployment-risk finding.** Vercel records identify two canceled web
production deployments: `dpl_Ez8h6m28ghJYvj1BFGG76Y3ATrYk` at
`ef983efc` and `dpl_571o27vvc1NLNfzMzGXMeiRKF94J` at `e17a166d`.
The available report records an aggregate comparison over
`762bb992..e17a166d` with zero web-relevant changes and attributes the
cancellations to `web/vercel-ignore-build.sh`; it does not preserve
per-deployment changed-path output or enough detail to independently
substantiate the additional `7013cdca` deployment claim. The evidence
supports treating the observed API-only deployment sequence as
informational, with no redeploy indicated. Production web at `762bb992`
was verified READY. The original "one merge behind" and demo-integrity
framing are withdrawn.

### P2

| # | Finding | Remediation |
|---|---|---|
| a | **[FIXED during audit] `abc-sandbox` had no branch policy or protection rules** — any branch could in principle run a job against the sandbox credentials. Mitigations existed in-workflow (manual dispatch, typed confirmation, `if: github.ref == 'refs/heads/main'`, all 3 recorded deployments from `main`), so the exposure was sandbox-only. | `main`-only deployment branch policy added 2026-10-23 (§7); both secrets verified intact. |
| b | **Vercel Authentication is OFF on both live projects** (SSO/password/trusted-IP all off) while every other project in the account has it on. Previews are publicly reachable while Preview scopes hold the staging-branch `DATABASE_URL`/`SUPABASE_URL` bundles and a `TRADEOS_AUTH_BYPASS` variable (one entry stored as plain type). Exposure is limited by `git.deploymentEnabled` (`main` + `staging` pushes only), though manual/PR previews outside that path exist. | Owner decides on enabling Vercel Authentication for the live projects' previews. §8. |
| c | **Preview `DATABASE_URL`/`SUPABASE_URL` targets are unverifiable from names.** Preview and Production use separate entries (structurally capable of pointing at different databases), branch-scoped staging entries exist, and no variable name contains a project ref; values were not read by this audit. | Owner confirms each Preview entry's target in Vercel (expected: staging ref `qfbgdkbamfaasmtjfyru`, never production). §8. |
| d | `repair-staging-supabase-auth.yml` uses the **repo-level `VERCEL_TOKEN` with no environment scoping**. The workflow itself is tightly allowlisted (hardcoded staging URL, typed confirmation, writes only the `SUPABASE_URL` Preview var for the `staging` branch), but the token is inherently capable of more than this workflow uses. | Least-privilege note: consider an environment-scoped token or a dedicated scoped token when the staging environment's credentials are entered. |
| e | **Dormant Vercel project `tradeos`** is still git-linked to this repo, took a production-target deployment as recently as 2026-09-07, and holds one env var. Invisible from the GitHub environment list. | Owner's later call: unlink or delete. Not touched by this audit. §8. |
| f | **Org-level GitHub secrets/variables are not visible** at the audit token's scopes (403). Inherited org configuration can neither be ruled in nor out. | Re-check with an org-admin token if inherited config ever becomes a question. |

### Informational

- The five Vercel shells and `copilot` are inert records: no secrets, no
  variables, no protections, nothing to gate. They are retained (§7).
- `production` has `prevent_self_review=false` and
  `can_admins_bypass=true` — the sole reviewer can approve their own
  deployment requests. That matches the repository's current one-maintainer
  working setup and is recorded, not changed.
- GitHub deployment records for Vercel stopped landing on 2026-08-11
  although Vercel deployments continued to the audit date. **GitHub
  environments are not a reliable deployment ledger for Vercel** — use
  Vercel's own deployment history for deployment truth.
- `.mcp.json` points the Supabase MCP server at the production project;
  access is governed by each developer's own Supabase login. A
  developer-workstation exposure, not a CI one.

## 7. Canonical architecture

### GitHub environments — retain exactly three

| Environment | Purpose | Configuration |
|---|---|---|
| `production` | Live application database migrations and production data operations | Required reviewer BillyKShowalter; `main`-only branch policy; secrets `DATABASE_ADMIN_URL`, `APP_DB_ROLE_NAME`, `APP_DB_ROLE_PASSWORD` |
| `staging` | Staging database migrations against `qfbgdkbamfaasmtjfyru` | Required reviewer BillyKShowalter; `main`-only branch policy; `STAGING_APP_DB_ROLE_NAME=tradeos_app` is set; owner entry of `STAGING_DATABASE_ADMIN_URL` and `STAGING_APP_DB_ROLE_PASSWORD` (secrets) remains pending |
| `abc-sandbox` | ABC Supply sandbox evidence only | `main`-only branch policy; secrets `ABC_SUPPLY_SANDBOX_CLIENT_ID`, `ABC_SUPPLY_SANDBOX_CLIENT_SECRET` |

The five Vercel shells (`Preview`, `Production – tradeos-costbook`,
`Production – tradeos-costbook-web`, `Preview – tradeos-costbook`,
`Preview – tradeos-costbook-web`) and `copilot` are **retained for now and
not deleted**: they are Vercel-managed or platform-managed records that may
still be referenced by the integrations that created them. They hold no
configuration and gate nothing. Revisit removal only with evidence they are
unreferenced, under a separate authorization.

### Vercel

- `tradeos-costbook` (API) and `tradeos-costbook-web` (web), production
  branch `main` — the two live projects.
- `tradeos` — dormant; the owner's later call (§8).

### Supabase

- Production `kssaceuetdjwfqnbzhly` ("404TradeOScostbook");
  staging `qfbgdkbamfaasmtjfyru` ("TradeOS Staging"). Never point staging
  migrations at production: the staging workflow hardcodes the staging ref
  and refuses any admin URL whose hostname is not
  `db.qfbgdkbamfaasmtjfyru.supabase.co`.

### The rule going forward

**Workflows may reference ONLY `production`, `staging`, and `abc-sandbox`.**
Environment names select based on existing active deployment references —
renaming any of the three would break the workflows, branch policies, and
approval history that already use them, for zero security benefit. The guard
test added by this audit's PR fails CI naming the offending file and value
if any workflow declares a non-canonical, dynamic, or unparseable
environment. It runs in two harnesses with identical logic for a reason:
the App suite's CI scope detection skips workflow-only PRs, so the jest
copy (`app/tests/github-environment-guard.test.ts`) is mirrored by a root
`pr:test` copy (`scripts/__tests__/github-environment-guard.test.mjs`) that
the Docs consistency check runs on every pull request. The extractor parses
by YAML key path (`jobs.<job-id>.environment`), not by indentation, so
reformatting a workflow cannot slip a declaration past it. If a new
environment is ever intentional: create and protect it in GitHub first, add
its name to the guard's canonical set in the same PR that introduces the
reference, and record it here.

## 8. Completed changes

Made during this audit, outside this PR's diff (GitHub settings are not
repository content). Each was verified through the GitHub API after the
change; no secret values were read or altered.

1. **`staging` environment created (2026-10-23)** — ID `25153001213`;
   required reviewer BillyKShowalter; custom deployment branch policy
   allowing `main` only. This defuses the §6 P1-c trap: a first dispatch of
   `deploy-staging-migrations.yml` now lands in a protected environment and
   will fail only at its credential check, as designed, until the owner
   enters the credentials (§9). **Deliberately no secrets yet** — staging
   infrastructure references were verified first (§4.2), and credential
   values are the owner's to enter, never the agent's.
2. **`abc-sandbox` environment hardened (2026-10-23)** — custom deployment
   branch policy allowing `main` only, matching all recorded legitimate
   usage (§3); both sandbox secrets verified intact by name afterward.
3. **October 19 production run canceled (2026-10-23)** (§5). Run
   `39192898810` was canceled on the owner's order; it was not
   re-dispatched, and no production migration was executed. See §10.

In this PR's diff: this audit report, and the environment drift-guard test
(§7). **No workflow file was modified, no environment deleted, no secret
changed, no production action executed.**

## 9. Remaining blockers

These items record remaining owner decisions and credentials; several
operational actions were completed on 2026-10-23 and are marked accordingly
below and in §10.

1. **[PARTIALLY COMPLETE] Enter the remaining staging credentials** in
   the new GitHub `staging` environment: secrets
   `STAGING_DATABASE_ADMIN_URL` (for staging project
   `qfbgdkbamfaasmtjfyru`; the workflow refuses any other host) and
   `STAGING_APP_DB_ROLE_PASSWORD` remain pending. Variable
   `STAGING_APP_DB_ROLE_NAME=tradeos_app` is already set. Until both
   secrets are entered, the first staging dispatch fails its credential
   check by design. After entry, staging backup + the invoice legacy-cost
   NULL pre-check still precede any staging run, per the existing plan.
2. **Vercel web-project hygiene**: remove `SUPABASE_SERVICE_ROLE_KEY` from
   `tradeos-costbook-web` (Production and Preview scopes) (§6 P1-a), and
   confirm the Preview-scope `DATABASE_URL`/`SUPABASE_URL` targets on both
   live projects point at staging, never production (§6 P2-c).
   **CORRECTION (2026-10-23):** The removal directive in this item is
   withdrawn (see the §6 P1-a correction): the key is required by the web
   project, the conditional confirmation of non-requirement failed, and
   the key was not removed. The Preview-target confirmation was completed
   the same day (§10); the only open residue is the narrower Preview-scope
   service-role-key scoping question recorded in the §6 correction.
3. **[RESOLVED] October 19 production run.** Run `39192898810` was
   canceled on the owner's order; the deployment is inactive, nothing was
   re-dispatched, and no production migration executed (§10). A fresh
   deliberate run can be considered when the Davis-Bacon migration is
   wanted in production.
4. **Decide two Vercel postures**: whether to enable Vercel Authentication
   for the two live projects' preview deployments (§6 P2-b), and what to do
   with the dormant, still-git-linked `tradeos` project (§6 P2-e).

## 10. Follow-up actions completed 2026-10-23 (addendum)

Recorded after this report's PR (#791) merged, later the same day:

- **October 19 production run canceled.** Run `39192898810` was canceled
  on the owner's order (§5 recommendation carried out; §9 item 3
  resolved). Verified in GitHub afterward: the run is
  completed/cancelled and its deployment record is inactive. Nothing was
  re-dispatched, and no production migration was executed.
- **Staging environment: variable set, secrets still pending.** Variable
  `STAGING_APP_DB_ROLE_NAME` was set to `tradeos_app` (the confirmed
  staging role name) in the GitHub `staging` environment. The two secrets
  (`STAGING_DATABASE_ADMIN_URL`, `STAGING_APP_DB_ROLE_PASSWORD`) remain
  unset — §9 item 1 stays open for those two values only, still the
  owner's to enter.
- **Preview target classification completed with limits.** For entries
  whose values were readable, the Preview-scope
  `DATABASE_URL`/`SUPABASE_URL` targets were classified as non-production.
  Sensitive/write-only entries remain unresolved because their targets
  could not be verified. An owner dashboard check is recommended for those
  entries; the available evidence does not establish their targets.
- **Vercel Authentication posture.** It remains **OFF** on both live
  projects. Recommendation recorded: keep it off for demo access, and
  revisit only if previews ever carry real customer data (§6 P2-b).
- **Dormant `tradeos` project.** Verified to have no custom domains.
  Retirement is the owner's call; it was not deleted or disconnected
  (§6 P2-e).

## Evidence index

- GitHub API: environments list/detail, per-environment secrets/variables
  (names only), deployments + statuses, workflow runs — collected
  2026-10-23 against `main` @ `e17a166d`.
- Workflow files: `.github/workflows/{deploy-migrations,
  reconcile-production-migration, backfill-abc-materials,
  preview-abc-supply-material, seed-costbook-supplier-prices-47802,
  abc-sandbox-catalog-evidence, deploy-staging-migrations,
  repair-staging-supabase-auth, beta-evidence}.yml`.
- ABC client: `app/modules/supplier-integration/abcSupply.ts`,
  `abcCatalog.ts`, `app/scripts/probe-abc-sandbox-catalog.ts`.
- Supabase guards: `app/db/seed/productionGuard.ts`,
  `app/scripts/beta-evidence/lib/rc-target.mjs`, `.mcp.json`,
  `docs/DEPLOYMENT_GUIDE.md`, `docs/QA_PREVIEW_DEPLOYMENT_CHECKLIST.md`.
- Vercel: project/deployment/variable-scope reads (names only) for
  `tradeos-costbook`, `tradeos-costbook-web`, `tradeos`;
  `app/vercel.json`, `web/vercel.json`.
- Migrations: `git ls-tree` / `git diff` of `app/prisma/migrations/`
  between `2eba53ca`, `c5f70ac4`, and `e17a166d`;
  `20261008180000_davis_bacon_wage_determinations` SQL read at `c5f70ac4`.
