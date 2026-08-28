# Beta Evidence

Canonical reference for the `Beta Evidence` workflow
(`.github/workflows/beta-evidence.yml`) and the scripts under
`app/scripts/beta-evidence/`.

## Purpose

Beta evidence proves that a TradeOS release candidate can execute the real
authenticated contractor workflow — customer → project → estimate → line items →
pricing → save/reload → finalize → proposal → contract → invoice — safely,
reproducibly, and legibly across desktop, small desktop, tablet, and mobile.

It is deliberately narrow about what counts. None of the following is beta
evidence on its own: a Preview deployment existing, Vercel reporting READY, CI
being green, Playwright starting, a workflow file existing, screenshots being
uploaded, or a PR being merged. Evidence requires an approved non-production
environment, a sanitized test identity, real authentication, a real
tenant-scoped product workflow, meaningful assertions, four viewports, retained
artifacts, and security validation — all passing in one run.

## Architecture

```text
resolve RC target  ->  authenticate  ->  capture per viewport  ->  validate  ->  upload
   (fail closed)      (runtime state)     (1440/1024/768/390)     (artifacts)   (30 days)
```

| Stage | Script | Responsibility |
| --- | --- | --- |
| Resolve | `resolve-rc-target.mjs` | Decide the RC URL once, prove it is non-production, correlate the deployment SHA |
| Authenticate | `auth-setup.mjs` | Real login through the shipped form; validate the session; write storage state outside the repo |
| Capture | `capture-evidence.mjs` | Drive the canonical workflow at one viewport, asserting business meaning and capturing checkpoints |
| Isolate | `tenant-isolation.mjs` | Prove the smoke identity cannot read another tenant's resources |
| Validate | `validate-artifacts.mjs` | Verify the artifact bundle, emit `metadata.json` and the Actions summary |
| Orchestrate | `run.mjs` | Local entrypoint (`npm run beta:evidence`) |

Pure decision logic lives in `app/scripts/beta-evidence/lib/` and is covered by
`scripts/__tests__/beta-evidence.test.mjs`, which runs in CI via `npm run pr:test`.

## RC environment

The target must be production-like, non-production, isolated from real customer
data, reachable by CI, and capable of real authentication.

URL resolution is deterministic and considers, in priority order:

1. the `rc_base_url` workflow input;
2. the `BETA_RC_BASE_URL` repository variable;
3. `BETA_RC_DEPLOYMENT_URL` resolved from deployment metadata.

If two sources disagree the run fails with `RC_URL_AMBIGUOUS` rather than
picking one. If none is set it fails with `RC_URL_UNRESOLVED`. The URL is never
guessed.

The resolved host must be an approved `tradeos-costbook-web-*.vercel.app`
Preview host. These are refused explicitly:

| Host | Refusal |
| --- | --- |
| `app.404tradeos.com`, `api.404tradeos.com` | `RC_URL_IS_PRODUCTION` |
| `tradeos-costbook-web.vercel.app` | `RC_URL_IS_PRODUCTION_ALIAS` |
| `tradeos-costbook-web-git-main-*.vercel.app` | `RC_URL_TRACKS_MAIN` — builds from the default branch and shares Production configuration |
| anything else | `RC_URL_NOT_APPROVED` |

**Environment identity.** The operator declares the environment they intend to
target; the actual environment is *derived from the deployment that was
resolved* (`deriveEnvironmentFromUrl`), not copied from that declaration, so the
assertion can genuinely fail. Declaring `staging` while passing a Preview URL is
rejected with `ENV_MISMATCH`. Only `preview` and `staging` are supported;
`production` is not.

The derivation is host-based, which is what the deployment exposes publicly. It
does not prove which *database* the deployment is wired to — see the data-plane
note below, which remains operator-attested.

**Data plane.** A mutating run additionally requires
`BETA_RC_SUPABASE_PROJECT_REF` — the Supabase project ref backing the RC
deployment. An absent ref fails with `DATA_PLANE_UNPROVEN`; a ref matching
production fails with `DATA_PLANE_IS_PRODUCTION`. This exists because Preview
and Production can share a Supabase project unless they are configured
separately, and a shared project would make fixture creation a production
mutation. Isolation must be proven, not assumed.

Be precise about what this proves. The ref is **operator-attested**: it is
supplied as a secret, not read back from the deployment, because the frontend
uses Supabase server-side only and therefore exposes no project identity to an
external caller. A Preview accidentally wired to the production database while
the secret still names the staging project would not be caught here. Closing
that gap needs a small public build-info endpoint on the deployment reporting
its environment, commit SHA, and data-plane ref, which
`resolve-rc-target.mjs` could then verify instead of trusting configuration;
that is recorded as follow-up rather than silently assumed away.

