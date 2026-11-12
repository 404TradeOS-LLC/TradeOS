# Beta Readiness Evidence — 2026-11-08 (Commander Mission)

**Status: NOT READY for beta certification.**
**Decision date:** 2026-11-08 ~23:30 EST (2026-11-09 ~04:30 UTC).
**Mission:** TradeOS Autonomous Browser & Beta Evidence Commander, authorized by Billy 2026-11-08.
**Package lane:** Lane 6 (Evidence Package). This document assembles — it does not replace —
the existing beta-evidence workflow (`.github/workflows/beta-evidence.yml`, canonical
scenario; `.github/workflows/playwright-agent-evidence.yml` for §19). No workflow was
changed by this package.
**Repo:** 404TradeOS-LLC/TradeOS. **Main head at package time:** `58dcb6ac`
(`58dcb6acfad3fc05f80f7d72ae1dfe77871dd493`). **Staging head:** `c800425f`
(`c800425fd4a94278325193d488b15925a5406d27`).
**Staging alias:** https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app
**Motion preview alias:** https://tradeos-costbook-web-git-feat-tradeos-s-cc3986-billykshowalters.vercel.app

## How to read this package

- **PASS** = executed and passed in the cited run. **FAIL** = executed and failed.
  **BLOCKED** = cannot run (missing Billy-held fixture/secret, or not implemented).
  **NOT RUN** = not executed (code/spec may exist). Nothing in this package upgrades
  NOT RUN to PASS, and no unexecuted test is classified as passing.
- Every claim cites a live source: a GitHub run ID, a commit SHA, an artifact ID, or a
  lane report section from the 2026-11-08 commander mission (lane reports live at
  `~/workspace/research_notes/commander-2026-11-08/lane-{1..7}-*/report.md`).
- **Notion link note:** the brief's Notion "Agent Operating Guide v0.0.6" link was NOT
  accessible from this environment. Nothing in this package relies on it; no Notion
  content is cited.

## 0. Release-readiness decision — NOT READY

**Beta certification is NOT granted.** The canonical evidence run failed at
authentication, s052/s053/beta_pdf are blocked, and the PR queue is unmerged.
Ordered blockers (each must clear before a re-verification run can certify):

1. **Canonical beta evidence failed at auth (run 42558228523).** `[auth-setup] Login did
   not reach an authenticated route within 60s.` No workflow step executed; 0 screenshots.
   Root cause most likely the staging Supabase account state for the `hello@` smoke
   identity, not a code regression (Lane 5 §a). Billy decision required: (a) rotate /
   re-enter `BETA_RC_SMOKE_PASSWORD` for the `hello@` staging account, or (b) switch the
   smoke identity to the proven staging test account `staytrue201+staging-test@gmail.com`
   (Lane 5 recommends (b)). Do not blindly re-dispatch a full run until the secret is
   confirmed. Owner: **Billy**.
2. **s052/s053/beta_pdf cannot pass target resolution.** The `BETA_RC_DEPLOYMENT_SHA`
   repo variable does not exist (verified 404), and the staging web deployment reports no
   commit SHA on any public surface, so `SHA_ACTUAL_MISSING` fails every s052/s053/beta_pdf
   run (runs 42558669567, 42558761406, 42558876189). Interim fix: populate the variable
   with the current staging head after every promotion
   (`gh variable set BETA_RC_DEPLOYMENT_SHA --repo 404TradeOS-LLC/TradeOS --body
   c800425fd4a94278325193d488b15925a5406d27`); durable fix: the public build-info endpoint
   recorded as follow-up in `docs/testing/BETA_EVIDENCE.md:134-138`. Owner: **Billy /
   coordinator** (variable) + **future lane** (endpoint PR).
3. **Billy-held secrets missing (s052/s053/beta_pdf fixtures).**
   `BETA_RC_S052_ADMIN_PASSWORD`, `BETA_RC_S052_INACTIVE_PASSWORD`,
   `BETA_RC_FOREIGN_ESTIMATE_ID` absent; beta_pdf foreign-owner set
   (`BETA_FOREIGN_OWNER_EMAIL` / `BETA_FOREIGN_OWNER_PASSWORD` /
   `BETA_FOREIGN_OWNER_ORG_ID` / `BETA_FOREIGN_PROPOSAL_ID`) empty. s052/s053 fail
   closed by design until Billy supplies these in his own session; no foreign estimate
   exists in staging (one must be created as the foreign admin). Owner: **Billy**.
4. **Auth-failure diagnostics gap is fixed in code but unproven end to end.**
   Draft PR #947 (Lane 5, head `17ff4db6`, 4/4 required checks green) ports the
   login-failure capture to main's `auth-setup.mjs`; no live beta run has exercised it
   yet. Owner: **coordinator** (re-run after blocker 1 clears).
5. **PR queue unmerged — zero merges this mission.** #918 (head now `516b17c6`, 2 threads
   left, CHANGES_REQUESTED standing, §19 re-run owed on the new head), #921 (HOLD: four-width
   acceptance not run), #924, #937, #775 (1 Major thread), #945, #947 all still open.
   Owner: **coordinator / Billy** (per-PR gates; see §9).
6. **Staging four-width matrix is EMPTY.** Every staging cell is NOT RUN (§2). The only
   current four-width evidence is §19 estimate-stage navigation on the motion preview
   (§1, run 42514622727) — narrow scope, not staging, not the whole workflow.

What **is** verified and stands: browser environment READY (Lane 1); staging
deployment healthy — API `/health` commitSha `c800425f`, `/ready` staging projectRef
`qfbgdkbamfaasmtjfyru` (§5); migration ledger 71/71 with 0 pending (§4); §19
four-width evidence current for estimate-stage navigation (§1); PR #947 CI green.

## 1. Beta acceptance matrix (workflow step × status, with proof links)

Canonical full run 42558228523 (Beta Evidence, `workflow_dispatch`, main `58dcb6ac`,
staging alias, canonical scenario) failed at auth-setup before any workflow step
executed — so this lane produced **no new per-step results**. The table records that
fact plus the prior verified evidence that still stands (2026-11-06 staging walkthrough,
customer → project → estimate → proposal → job → invoice in TEST Org; 2026-11-07 #936
staging verification). Prior evidence is labelled prior; it is not re-claimed as new.