**SHA correlation.** The deployment under test is correlated with the commit it
should have been built from. Set `require_sha_correlation: true` to make an
uncorrelated deployment a hard failure — required for a merged-SHA evidence run.

## Smoke tenant

One canonical synthetic tenant, obviously non-real:

| Entity | Value |
| --- | --- |
| Organization | `TradeOS Beta Smoke` |
| Owner | Beta Smoke Owner |
| Customer | `Acme Test Customer <run-id>-<viewport>` |
| Project | `RC Evidence Remodel <run-id>-<viewport>` |

Records are created through the product's own UI — never seeded directly and
never cloned from production. Names are deterministic in structure and unique
per run and viewport, so parallel or repeated runs cannot collide and every
synthetic record traces back to the run that made it via
`<viewport>/workflow-records.json`.

Customer email addresses use the `example.invalid` reserved domain so no mail
can ever be delivered.

## Authentication

Storage state is generated at runtime, not stored:

1. open `/login` on the approved origin;
2. fill the real form and submit;
3. wait for an authenticated route;
4. assert the session is not bounced back to `/login`;
5. assert the session is scoped to the expected smoke organization;
6. write storage state to a path outside the repository, `chmod 600`.

A successful redirect to `/finish-setup` is treated as a provisioning failure,
not an authentication success — it means the identity has no organization yet.

The script refuses to write storage state anywhere inside the working tree, and
the workflow writes it to `${{ runner.temp }}` and deletes it in an `always()`
step. Storage state is never uploaded as an artifact.

## Secrets

Names and ownership only. Never record values in documentation, logs, or
artifacts.

**Two namespaces.** The GitHub secret names are `BETA_RC_*`; the workflow maps
them to the `BETA_*` environment variables the scripts actually read. Set the
secret name in GitHub and the runtime name when running locally. The mapping is
listed below because getting it wrong silently leaves a value unset — which for
the foreign-resource ids surfaces as the tenant-isolation probe refusing to run.

| GitHub secret / variable | Runtime variable | Kind | Consumed by | Required |
| --- | --- | --- | --- | --- |
| `BETA_RC_SMOKE_EMAIL` | `BETA_SMOKE_EMAIL` | secret | `auth-setup.mjs` | full runs |
| `BETA_RC_SMOKE_PASSWORD` | `BETA_SMOKE_PASSWORD` | secret | `auth-setup.mjs` | full runs |
| `BETA_RC_SUPABASE_PROJECT_REF` | `BETA_RC_SUPABASE_PROJECT_REF` | secret | `resolve-rc-target.mjs` | full runs |
| `BETA_RC_FOREIGN_PROJECT_ID` | `BETA_FOREIGN_PROJECT_ID` | secret | `tenant-isolation.mjs` | full runs (or `_CUSTOMER_ID`) |
| `BETA_RC_FOREIGN_CUSTOMER_ID` | `BETA_FOREIGN_CUSTOMER_ID` | secret | `tenant-isolation.mjs` | full runs (or `_PROJECT_ID`) |
| `BETA_RC_FOREIGN_ESTIMATE_ID` | `BETA_FOREIGN_ESTIMATE_ID` | secret | `tenant-isolation.mjs` | optional; requires `_PROJECT_ID` |
| `BETA_RC_BASE_URL` (repository variable) | `BETA_RC_BASE_URL_VARIABLE` | variable | `resolve-rc-target.mjs` | optional |
| `BETA_RC_DEPLOYMENT_URL` | `BETA_RC_DEPLOYMENT_URL` | variable | `resolve-rc-target.mjs` | optional |
| `BETA_RC_DEPLOYMENT_SHA` | `BETA_RC_DEPLOYMENT_SHA` | variable | `resolve-rc-target.mjs` | optional |

`BETA_RC_SUPABASE_PROJECT_REF` is deliberately the same on both sides; the smoke
and foreign-resource secrets drop the `RC_` prefix at runtime. The repository
variable `BETA_RC_BASE_URL` is the odd one out: it reaches the resolver as
`BETA_RC_BASE_URL_VARIABLE`, because the plain `BETA_RC_BASE_URL` name carries
the workflow *input* — they are two distinct resolution sources and must not
collide. The smoke-tenant label reaches the scripts as `BETA_SMOKE_ORG_LABEL`
and `BETA_SMOKE_TENANT_LABEL`, both fed from the workflow's `smoke_tenant_label`
input.

An estimate id on its own is not probeable, because the estimate route is nested
under a project. Supplying only `BETA_RC_FOREIGN_ESTIMATE_ID` fails the run
rather than producing a report with no probes in it.

The RC smoke identity must be a dedicated account belonging only to the
synthetic smoke organization. It must not be a founder's personal account and
must not be a developer superuser unless the product genuinely requires that
role for the beta operator workflow.

## Running locally

```bash
export BETA_RC_BASE_URL="https://tradeos-costbook-web-<preview>.vercel.app"
export BETA_EXPECTED_ENVIRONMENT=preview
export BETA_SMOKE_EMAIL="<rc smoke identity>"
export BETA_SMOKE_PASSWORD="<rc smoke password>"
export BETA_SMOKE_ORG_LABEL="TradeOS Beta Smoke"
export BETA_RC_SUPABASE_PROJECT_REF="<non-production project ref>"
export BETA_FOREIGN_PROJECT_ID="<a project id in another synthetic tenant>"

npm run beta:evidence -- --allow-mutations
```

Capturing evidence creates records in the RC tenant, so consent is explicit:
without `--allow-mutations` (or `BETA_ALLOW_MUTATIONS=true`) the run stops before
capture. `BETA_SMOKE_ORG_LABEL` is required — the tenant assertion cannot be
skipped, because a session in an unintended organization would otherwise be
persisted and used for capture. Each run starts from an empty evidence
directory.

Targeted options:

```bash
npm run beta:evidence -- --viewport=390
npm run beta:evidence -- --headed
npm run beta:evidence -- --skip-isolation
npm run beta:evidence -- --help
```

A targeted run validates only the viewports it captured and reports **PARTIAL**,
never PASS — it is a debugging aid, not a release gate. Reports left over from a
previous run are detected by run id and marked `STALE` rather than counted.

Configuration is environment- and flag-driven. Changing the RC URL never
requires editing source.

## Running in GitHub

Actions → **Beta Evidence** → Run workflow.

- `mode: preflight` verifies configuration, guards, and credential availability
  and reports readiness. It never claims evidence PASS and is safe to run before
  an RC identity exists.
- `mode: full` captures the real evidence and creates records in the RC tenant.

Runs are serialized (`concurrency: tradeos-beta-evidence`,
`cancel-in-progress: false`) so two evidence runs cannot corrupt each other.

## Viewports

| Name | Size |
| --- | --- |
| Desktop | 1440 × 1000 |
| Small Desktop | 1024 × 900 |
| Tablet | 768 × 1024 |
| Mobile | 390 × 844 |

Each viewport renders in its own browser context and its own workflow pass.
Desktop screenshots are never resized to stand in for a smaller viewport;
`validate-artifacts.mjs` reads each PNG's IHDR chunk and fails the run if an
image's intrinsic width does not match the viewport it claims.

The 390px and 768px runs carry the same responsive gate as every other
checkpoint: horizontal overflow beyond a 2px tolerance fails the run. A
functional backend behind an unusable mobile UI does not pass.

## Checkpoints

`beta-<viewport>-<sequence>-<checkpoint>.png`, for example
`beta-390-05-estimate-reloaded.png`.

| Sequence | Checkpoint | Required |
| --- | --- | --- |
| 01 | `authenticated-shell` | yes |
| 02 | `project-or-customer` | yes |
| 03 | `estimate-edit` | yes |
| 04 | `estimate-pricing` | yes |
| 05 | `estimate-reloaded` | yes |
| 06 | `estimate-finalized` | yes |
| 07 | `proposal` | yes |
| 08 | `downstream-state` | optional |

Every checkpoint is truth-checked before it counts: a login screen, a 404, a
server error, an empty body, or a page stuck on its loading state is rejected as
evidence rather than saved as a passing screenshot.

## Artifacts

```text
beta-evidence/
  metadata.json
  rc-target.json
  auth-setup-report.json
  tenant-isolation-report.json
  1440/ screenshots/ capture-report.json workflow-records.json
  1024/ ...
  768/  ...
  390/  ...
```

Retained for 30 days. Before upload, the bundle is scanned for cookie jars,
Supabase auth tokens, TradeOS session cookies, and bearer tokens; a match fails
the run rather than publishing the artifact.

`metadata.json` records repository, commit, branch, preview URL, environment,
deployment SHA correlation, workflow, smoke tenant, viewports, timestamps, and
per-check results. It contains no passwords, tokens, cookies, or storage state.

## Safety