| Workflow step | Status (this mission) | Proof |
|---|---|---|
| Login | **FAIL** (canonical run) | Run 42558228523: `[auth-setup] Login did not reach an authenticated route within 60s` (Lane 3 §b; Lane 4 §2a; Lane 5 §a). Smoke identity masked `h***@404tradeos.com`, expected org `TEST Org — Delete Me`. |
| Today | **NOT RUN** | Spec exists (`tests/playwright/authenticated.spec.ts`, Today board render, read-only, needs storage state); canonical run died at auth (Lane 3 §a). |
| Customer | **NOT RUN** | `capture-evidence.mjs` + `authenticated.spec.ts` exist; not executed (Lane 3 §a). |
| Project | **NOT RUN** | `capture-evidence.mjs` + `authenticated.spec.ts` exist; not executed (Lane 3 §a). |
| Site Visit | **GAP (browser)** | No Playwright spec drives a site visit. Only `app/tests/siteVisits.controller.test.ts` (mocked controller). Intake page exists: `web/src/app/(app)/projects/[id]/intake/page.tsx`. Interactive gap G1 (Lane 3 §d). |
| Estimate | **NOT RUN** (this mission); §19 PASS for stage navigation only — see §2 | `capture-evidence.mjs` + estimate specs exist; canonical run died at auth (Lane 3 §a). |
| Proposal | **NOT RUN** | `capture-evidence.mjs` + `proposal-failure-retention.spec.ts` + `proposal-price-basis.spec.ts` exist; not executed (Lane 3 §a). |
| Customer Acceptance | **NOT RUN** (this mission); **prior PASS (Nov 6)** in-app Send → Accepted | Canonical run never reached step 08; customer-portal magic-link acceptance is an explicit GAP (`docs/testing/BETA_EVIDENCE.md`, "Not yet covered") (Lane 3 §a). |
| Contract / Signature | **NOT RUN**; browser signing **GAP** | `capture-evidence.mjs` creates a contract; no spec drives the signing UI. Service coverage: `app/tests/contracts.service.test.ts` (Lane 3 §a). Gap G8 (Lane 3 §d). |
| Job Creation | **GAP in canonical**; **prior single-path PASS (Nov 6)** — exactly one job (#JOB-2026-000001, Unscheduled, $1,500) via proposal→job handoff | `capture-evidence.mjs` has no job-creation step. Service coverage: `app/tests/jobs.service.test.ts` (advisory lock `proposal-job:`). Gap G2 (Lane 3 §d). |
| Dispatch | **GAP (browser)** | Only `app/tests/dispatchRules.test.ts` + Athena dispatcher contract tests. Page exists (`web/src/app/(app)/dispatch/page.tsx`). Gap G3 (Lane 3 §d). |
| Field Work | **GAP (browser)** | Only `app/tests/field-task-status.service.test.ts` + `field-task-status.rls.integration.ts` + `app/tests/jobs.lifecycle.test.ts`. Gap G4 (Lane 3 §d). |
| Expenses | **GAP (browser)** | Only `app/tests/job-expenses.service.test.ts` + `job-expenses.controller.test.ts` + `job-expenses.migration.test.ts`. Gap G5 (Lane 3 §d). |
| Invoice | **NOT RUN** (this mission); **prior PASS (Nov 6)** — invoice #1 DRAFT, never sent, $1,500, $0 paid | Canonical run would have created a draft invoice (sell-price `$7,105.07` assertion) but died at auth (Lane 3 §a). |
| Payment / Closeout | **GAP (browser)** | `app/tests/payments.service.test.ts` is ledger-read only. No spec records a payment or closes a job/invoice in the browser. Gap G6 (Lane 3 §d). |
| Change orders | **GAP (browser)** | Only `app/tests/change-orders.service.test.ts`. Gap G7 (Lane 3 §d). |
| Return navigation | **GAP** | No spec asserts UI back/return navigation between steps. Gap G9 (Lane 3 §d). |
| Error / empty states | **NOT RUN** (this mission); **prior PASS (persistence basics)** — Nov 6 estimate/proposal persisted; #936 invoice due-date persisted ("Due Dec 15, 2026") | Code exists unexecuted: `proposal-failure-retention.spec.ts`, `estimate-mapping-resolve.spec.ts`, `estimate-stage-navigation.spec.ts`, `estimate-item-edit-cost.spec.ts`. Gap G10 (Lane 3 §d). |

Interactive gaps G1–G10 (exact steps for a parent browser task, staging alias, staging
test account `staytrue201+staging-test@gmail.com`, TEST Org — Delete Me, Owner; synthetic
records named `… — Delete Me` only; never send to a real address; never record a real
payment; never touch production) are specified in full in Lane 3 §d.

## 2. Browser coverage matrix (workflow step × viewport)

Required viewports: 390 / 768 / 1024 / 1440.

### 2a. Canonical staging matrix — run 42558228523 (full, staging alias, main `58dcb6ac`)

**Every cell NOT RUN.** Proof: artifact `beta-evidence` (id 13648580396) `metadata.json` —
`screenshotCount: 0`, `results.viewports` all FAIL, 28 `MISSING` required screenshots
(`beta-{1440,1024,768,390}-01…07`) + 4 `VIEWPORT_UNREPRESENTED`; job log shows all four
"Capture evidence at {viewport}px" steps skipped after the auth-setup failure (Lane 4 §3).
The viewport FAILs in `metadata.json` record absence of evidence, not executed-test
failures — hence NOT RUN, not FAIL, per cell.

| Workflow step | 390 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Login | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Today | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Customer | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Project | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Site Visit | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Estimate | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Proposal | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Acceptance | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Contract / Signature | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Job | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Dispatch | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Field Work | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Expenses | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Invoice | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Payment / Closeout | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Change orders | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Return navigation | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

### 2b. §19 motion-preview matrix — run 42514622727 (estimate-stage navigation only)

Run 42514622727, workflow "Playwright Agent Chromium Evidence", head `ae1cca22`
(branch `feat/tradeos-signature-motion`), motion preview alias. Job "Chromium browser
evidence" success 2026-11-08T19:21:22Z–19:22:43Z. Log: `Running 4 tests using 1 worker`,
**`4 passed (17.6s)`** — one passing test per viewport (390: 4.1 s, 768: 4.2 s,
1024: 3.7 s, 1440: 4.8 s) for `tests/playwright/estimate-stage-navigation.spec.ts`
(keyboard navigation waits for scope save and recovers from failure) on the draft estimate
route `/projects/77ce048e-2205-44dd-a9d5-29a74275a350/estimates/72573a6f-dfd5-4d13-ad7a-75a65a77ea58`.
Auth setup PASS (`auth/auth-setup-report.json`: `result: "PASS"`, all 4 steps passed,
smoke identity `s***@gmail.com`, expected org `TEST Org — Delete Me`). Screenshot widths
verified from artifact pixels: 390×844, 768×844, 1024×844, 1440×844 (Lane 4 §1).
**Caveat: `exactDeploymentShaCorrelated: false`** in the artifact's `run.json` — the
4-pass result is verified, the deployment-SHA correlation is not (Lane 2 D4; Lane 4 §1d).
**Scope limit:** estimate-stage navigation only. It does not certify any other workflow
step at any width, and it is not staging evidence (preview target, motion-branch head).
**Staleness note:** #918's head has since moved to `516b17c6` (Lane 7 repair commit);
a fresh §19 run is owed on the new head before any #918 merge decision.

| Workflow step | 390 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Estimate (stage navigation only) | **PASS** | **PASS** | **PASS** | **PASS** |
| All other 16 steps | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

### 2c. Console errors / network failures / layout (per viewport)

- §19 run 42514622727: **none recorded** in the 868-line job log (zero `console`,
  `pageerror`, `requestfailed`, `net::`, `ERR_` lines). The artifact contains no
  console/network log file — this is "none recorded in the available log/artifact", not
  an instrumented assertion of console silence (Lane 4 §4).
- Canonical run 42558228523: **no console/network data exists** — no capture step ran.
  NOT RUN, not "zero errors" (Lane 4 §4).
- Layout observations from visual inspection of the four §19 screenshots (Lane 4 §5;
  Lane 7 re-inspected 1440/1024/390 + a 4× crop): (1) an edge-docked circular control
  half-clipped at the right viewport edge at all four widths — not traceable to any
  repo source (`web/src` has no such element); most plausibly preview-deployment-injected
  chrome (e.g. Vercel toolbar/feedback on the throwaway motion preview), not a #918
  defect and not a merge-bar item; smallest resolving action is to check whether it also
  appears on a non-motion preview / staging (owner: coordinator); (2) Athena panel narrow
  at 1024 px but readable; (3) fixed bottom nav overlays content at 390 px (standard
  fixed-nav behavior). None is a failure; the spec passed 4/4.

### 2d. Browser environment (Lane 1 — READY)

Firefox 157.0 + Playwright 1.64.1; profile `~/.config/tradeos-mcp/firefox-profile/`;
Hatch Sandbox Egress CA re-synced during Lane 1 (profile fingerprint now
`AE:25:5F:18:02:2D:29:F6:84:74:78:FF:93:6D:47:C5:FC:63:10:AA:F9:41:67:B4:1D:BE:88:62:D3:43:11:D2`,
matching `/run/hatch/egress-tls/hatch-egress-ca.pem`); MCP registration intact
(`~/.config/muse/settings.json`, `playwright-test` server, cwd
`~/workspace/tradeos-mcp-firefox`). Unauthenticated smoke test passed: example.com
1440 (304, 0 console errors, 0 failed requests) and staging `/login` at 1440 and 390
(200, title `Sign in | TradeOS`, 0 console errors, 0 failed requests). Observation: the
staging `/login` screenshots capture the TradeOS intro splash, not the sign-in form —
the intro film had not dismissed within the 3 s post-load wait (known motion-branch
lesson; Lane 3's authenticated run keeps its film-wait). No login attempted by Lane 1.
Recurring maintenance: the Egress CA rotates multiple times a day — re-check the profile
fingerprint against the runtime PEM on any future TLS failure (owner: whoever runs the
next browser session).

## 3. Screenshot and trace artifact manifest

| Run | Workflow / mode | Head | Conclusion | Artifact (id, size, expiry) | Contents / status |
|---|---|---|---|---|---|
| **42514622727** | Playwright Agent Chromium Evidence (§19) | `ae1cca22` motion | success 2026-11-08 19:21:22–19:22:43Z | `playwright-agent-evidence-42514622727-1` (13631230190, **4,567,165 bytes**, not expired) | 4 passing tests; 4 screenshots at exact widths 390/768/1024/1440 (`test-finished-1.png` each); `auth-setup-report.json` PASS; `run.json` (`exactDeploymentShaCorrelated: false`). https://github.com/404TradeOS-LLC/TradeOS/actions/runs/42514622727 |
| **42558228523** | Beta Evidence / full, canonical, staging | `58dcb6ac` main | **failure** 2026-11-09 03:46:41–03:48:37Z | `beta-evidence` (13648580396, **1,922 bytes**, not expired) | **Failure bundle, not evidence**: exactly 3 JSON files (`metadata.json`, `rc-target.json`, `auth-setup-report.json`); **0 screenshots**; 28 MISSING + 4 VIEWPORT_UNREPRESENTED. https://github.com/404TradeOS-LLC/TradeOS/actions/runs/42558228523 |
| 42558462617 | Beta Evidence / preflight, s052, no expected SHA | `58dcb6ac` main | failure 03:49:24–03:49:53Z | none | `SHA_EXPECTED_MISSING` at resolve step. https://github.com/404TradeOS-LLC/TradeOS/actions/runs/42558462617 |
| 42558669567 | Beta Evidence / preflight, s052, expected SHA `c800425f` | `58dcb6ac` main | failure | none | `SHA_ACTUAL_MISSING`. https://github.com/404TradeOS-LLC/TradeOS/actions/runs/42558669567 |
| 42558761406 | Beta Evidence / preflight, s053, expected SHA `c800425f` | `58dcb6ac` main | failure | none | `SHA_ACTUAL_MISSING`. https://github.com/404TradeOS-LLC/TradeOS/actions/runs/42558761406 |
| 42558876189 | Beta Evidence / preflight, beta_pdf, expected SHA `c800425f` | `58dcb6ac` main | failure | none | `SHA_ACTUAL_MISSING`. https://github.com/404TradeOS-LLC/TradeOS/actions/runs/42558876189 |
| 42464222186 | Beta Evidence / preflight, canonical, staging | `58dcb6ac` main | **success** 2026-11-08 08:44:46Z | none | Last successful beta-evidence run. Preflight only: checks config/guards/credential availability, performs no real login, captures no evidence — its success is consistent with the later full-run auth failure (Lane 4 §2d(5)). https://github.com/404TradeOS-LLC/TradeOS/actions/runs/42464222186 |
| 42513430211 | Playwright Agent Chromium Evidence | `ae1cca22` motion | success 2026-11-08 19:07:29Z | (not enumerated) | Immediately precedes §19 run; same head (Lane 2 §7). |
| 42464411428 | Playwright Agent Chromium Evidence | `58dcb6ac` main | failure 2026-11-08 08:47:26Z | — | Main-head evidence attempt; not re-diagnosed (Lane 2 §7). |
| 42512122952 | Playwright Agent Chromium Evidence | `000c6d89` motion | failure 2026-11-08 18:52:05Z | — | Earlier motion head; superseded by `ae1cca22` runs (Lane 2 §7). |
| 42465235402 / 42462167628 / 42456674059 / 42454542819 | Playwright Agent Chromium Evidence | `64fd00ff` / `e8ed0baf` motion | failure (08:59 / 08:15 / 06:55 / 06:23Z) | — | Older motion-head attempts; not re-diagnosed (Lane 2 §7). |
| 37163298849 / 37163295977 / 37163275091 (+ 3 more) | Beta Evidence | `cc5f628d` / `5e44c9b7` / `e382c8ed`, `test/s052-customer-project-certification` | failure 2026-10-03 | — | Old S052-branch push runs; superseded (Lane 2 §7). |

Stale / unverified prior-evidence claims (do NOT cite as current — Lane 4 §7):
- "S027 run #22 (36 captures)": **UNVERIFIED / STALE.** No matching live artifact found.
  Closest live matches: beta-evidence run #22 is 34182952997 (2026-09-08, head `684bf7ad`,
  failure, no artifacts — expired); Playwright Agent run #22 **is** the §19 run itself
  (4 captures, not 36).
- Beta-evidence full run #28 (34811468426, 2026-09-14, success, main `5c1eb6c9`) and #26
  (34183768615, 2026-09-08, success): **STALE** — behind main `58dcb6ac` by ~8 weeks;
  artifacts expired (30-day retention); none retrievable.
- `tests/playwright/beta-readiness.spec.ts` (cited in the mission handoff as blocked on
  Billy-only secrets): **NOT FOUND** — 404 on main; `tests/playwright/` on main lists 15
  files, none matching beta/readiness. It cannot be run until the file exists. Its
  "blocked on secrets" status is moot (Lane 4 §7).

Lane 1 local smoke screenshots (not GitHub artifacts; live in the lane-1 dir):
`example-1440.png` (86,080 B, 1440×900), `staging-login-1440.png` (310,733 B, 1440×900),
`staging-login-390.png` (46,267 B, 390×900) — see Lane 1 §d.

## 4. Test commands and reproducibility instructions

Run every command from the repo root unless stated. No command below was re-executed
by this lane to produce new evidence — these are the exact commands / dispatches behind
the cited runs, so a future lane can reproduce them.

### 4a. Canonical beta evidence (full, staging) — run 42558228523

```sh
gh workflow run beta-evidence.yml --repo 404TradeOS-LLC/TradeOS --ref main \
  -f mode=full -f scenario=canonical \
  -f rc_base_url=https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app \
  -f target_environment=staging -f smoke_tenant_label="TEST Org — Delete Me"
# Inspect:
gh run view 42558228523 --log --repo 404TradeOS-LLC/TradeOS
gh run download 42558228523 --repo 404TradeOS-LLC/TradeOS --name beta-evidence
```

Preconditions: `BETA_RC_SMOKE_EMAIL` / `BETA_RC_SMOKE_PASSWORD` /
`BETA_RC_SUPABASE_PROJECT_REF` set and valid for the staging tenant; do **not** re-dispatch
until blocker 1 (§0) is resolved (Lane 3 §e R1; Lane 5 §a).

### 4b. Beta-evidence preflights (s052 / s053 / beta_pdf) — runs 42558462617, 42558669567, 42558761406, 42558876189

```sh
# s052 without expected SHA (fails SHA_EXPECTED_MISSING):
gh workflow run beta-evidence.yml --repo 404TradeOS-LLC/TradeOS --ref main \
  -f mode=preflight -f scenario=s052 \
  -f rc_base_url=https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app \
  -f target_environment=staging -f smoke_tenant_label="TEST Org — Delete Me"
# s052/s053/beta_pdf with expected SHA (fails SHA_ACTUAL_MISSING until the
# BETA_RC_DEPLOYMENT_SHA variable exists):
gh workflow run beta-evidence.yml --repo 404TradeOS-LLC/TradeOS --ref main \
  -f mode=preflight -f scenario=s052 \
  -f rc_base_url=https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app \
  -f target_environment=staging -f smoke_tenant_label="TEST Org — Delete Me" \
  -f expected_sha=c800425fd4a94278325193d488b15925a5406d27
# Inspect: gh run view <RUN_ID> --log --repo 404TradeOS-LLC/TradeOS
```

### 4c. §19 motion evidence — run 42514622727

Dispatched via the Playwright Agent Chromium Evidence workflow
(`.github/workflows/playwright-agent-evidence.yml`, workflow_dispatch) against the motion
preview alias with `SPEC_FILE=tests/playwright/estimate-stage-navigation.spec.ts` and
`TRADEOS_ESTIMATE_STAGE_PATH=/projects/77ce048e-2205-44dd-a9d5-29a74275a350/estimates/72573a6f-dfd5-4d13-ad7a-75a65a77ea58`,
authenticated TEST Org session. Inspect:

```sh
gh run view 42514622727 --log --repo 404TradeOS-LLC/TradeOS
gh run download 42514622727 --repo 404TradeOS-LLC/TradeOS \
  --name playwright-agent-evidence-42514622727-1
# Verify widths: python3 -c "from PIL import Image; ..."
# Log line to confirm: "4 passed (17.6s)"
```

### 4d. Staging migration ledger — run 42513660175

```sh
gh run view 42513660175 --log --repo 404TradeOS-LLC/TradeOS
# Log lines to confirm (2026-11-08 19:10:47Z / 19:10:49Z):
# "No pending migrations to apply."
# "Verified 71 applied migrations; no unfinished migrations."
```

### 4e. Runtime identity probes (public endpoints only)

```sh
curl -L https://tradeos-costbook-web-git-staging-billykshowalters.vercel.app/        # 200
curl https://tradeos-costbook-git-staging-billykshowalters.vercel.app/health         # {"status":"ok",...,"commitSha":"c800425f..."}
curl https://tradeos-costbook-git-staging-billykshowalters.vercel.app/ready          # {"status":"ready",...,"projectRef":"qfbgdkbamfaasmtjfyru"}
curl -L https://tradeos-costbook-web-git-feat-tradeos-s-cc3986-billykshowalters.vercel.app/  # 200
```

### 4f. Lane 5 R2 regression / gate commands (draft PR #947, head `17ff4db6`)

```sh
node --test app/scripts/beta-evidence/lib/login-failure-diagnostics.test.mjs scripts/__tests__/beta-evidence.test.mjs  # 54/54 pass
npm run pr:test    # 302/302 pass (after npm ci in a fresh worktree)
npm run docs:check # PASS
```

### 4g. Lane 1 browser smoke test

Script `smoke-test.js` in the lane-1 dir (Playwright 1.64.1 from
`~/workspace/tradeos-motion/node_modules`, `firefox.launchPersistentContext` with the MCP
profile, headless). Results in `smoke-results.json` in the same dir.

## 5. Migration and staging verification report

- **71 `migration.sql` files on main** (`app/prisma/migrations/*/migration.sql`), first
  `20260623143000_init_schema`, newest `20261105220000_add_resend_delivery_journal`
  (verified via the `58dcb6ac` tree listing, Lane 2 §3).
- **Staging ledger: 71 applied, 0 pending, 0 unfinished.** Run **42513660175**
  (2026-11-08 19:10:08Z, head main `58dcb6ac`, conclusion success, job 128831894316
  "Deploy Prisma migrations to TradeOS Staging"): log 19:10:47Z "No pending migrations to
  apply." and 19:10:49Z "Verified 71 applied migrations; no unfinished migrations."
  (Lane 2 §3). Two earlier same-day no-op successes on the same head: 42464554383
  (08:49:30Z) and 42462148933 (08:15:30Z).
- Applied (71) == on-main (71) → **no migration replay needed, no migration pending.
  Never replay an applied migration.**
- Invoice-expand preflight guard exists in `.github/workflows/deploy-staging-migrations.yml`
  (lines 91–133). Both invoice migrations are in main's 71
  (`20260902193000_rename_invoice_line_price_columns`,
  `20260902200000_contract_invoice_line_price_columns`) and therefore in the applied 71.
  The contract-migration approval gate (lines 168–191) is **not currently engaged**
  (migration already applied; engages only if a future run finds it pending) (Lane 2 §3).
- Deploy workflow is `workflow_dispatch` from **main only**, `environment: staging`
  (approval gate), `concurrency: deploy-migrations-staging`; it "cannot select production"
  per its header comment (Lane 2 §3).
- **P3 (prepared, NOT executed):** if a future main ever lands a new migration,
  `gh workflow run deploy-staging-migrations.yml --repo 404TradeOS-LLC/TradeOS --ref main`,
  then Billy approves the staging-environment gate in GitHub. **Do not dispatch now —
  there is nothing to apply** (Lane 2 §8 P3).

## 6. API/web runtime identity verification

Probed 2026-11-08 ~22:47 EST (2026-11-09 03:47 UTC) by Lane 2 §4; re-verified live by
Lane 5 at 2026-11-09T03:59:55Z (`/ready` latency 219.8 ms, `/health` commitSha `c800425f`).

| Check | Result |
|---|---|
| Staging web alias `/` | HTTP 200, 11,542 bytes, Next.js HTML, `X-Robots-Tag: noindex` — VERIFIED reachable |
| Staging API `/health` | HTTP 200: `{"status":"ok","service":"tradeos-costbook-api","version":"0.1.0","commitSha":"c800425fd4a94278325193d488b15925a5406d27"}` — commitSha **equals staging head `c800425f`** — VERIFIED |
| Staging API `/ready` | HTTP 200: database `ok` (latency 368.2 ms at first probe, 300.3 ms / 219.8 ms at later probes), **`projectRef: qfbgdkbamfaasmtjfyru` (STAGING, not production `kssaceuetdjwfqnbzhly`)**, schema `ok` — VERIFIED staging-bound |
| Motion preview alias `/` | HTTP 200, 11,598 bytes, Next.js HTML — VERIFIED reachable |
| Motion preview alias deployment SHA | **UNVERIFIED** — public response headers expose no commit SHA (`X-Vercel-Id` is a request id, not a deployment SHA); §19 run log records `exactDeploymentShaCorrelated: false`. The brief's "READY deployment @ e8ed0baf" could not be re-confirmed live; Vercel team API reads historically return 403 and were not attempted with any credential (Lane 2 §4). |
| Staging web alias deployment SHA (direct probe) | **UNVERIFIED by direct probe** for the same header reason; corroborated only indirectly by the API `/health` commitSha `c800425f` on the sibling staging alias and by staging being live on `c800425f` (Lane 2 §4). |
| Repo-stated Vercel metadata | `.github/workflows/staging-orchestrator.yml`: `STAGING_PROJECT_REF: qfbgdkbamfaasmtjfyru`, `API_PROJECT_ID: prj_BVJxF6rnO90wMdNjZ1Yn4QO1aGwD`, `WEB_PROJECT_ID: prj_jDyORkIa7ug3ZtgtNujwEa65hQ36`, team `team_nY1VrcaEYEr4rcW7Gxweq7LP` (Lane 2 §4). |

## 7. Tenant isolation and permission results

### Proven (code level and prior runs)

- **Staging data plane is the staging project**: `/ready` projectRef `qfbgdkbamfaasmtjfyru`
  (§6) — the staging Supabase project, not production.
- **RLS / service-level isolation coverage exists in code** (not browser evidence):
  `app/tests/rls.integration.ts`, `field-task-status.rls.integration.ts`,
  `athena-action-idempotency.rls.integration.ts`; `app/tests/job-expenses.service.test.ts`
  (cross-org 404); `app/tests/jobs.service.test.ts` (tenant-scoped advisory lock).
- **Prior browser note:** #937 records "Tenant isolation + audit privacy verified in
  code" — code-level, not browser evidence (Lane 3 §c(7)).

### NOT RUN (browser) — the s052/s053 blockers

- **S052: NOT READY (proven by missing fixtures).** Contract
  (`docs/architecture/S052_CUSTOMER_PROJECT_CERTIFICATION_PLAN.md`, status current,
  last_verified 2026-10-03; `docs/testing/BETA_EVIDENCE.md` lines 14, 315–338): owner +
  admin happy paths, Customer create/update, duplicate advisory without silent merge,
  validation denial without mutation, ServiceAddress persistence through reload,
  Customer-linked Project with address/scope retained after reload, **inactive-membership
  denial**, **cross-tenant Customer/Project denial (API 403/404, both
  `BETA_RC_FOREIGN_CUSTOMER_ID` + `BETA_RC_FOREIGN_PROJECT_ID` from a separate synthetic
  tenant)**, responsive evidence at 1440/768/390 + exact deployment-SHA correlation.
  Missing fixtures = NOT READY; never substitute a founder account or weaken checks.
  `BETA_RC_S052_ADMIN_PASSWORD` and `BETA_RC_S052_INACTIVE_PASSWORD` absent (emails
  present, set 2026-11-08 08:29Z); no full `s052` run exists in recent workflow history
  (last `s052`-branch runs are 2026-10-03 push failures on
  `test/s052-customer-project-certification`). No owner/admin persistence proof, no
  inactive-denial proof, no cross-tenant denial proof exists from a passing run
  (Lane 2 §6). S052 moves to DONE only after the evidence PR merges AND a retained full
  non-production `s052` run proves the contract.
- **S053: NOT READY (proven by missing fixture).** Contract
  (`docs/testing/BETA_EVIDENCE.md` lines 16, 340–370; secret table lines 227–234):
  per-viewport proof of a real authenticated estimate in the synthetic tenant; an
  intentionally unmapped scope renders blocked **Setup required**, cannot enable Apply,
  creates no line; Athena then produces ≥1 resolved suggestion from a bounded scope; the
  S053-created line is removed before the canonical fixed-total checks resume; requires
  `BETA_RC_FOREIGN_ESTIMATE_ID` for the foreign Athena draft denial (403/404).
  `BETA_RC_FOREIGN_ESTIMATE_ID` absent; no `s053` scenario run in recent history. No
  foreign-estimate denial proof exists (Lane 2 §6).
- **Canonical run 42558228523: Tenant isolation FAIL** — but the run died at auth before
  `tenant-isolation.mjs` executed (no probes constructed), so it proves nothing about
  tenant isolation either way (Lane 2 §6; Lane 3 §b).
- **beta_pdf:** additionally blocked on `BETA_FOREIGN_OWNER_EMAIL` /
  `BETA_FOREIGN_OWNER_PASSWORD` / `BETA_FOREIGN_OWNER_ORG_ID` /
  `BETA_FOREIGN_PROPOSAL_ID` (all empty in run 42558228523's env listing; Lane 4 §6).
- **Secret presence (names only — no values):** present: `BETA_RC_S052_ADMIN_EMAIL`,
  `BETA_RC_S052_INACTIVE_EMAIL`, `BETA_RC_FOREIGN_CUSTOMER_ID`,
  `BETA_RC_FOREIGN_PROJECT_ID`, `TEST_STAGING_EMAIL`, `TEST_STAGING_PASSWORD`,
  `BETA_RC_SMOKE_EMAIL`, `BETA_RC_SMOKE_PASSWORD`, `BETA_RC_SUPABASE_PROJECT_REF`,
  `RC_E2E_LIFECYCLE_AUTH_EMAIL`, `RC_E2E_LIFECYCLE_AUTH_PASSWORD`,
  `RC_E2E_LIFECYCLE_AUTH_REJECTED_PASSWORD`, `VERCEL_TOKEN`. Missing:
  `BETA_RC_S052_ADMIN_PASSWORD`, `BETA_RC_S052_INACTIVE_PASSWORD`,
  `BETA_RC_FOREIGN_ESTIMATE_ID`, `VERCEL_AUTOMATION_BYPASS_SECRET` (noted "not needed"
  for the beta-email flow, but absent as a name) (Lane 2 §5). Whether the *values* of
  the present secrets are still valid is UNVERIFIED (Lane 2 §5) — see blocker 1.
- **#921 four-width acceptance** (owner/admin + technician role-denial at
  1440/1024/768/390) has NOT run; needs the P1 secrets + a foreign estimate created as
  the foreign admin (Lane 2 §8 P8; Lane 7 #921).

## 8. Idempotency, concurrency, and rollback results

**Browser evidence: NOT RUN for all three.** The canonical run died at auth; no
browser-level concurrency test exists (Lane 3 §c(4)). **Code-level coverage (cited by
file/test name — not browser evidence):**

| Area | Code-level coverage | Browser status |
|---|---|---|
| Proposal exactly-once | `app/tests/proposals.idempotency.integration.ts` ("returns one persisted proposal to concurrent identical create attempts"); `app/modules/jobs/service.ts:283` advisory lock `proposal-job:${orgId}:${proposalId}` + `findFirst` check; `app/tests/jobs.service.test.ts` (mocked Prisma) | NOT RUN (browser). Prior single-path PASS only (Nov 6, one job). Gap G2. |
| Expense idempotency | `app/tests/job-expenses.service.test.ts` (idempotency-key create/retry/void/concurrency tests) | NOT RUN (browser). Gap G5. |
| Athena action idempotency | `app/tests/athena-action-engine.idempotency.test.ts` + `athena-action-idempotency.rls.integration.ts` | NOT RUN (browser). |
| Rollback / failure recovery | `proposal-failure-retention.spec.ts` (edits retained after repeated server validation); `estimate-mapping-resolve.spec.ts` (install failure preserves mappings; preview failure offers retry); `estimate-stage-navigation.spec.ts` (keyboard nav waits for scope save, recovers from failure — the §19 spec, 4/4 PASS) | NOT RUN as a browser rollback run for jobs, expenses, invoices, or payments. Gap G10 (partial). |
| Contract guards | `app/tests/contracts.service.test.ts` (rejects contract from non-accepted proposal; reject second contract; sign + `signedAt`; portal-signature attribution; double-sign/void guards) | NOT RUN (browser signing). Gap G8. |
| Invoice presentation | `app/tests/invoices.presentation.test.ts` (zero-dollar draft not labeled paid, overpayment clamp); `invoices.void.test.ts` | NOT RUN (browser). Prior PASS Nov 6 (draft only). |

## 9. Remaining findings with specific owners

### Billy (only Billy can do these)

- **B1 — Smoke identity decision (blocker 1):** pick (a) rotate `BETA_RC_SMOKE_PASSWORD`
  for the `hello@` staging account, or (b) switch to `staytrue201+staging-test@gmail.com`
  (recommended by Lane 5). Do not re-dispatch a full beta run until confirmed.
- **B2 — S052/S053/beta_pdf secrets (blocker 3):** supply in his own session, never in
  chat: `BETA_RC_S052_ADMIN_PASSWORD`, `BETA_RC_S052_INACTIVE_PASSWORD`,
  `BETA_RC_FOREIGN_ESTIMATE_ID` (create the foreign estimate in staging as the foreign
  admin first), plus the beta_pdf foreign-owner set.
- **B3 — #918:** dismissal word for the CodeRabbit CHANGES_REQUESTED (review 5819226509)
  if CodeRabbit's re-review of `516b17c6` does not clear it; decision on thread 7
  (keep "clear on ambiguity" — recommended — or direct baseline-preservation) and thread 4
  (authorize the `onMutate` baseline-plumbing follow-up, or accept the race as a documented
  limitation); undraft + merge word only after CI green on `516b17c6`, threads resolved,
  and §19 re-run green.
- **B4 — #775:** Vercel dashboard check that Preview uses the staging Supabase project,
  staging service-role credential, and staging `BACKEND_API_URL` (including branch
  overrides), or an explicit override; then redeploy and re-test the preview login
  against staging. (Attestation run 42376444090 succeeded 2026-11-07 but does not itself
  close the `web/vercel.json:7` thread; the 2026-11-08 03:18 preview login failure
  postdates it.)
- **B5 — #921 ADR-009:** authorize appending the prepared ADR-009 record (Lane 7) only
  after the four-width acceptance exists. Do not append without his explicit word.
- **B6 — #924:** create `RESEND_TEMPLATE_MODE=dashboard` (Preview only, staging API
  project) in Vercel, then the synthetic-recipient acceptance (reset / invitation /
  portal, staging-only token, no real customers) can run.
- **B7 — Staging-apply gate clicks:** Billy clicks them in GitHub; Forge never approves
  them. (No staging-apply gate is currently pending — migration ledger is clean.)

### Coordinator (mission coordinator / Forge)

- **C1 — Re-dispatch canonical beta evidence** after B1, with the expected SHA set to
  staging `c800425f` so correlation is enforced (or as Billy picks in Lane 2 P2); verify
  the R2 diagnostics (PR #947) actually capture `auth/login-failure.*` on any repeat
  failure.
- **C2 — Populate `BETA_RC_DEPLOYMENT_SHA`** (or have Billy do it) after every staging
  promotion; then re-run s052/s053/beta_pdf preflights, then full runs after B2.
- **C3 — §19 re-run on #918 head `516b17c6`** before any #918 merge decision.
- **C4 — Edge-docked clipped control:** check whether it appears on a non-motion preview
  / staging to identify the element (Lane 7 assessment).
- **C5 — Staging orchestrator:** ready to run with `-f sha=c800425f` (staging verified at
  `c800425f`, ledger 71/71); Billy approves the staging-environment gate (Lane 2 P4).
- **C6 — G1–G10 interactive gaps:** schedule parent browser tasks per Lane 3 §d after
  the canonical run passes (staging test account, synthetic records only).

### Future lane

- **F1 — Public build-info endpoint** (durable R3 fix): deployment reports environment,
  commit SHA, and data-plane ref; `resolve-rc-target.mjs` verifies instead of trusting
  configuration (`docs/testing/BETA_EVIDENCE.md:134-138`). Separate PR; needs Billy's
  go-ahead; do not fall back to the API `/health` commitSha for the web deployment
  (false correlation) and do not silently drop `require_sha_correlation` (Lane 5 §c).
- **F2 — `tests/playwright/beta-readiness.spec.ts`:** confirm where it lives (not on main
  at that path) or remove the citation (Lane 4 §9(5)).
- **F3 — #918 thread 4 engineering pass:** `onMutate`-captured baseline context through
  the 5 mutation sites in `builder.tsx` (if Billy authorizes it under B3).
- **F4 — #924 / #937 / #945 staging + four-width acceptance** once their review gates
  clear (independent review dispositions outstanding on all three).

## 10. PR queue state at package time

Zero merges this mission (Lane 7). Seven open PRs (verified live 2026-11-08 ~23:00 EST
by Lane 7, plus #947 from Lane 5):

| PR | Draft | Head | 4 required checks | Unresolved threads | reviewDecision | State |
|---|---|---|---|---|---|---|
| #775 Costbook previews | no | `8391e4e1` | 4/4 pass | 1/1 (`web/vercel.json:7`, Major, staging-only Preview bindings attestation) | (empty) | BLOCKED — B4 |
| #918 motion | yes | `516b17c6` (repair commit, Lane 7) | 4/4 pass (run 42559601659 / 42559601559) | 2/23 (builder.tsx thread 4; price-delta.ts:106 thread 7) | CHANGES_REQUESTED (CodeRabbit 5819226509, 2026-11-08 19:08:43Z) | BLOCKED — B3; §19 re-run owed on new head |
| #921 beta acceptance | no | `a1d78cb1` | 4/4 pass | 0/10 | (empty) | HOLD (body) — four-width acceptance not run; B2 + B5 |
| #924 Resend templates | yes | `73c682b4` | 4/4 pass | 0/0 | (empty) | Draft — independent review + B6 staging acceptance |
| #937 offline acceptance | yes | `5bfa1095` | 4/4 pass | 0/0 | (empty) | Draft — independent review + staging/four-width acceptance |
| #945 Codes & Permits | yes | `26d4ab1f` | 4/4 pass | 0/4 | (empty) | Draft — independent review + browser evidence |
| #947 auth diagnostics (Lane 5) | yes | `17ff4db6` | 4/4 pass | 0 | (empty) | Draft — R2 implementation; end-to-end proof owed (blocker 4) |

All six pre-existing PRs are current with main (0 behind). All PR bodies contain the
repo's 10 exact `##` sections; no PR body contains an ADR-009 record (Lane 7). No
ADR-009 record is appended by this package — none is authorized.

## 11. Corrections applied between lanes (carried in this package)

1. **Login-failure capture (Lane 4 §2d(3) corrected by Lane 5 §a):** Lane 4 wrote the
   capture "evidently produced nothing". In fact **main's `auth-setup.mjs` never had the
   capture** — the screenshot/text capture exists only on the motion branch (64fd00ff,
   #918). Nothing failed to run; there was nothing to run. This package carries the
   corrected version; the fix is PR #947 (R2).
2. **Film-wait description (Lane 4 §2d(2) corrected by Lane 5 §a):** the 30 s film wait
   is motion-branch-only; main's script fills immediately with no film wait. This does
   not change the conclusion (a film failure would surface at fill/click, not at
   `waitForURL`).
3. **#918 thread state (brief corrected by Lane 2 D1 / Lane 7):** the brief's "#918:
   15/15 threads resolved, reviewDecision empty" was STALE. Live state was 7 unresolved
   threads + a new standing CodeRabbit CHANGES_REQUESTED (review 5819226509, 2026-11-08
   19:08:43Z). After Lane 7's repair commit `516b17c6`, 5 threads auto-resolved; 2 remain
   (threads 4 and 7) and reviewDecision is still CHANGES_REQUESTED. This package carries
   the post-repair state.
4. **`gh` `workflow` scope (Lane 2 D5):** earlier notes recorded the token as lacking
   `workflow` scope; `gh auth status` on 2026-11-08 ~22:45 EST lists
   `gist, read:org, repo, workflow` — scope is present now. Recorded as observed.
5. **#918 §19 evidence vs. new head:** §19 (run 42514622727) is current for head
   `ae1cca22` only; it does not cover the repair head `516b17c6`. A re-run is owed
   (Lane 7; §0 blocker 5).
6. **S027 "36 captures" / beta-readiness spec:** carried as UNVERIFIED / NOT FOUND
   (§3), not as current evidence (Lane 4 §7).

## 12. What remains for a future run to re-verify

1. Canonical full beta run after B1 (+ B2 for s052/s053/beta_pdf): per-step results,
   28 screenshots across 390/768/1024/1440, tenant-isolation probes, and the R2
   diagnostics on any failure.
2. s052 full run (after blockers 2–3): owner/admin persistence, inactive denial,
   cross-tenant 403/404 denial, responsive evidence at 1440/768/390, exact-SHA correlation.
3. s053 full run (after blockers 2–3): review-first Athena flow, foreign-estimate denial.
4. beta_pdf full run (after blockers 2–3 + foreign-owner fixtures).
5. §19 re-run on #918 head `516b17c6`.
6. G1–G10 interactive gaps via parent browser tasks (Lane 3 §d).
7. Web deployment SHA by direct probe (currently UNVERIFIED, §6) — pending the F1
   build-info endpoint or a Vercel-side confirmation.
8. Validity of the present secret *values* (e.g. `TEST_STAGING_PASSWORD` /
   `BETA_RC_SMOKE_PASSWORD`) — names only were verified; values were never inspected.
9. The clipped edge-docked control's origin (C4).

## Sources

- Lane 1 (browser): `lane-1-browser/report.md` — READY; CA re-sync; smoke test passed.
- Lane 2 (prereqs): `lane-2-prereqs/report.md` — heads, per-PR bar, migrations 71/71,
  deployments, secrets by name, protected ops P1–P8.
- Lane 3 (acceptance): `lane-3-acceptance/report.md` — canonical full run 42558228523
  FAILED at auth; spec-coverage map; G1–G10; repair candidates R1–R4.
- Lane 4 (widths): `lane-4-widths/report.md` — §19 verified current; staging matrix
  empty; SHA-correlation blockers; staleness notes.
- Lane 5 (repairs): `lane-5-repairs/report.md` — R1 diagnosis + Billy decision request;
  R2 draft PR #947; R3 SHA findings; R4 Billy-only.
- Lane 7 (queue): `lane-7-queue/report.md` — zero merges; #918 repair commit `516b17c6`,
  2 threads left, CHANGES_REQUESTED standing; other PRs' blockers.
- In-repo: `docs/testing/BETA_EVIDENCE.md`; `docs/architecture/S052_CUSTOMER_PROJECT_CERTIFICATION_PLAN.md`;
  `.github/workflows/beta-evidence.yml`; `.github/workflows/playwright-agent-evidence.yml`.

---
*Package assembled by Lane 6, 2026-11-08. No evidence was fabricated; no unexecuted test
is classified as passing; no secret values are recorded here (secret names only).*