- **Production destruction guard.** `app/db/seed/productionGuard.ts` refuses to
  run the destructive seed when `DATABASE_URL` points at a known production
  host or when `NODE_ENV`, `APP_ENVIRONMENT`, or `VERCEL_ENV` is `production`.
  An unset or unparseable `DATABASE_URL` is also refused, because the target
  cannot be identified. Hostname matching alone is not sufficient: Supabase
  pooler URLs (`aws-0-<region>.pooler.supabase.com`) carry the project ref in
  the *username*, so the guard extracts the ref from either position, and
  refuses any Supabase-managed host whose ref it cannot determine. There is no
  override flag; the supported fix is to stop pointing `DATABASE_URL` at
  production. Refusal messages never echo the connection string.
- **Non-production RC only.** Production hosts, the Production alias, and
  `-git-main-` previews are all refused.
- **Proven data plane.** Mutating runs require a non-production Supabase ref.
- **No committed session material.** `.gitignore` excludes `**/.auth/`,
  `*storage-state*.json`, `*storageState*.json`, `artifacts/`,
  `playwright-report/`, and `test-results/`.
- **Least privilege.** The workflow declares `permissions: contents: read`, uses
  no `pull_request_target`, and has no `continue-on-error` on any
  release-critical step.

## Not yet covered

The customer magic-link portal (`web/src/app/customer-portal/**`, ADR-010) landed
on `main` after this suite was written and is **not** exercised by it. The
canonical workflow here is the contractor-side path, which ends at the invoice;
it does not obtain a magic link, redeem it, or assert the portal's security
contract.

Validating that surface — replay, expiry, cross-tenant token use, customer
scope, and signature attribution — is genuine beta-evidence work and is tracked
as follow-up. Until it exists, a passing run of this suite says nothing about
customer-portal security, and must not be cited as if it did.

## Acceptance criteria

A run is PASS only when all of these hold in the same run:

- the RC URL resolved unambiguously to an approved non-production host;
- environment identity matched;
- the data plane was proven non-production;
- authentication passed and the session was scoped to the expected tenant;
- all four viewports passed;
- every required checkpoint was captured, non-empty, and at the correct width;
- every business assertion passed, including save/reload persistence, the
  shipped pricing/tax totals, proposal value transfer, and the invoice billing
  sell price rather than direct cost;
- the tenant-isolation probe denied every foreign resource;
- artifact validation passed and no credential material was detected.

Any FAIL means beta evidence is NOT READY. A PARTIAL result (a targeted
single-viewport run) is not evidence either. Absence of a run means UNVERIFIED —
documentation and configuration are never substitutes for a passing run.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `RC_URL_UNRESOLVED` | no URL from any source | pass `rc_base_url` or set `BETA_RC_BASE_URL` |
| `RC_URL_AMBIGUOUS` | sources disagree | make the input and the variable agree, or clear one |
| `RC_URL_TRACKS_MAIN` | targeting the `-git-main-` alias | use a branch Preview or a dedicated staging deployment |
| `DATA_PLANE_UNPROVEN` | `BETA_RC_SUPABASE_PROJECT_REF` unset | set it to the RC Supabase project ref |
| `DATA_PLANE_IS_PRODUCTION` | RC shares Production's database | give Preview its own Supabase project or branch |
| `ENV_MISMATCH` | expected/actual disagree | align both to `preview` or `staging` |
| `SHA_MISMATCH` | deployment predates the commit | wait for the deployment, then re-run |
| Login times out | wrong credentials or unreachable deployment | verify the smoke identity and that the Preview is READY |
| `has no organization` | identity authenticated but unprovisioned | complete smoke tenant onboarding |
| `not scoped to the expected smoke tenant` | identity belongs elsewhere | fix `smoke_tenant_label` or the identity's membership |
| `failed the 390px quality gate` | genuine mobile overflow | fix the responsive defect; do not widen the tolerance |
| `WRONG_WIDTH` | screenshot width ≠ viewport | do not resize screenshots; capture at the real viewport |
| `Evidence bundle contains session material` | credential material reached the bundle | remove it; never relax the scan (the artifact upload is skipped when this fails) |
| `ENV_UNDERIVABLE` | host is not a recognised TradeOS deployment | target an approved Preview or staging deployment |
| `No tenant-isolation probe could be constructed` | only an estimate id was supplied | also supply `BETA_RC_FOREIGN_PROJECT_ID` |
| viewport shows `STALE` | a capture report is left over from an earlier run | clear the evidence directory and re-run |
| `Overall: PARTIAL` | a targeted `--viewport` run | run the full matrix for a release gate |
