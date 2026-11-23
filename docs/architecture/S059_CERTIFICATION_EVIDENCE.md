---
status: pending-dispatch
owner: platform
last_verified: 2026-11-23
source_of_truth: false
related_docs:
  - docs/architecture/S059_CUSTOMER_PORTAL_ACCESS_CERTIFICATION_PLAN.md
  - docs/testing/S059_CUSTOMER_PORTAL_EVIDENCE.md
  - docs/testing/BETA_EVIDENCE.md
  - docs/architecture/S073_RLS_COVERAGE_EVIDENCE.md
  - docs/decisions/ADR-010-customer-magic-link-portal.md
related_code:
  - app/modules/customer-portal/service.ts
  - app/backend/controllers/customerPortal.controller.ts
  - app/backend/routes/customerPortal.routes.ts
  - app/backend/middleware/customerPortal.ts
  - app/tests/s059.portal.integration.ts
  - app/scripts/s059-browser-evidence.mjs
  - .github/workflows/s059-browser-evidence.yml
---

# S059 — Customer Portal Access and Session Certification Evidence

Status: **PENDING DISPATCH**. The evidence tooling is built and unit-tested
on current `main`; no authenticated browser run has been dispatched yet, so
nothing in this document certifies a deployment. Do not cite it as
certification until a `s059-browser-evidence` run passes and its run id,
SHAs, and artifact are recorded in §7.

## 1. What this certifies

The existing ADR-010 magic-link customer portal on current `main`
(`76b8da0a`): staff issuance, single-use access redemption, customer-scoped
session, revocation, expiry, replay denial, and cross-tenant isolation.
Certification means retained authenticated browser evidence plus negative
security evidence plus current-head live-PostgreSQL evidence for the portal
identity rows. It is proof work over an implemented contract, not a new
customer identity or authorization model.

## 2. Staging vs main — read before dispatching

The field-closeout staging candidate is `7c428acd`; current `main` is
`76b8da0a`. The portal-surface diff between them is exactly two files
(verified 2026-11-23 with
`git diff origin/main origin/staging -- app/modules/customer-portal/
app/backend/...customerPortal* web/src/app/customer-portal/ ...`):

| File | Main-only change | Effect on certification |
| --- | --- | --- |
| `app/modules/customer-portal/service.ts` | PR #937 (`e181df9e`): `redactInternalProposalEvidence` — staff-only offline-acceptance metadata is redacted from portal proposal responses | Presentation redaction only; token/session/redeem/sign mechanics identical |
| `app/backend/middleware/customerPortal.ts` | PR #1001 (`6f860f34`): session-hash scoping — the middleware computes `hashPortalSecret(token)` and passes the session hash into `runWithPortalDatabaseSession` | **Security-relevant**: portal requests on main are scoped by the exact session hash; staging `7c428acd` does not have this scoping |

Consequences:

- A browser run dispatched against staging `7c428acd` certifies the
  staging portal surface, **not** main's #1001 session-hash scoping.
- The #1001 scoping is proven on main only by the live-PostgreSQL
  integration tests (§6), which drive `runWithPortalDatabaseSession` with
  the session hash exactly as main's middleware does.
- A browser run against a staging head that includes #1001 is still owed
  before main's portal surface can be called browser-certified. Record the
  dispatched SHA in §7 and do not conflate the two heads.

## 3. Certification step list

Bearer material: no raw access token, portal session, cookie, header, or
bearer value is retained in any evidence artifact. Evidence locations:
**BROWSER** = authenticated non-production browser capture at
1440/1024/768/390 (`s059-browser-evidence` run); **LIVE-DB** = disposable
PostgreSQL integration evidence (`app/tests/s059.portal.integration.ts`,
plus the S073 RLS tests where noted); **UNIT** = current-head test named.
Browser evidence is PENDING DISPATCH for every step below; the UNIT and
LIVE-DB columns record what is already proven on current `main`.

### Phase A — staff issuance

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| A1 | `POST /api/v1/customer-portal/access-tokens` via `CustomerPortalLink` → `issueAccessToken` | Staff with `documents.manage` | 201; one-time link + `expiresAt` shown for copy; SHA-256 digest only persisted | Staff org + customer | BROWSER (staff issue + copy UI) + UNIT `customer-portal.service.test.ts` delivery/journal tests |
| A2 | Same route/service | Staff with `documents.manage` | 409, customer must have an email; no token created | Staff org + customer | BROWSER (API probe) + LIVE-DB `s059.portal.integration.ts` "A2/A3" |
| A3 | Same route/service | Staff with `documents.manage` | 404, customer not found (incl. other-org customer); no token created | Staff org | BROWSER (API probe) + LIVE-DB `s059.portal.integration.ts` "A2/A3" |
| A4 | `ctrl.issue` `requirePermissions` | Staff without `documents.manage` | 403; no token created | Staff org | BROWSER (API probe) if a low-permission identity is provisioned, else NOT-APPLICABLE with reason — no such identity is provisioned today; no current-head test (policy text + RBAC doc only) |
| A5 | `requireAuth` | Unauthenticated | 401; no token created | — | BROWSER (API probe); no current-head test |
| A6 | Issue response handling | Staff browser | Raw token appears only in the staff copy UI for this issuance; never in logs, artifacts, or the delivery journal | Staff org | BROWSER (redaction check: link view never screenshotted while visible) + UNIT delivery-journal test |

### Phase B — link handling and redemption

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| B1 | `GET /customer-portal/access?token=…` (`access/route.ts`) | Unauthenticated customer | 303 to `/access/confirm`; pending HttpOnly cookie set (10 min); token NOT redeemed | — | BROWSER (same token redeems right after the GET) + UNIT `customer-portal-access.test.ts` pending-token test |
| B2 | Same route, absent/malformed token | Unauthenticated | 303 to `/access-error`; pending cookie cleared | — | BROWSER (access-error capture) + UNIT pending-token validation test |
| B3 | `GET /customer-portal/access/confirm` | Unauthenticated customer | Renders "Open your project documents" + POST form; no bearer value in DOM; missing/invalid pending cookie → access-error | — | BROWSER + UNIT confirm-page test |
| B4 | `POST /customer-portal/access/redeem` → `POST /api/v1/customer-portal/redeem` → `redeemAccessToken` | Unauthenticated customer (exact-origin POST) | 303 to `/customer-portal`; HttpOnly session cookie (`sameSite: lax`, `maxAge` = remaining 12 h); pending cookie cleared | Token's org+customer | BROWSER (flags checked in memory only) + UNIT atomic-consume test |
| B5 | Replay — repeat B4 with the same link | Unauthenticated customer | Backend 410 → access-error; no session cookie; no second session row | Token's org+customer | BROWSER (access-error + API 410) + LIVE-DB `s059.portal.integration.ts` "B5" + UNIT CAS race test |
| B6 | Expired link — B4 with a token whose `expiresAt` is past | Unauthenticated customer | Backend 410 → access-error; no session cookie | Token's org+customer | **BROWSER BLOCKED** — see §5. LIVE-DB `s059.portal.integration.ts` "B6" is the substitute; UNIT mocked expiry path |
| B7 | Revoked link — B4 with a token revoked via E1 | Unauthenticated customer | Backend 410 → access-error; no session cookie | Token's org+customer | BROWSER (access-error + API 410) + LIVE-DB `s059.portal.integration.ts` "B7" + UNIT mocked path |
| B8 | Cross-origin redeem POST — `shouldRejectProxyMutation` | Unauthenticated, foreign origin | 403 "Cross-origin portal redemption is not allowed"; no redemption attempted | — | BROWSER (forged-Origin probe, 403) + UNIT source-text test |
| B9 | Malformed redemption — backend regex / Zod `token` 40–128 | Unauthenticated | 401 "Invalid access token" (short / bad charset); unknown well-formed token 410; no DB query for a malformed hash | — | BROWSER (API probe: short → 400/401, unknown → 410) + UNIT regex-gate test |

### Phase C — portal reads (customer session)

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| C1 | `GET /api/v1/customer-portal/session` | Customer session | 200 `{sessionId, customerId, orgId}`; `lastSeenAt` touched, `expiresAt` unchanged | Own org+customer | BROWSER (API probe, booleans only) + LIVE-DB `s059.portal.integration.ts` "C1/C2" |
| C2 | `GET /api/v1/customer-portal/projects` → `listProjects` | Customer session | 200, only own org+customer projects | Own org+customer | BROWSER (portal home + API probe) + LIVE-DB "C1/C2" |
| C3 | `GET /projects/:id` → `getProject` | Customer session | 200; proposals/invoices exclude drafts; contracts included; internal proposal-acceptance metadata redacted | Own org+customer | BROWSER + UNIT redaction test + LIVE-DB `rls.integration.ts` portal reads |
| C4 | Same route, foreign project (same org, other customer) | Customer session (foreign customer) | 404 "Project … not found" | Same org, cross-customer | BROWSER (API 404 + access-required page) + LIVE-DB `s059.portal.integration.ts` "C4/C8" + UNIT mocked denial |
| C5 | Same route, cross-org project | Customer session (foreign org) | 404 | Cross-org | BROWSER (API 404 via `BETA_RC_FOREIGN_PROJECT_ID`) + LIVE-DB S073 + `s059.portal.integration.ts` "C4/C8" |
| C6 | `GET /proposals/:id` → `getProposal` | Customer session | 200; `staff_recorded_offline` delivery metadata redacted to `{source}` only | Own org+customer | BROWSER + UNIT redaction test |
| C7 | Same route, draft proposal | Customer session | 404 (detail and PDF) | Own org+customer | BROWSER (API 404s) + UNIT draft-denial tests (mocked) |
| C8 | `GET /proposals/:id`, `/invoices/:id`, `/contracts/:id` (foreign) | Customer session (foreign customer/org) | 404 for each; no PDF bytes | Cross-customer / cross-org | BROWSER (API 404s) + LIVE-DB `s059.portal.integration.ts` "C4/C8" + UNIT denial loop (mocked) |
| C9 | `GET /invoices/:id` | Customer session | 200; server-derived totals/balance; payment history shown; no pay action | Own org+customer | BROWSER + UNIT draft-denial tests |
| C10 | `GET /contracts/:id` | Customer session | 200; status/signature state shown | Own org+customer | BROWSER + UNIT (C8 denial loop covers the assert) |
| C11 | PDF downloads — `GET /proposals/:id/pdf`, `/invoices/:id/pdf`, `/contracts/:id/pdf` | Customer session | 200 PDF for own non-draft docs; 404 for draft/foreign | Own org+customer | BROWSER (proposal PDF: content-type + SHA-256 retained, no bytes; invoice/contract PDF status only) + UNIT draft-PDF tests (mocked) |
| C12 | Unauthenticated portal API call (no session cookie/header) | Unauthenticated | 401 "Customer portal session is required" | — | BROWSER (API 401 + access-required page); no current-head test for the missing-header branch |
| C13 | Wrong-principal — staff JWT on portal routes; portal session on staff routes | Staff JWT / portal session | 401 on portal routes (portal header required; JWT ignored); 401 on staff routes (portal session is not a staff JWT) | — | BROWSER (API probes); no current-head test |
| C14 | Portal home with expired/invalid session | Customer session (expired) | Truthful "Portal access required" empty state | Own org+customer (attempted) | BROWSER; detail pages render the same state — see GAP-1 |

### Phase D — contract signing (the only customer write)

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| D1 | `POST /contracts/:id/sign` → `signContract` → `signAsPortalCustomer` | Customer session | 200 `signed`; `contract.signed` event with `actorUserId = null`, metadata `actorType: "customer_portal"`, `customerId`, `portalSessionId` | Own org+customer, exact contract | BROWSER (sign flow, synthetic signer name; attribution booleans only) + UNIT `contracts.service.test.ts` attribution test (mocked) + LIVE-DB `rls.integration.ts` exact-transition test |
| D2 | Sign already-signed / voided / non-pending contract | Customer session | 409 "cannot be signed from status …" | Own org+customer | LIVE-DB `s059.portal.integration.ts` "D2"; browser capture not run (fixture would consume the pending contract) |
| D3 | Sign foreign contract | Customer session (foreign customer/org) | 404 (assert fails before any write) | Cross-customer / cross-org | LIVE-DB `s059.portal.integration.ts` "C4/C8" (sign-foreign 404) + UNIT denial loop (mocked) |
| D4 | Sign with missing/blank signer name — Zod `signSchema` | Customer session | 400 validation error; no write | Own org+customer | API capture; no current-head test |
| D5 | Sign when customer has no email — `signContract` 409 | Customer session | 409 "Customer email is required to attribute a signature" | Own org+customer | LIVE-DB `s059.portal.integration.ts` "D5"; no other current-head test |
| D6 | Concurrent double-sign | Customer session (×2) | Exactly one succeeds; the other 409 | Own org+customer | LIVE-DB `s059.portal.integration.ts` "D6"; no other current-head test |

### Phase E — revocation and expiry of sessions

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| E1 | Staff revokes token — `POST /access-tokens/:id/revoke` → `revokeAccessToken` (API-only; no staff UI — see GAP-2) | Staff with `documents.manage` | 204; token `revokedAt` set; all sessions redeemed from it `revokedAt` set | Staff org + token | BROWSER (API 204s in the B7/E3 setup) + UNIT mocked revoke test |
| E2 | Revoke unknown / other-org token | Staff with `documents.manage` | 404; nothing revoked | Staff org | API capture; no current-head test |
| E3 | Use session after its token was revoked — `resolveSession` | Customer session (revoked) | 401; portal reads denied; detail page shows access-required state | Token's org+customer | BROWSER (API 401 + access-required page) + LIVE-DB `s059.portal.integration.ts` "E3" + UNIT mocked path |
| E4 | Session expiry — `resolveSession` with `expiresAt` past | Customer session (expired) | 401; portal home shows "Portal access required" | Own org+customer | **BROWSER BLOCKED** — see §5. LIVE-DB `s059.portal.integration.ts` "E4" is the substitute; UNIT mocked expiry path |
| E5 | Customer soft-deleted after issuance — `resolveSession` customer check | Customer session | 401 "Customer portal identity is no longer active" | Own org+customer | LIVE-DB `s059.portal.integration.ts` "E5"; no other current-head test |
| E6 | Customer hard-deleted — FK cascade | (DB) | Token + session rows cascade-deleted; further redeem/resolve fails 410/401 | Own org+customer | LIVE-DB capture (migration FK `on delete cascade`); no test exercises the cascade |
| E7 | Revoke race — session touched concurrently with revocation | Customer session | 401 "revoked" when the touch CAS loses | Own org+customer | UNIT CAS touch-race test (mocked) |

### Phase F — live PostgreSQL / RLS evidence (re-verify on the exact head)

| # | Evidence | Expected | Evidence |
| --- | --- | --- | --- |
| F1 | `app/tests/s073.rls.integration.ts` "limits portal identity reads to the exact token or session credential" | Exact hash → only its row; wrong hash → no rows | LIVE-DB (S073, re-verify on current head via CI) |
| F2 | Same file, "keeps portal session context scoped to its customer and organization" + sibling exclusion | Only the validated session visible | LIVE-DB (S073) |
| F3 | `app/tests/customer-portal-session-context.rls.integration.ts` | Exact session hash → only that session; no hash → no rows | LIVE-DB |
| F4 | `app/tests/rls.integration.ts` portal resource isolation | Same-org project/customer visible, cross-org hidden; portal session sees only its customer's project/customer | LIVE-DB |
| F5 | Same file, exact pending-contract transition | Wrong `app.portal_contract_id` → 0 rows updated; exact id → 1 row, event + activity with `actorUserId = null` | LIVE-DB |
| F6 | `app/tests/customer-portal.migration.test.ts` | Hashed secrets only, forced RLS on both tables, redeem/revoke policies, narrow sign policy, staff roles for issue, rate limit on both staff routes | UNIT (source-text assertions) |
| F7 | `app/tests/customer-portal.middleware.test.ts` | Only the validated session digest reaches the DB transaction; raw token never stored on the request object | UNIT (mocked) |

## 4. Exclusions

- **Email delivery of issued links** — S074 owns durable delivery. Issuance
  returns the link for the delivery layer; the delivery side effect is
  unit-tested (delivery/journal tests; `email.service.test.ts` link
  template), but end-to-end delivery is out of scope.
- **Customer proposal acceptance** — S019 owns the authenticated boundary.
  Portal proposal review is read-only (no accept/decline mutation exists in
  the portal). The browser run's fixture setup uses the shipped *staff*
  accept endpoint to create an accepted proposal so a pending contract can
  exist for the signing step; that is fixture setup, not acceptance
  certification, and the run report records it as such.
- **Customer payments / Pay Now** — no such capability exists in the portal
  (no Stripe/payment code path in the portal).
- **Staff `/portal/*` preview** — a separate staff-session surface, not part
  of ADR-010 certification.

## 5. Bearer-material handling rules

1. Tokens exist only in process memory. They are never written to disk,
   logs, `report.json`, screenshots, traces, videos, HAR files, or CI logs.
2. Staff and customer browser contexts never share storage state. Portal
   contexts are created with no storage state, and `storageState()` is never
   called on one. Trace, video, and HAR are OFF for every context.
3. Screenshots start only after the clean `/customer-portal/access/confirm`
   URL loads. The staff link-display view is never screenshotted while the
   link is visible. The browser capture omits URL-bearing history and
   pending-cookie values.
4. The session cookie's flags are checked in memory only (redeem-response
   `set-cookie` header first, cookie jar as fallback); its value is never
   stored or logged. The HttpOnly session cookie is not browser-readable and
   must not be read or retained for the credential scan.
5. One portal context per customer; the viewport is resized between captures
   instead of re-redeeming per viewport, so the session cookie is never
   copied between contexts and the run stays inside the backend's
   20-requests-per-15-minutes redeem/issue/revoke rate limit (planned total:
   16, counted by the script; a 429 fails the run closed).
6. PDFs are proven by status + `Content-Type: application/pdf` + SHA-256
   hash only; no PDF bytes are retained.
7. For each denial, only the case label, HTTP status, and redacted outcome
   are recorded. The workflow's credential scan (S027/Beta grep plus the
   portal cookie names, `x-tradeos-portal-session`, and the raw-token query
   pattern `token=[A-Za-z0-9_-]{40,128}`) runs over the bundle
   before upload; a hit fails the run and blocks upload.
8. Error text is redacted before it is logged or recorded: Playwright
   navigation errors embed the full request URL, so a failed `goto` of a
   magic-link URL would otherwise leak the raw token into the workflow log
   and `report.json`. The capture script passes every recorded/logged error
   through `redactBearerMaterial` (contract module, unit-tested), and a fatal
   failure records a sanitized `FATAL` case instead of skipping the report.
9. Cleanup revokes every token the run created (by id). One exception is
   structural: the staff UI returns the link and expiry but not the token
   id, so a UI-issued token cannot be revoked by id. The capture script
   spends it by redeeming it (a redeemed token can never redeem again), its
   session cookie lives only in the closed portal context, and its 7-day TTL
   bounds it; the run report records this residual explicitly. Prefer the
   API issuance path when revocation-by-id is required.

## 6. Gaps

- **GAP-1 (repaired in this worktree, browser proof pending):** portal
  detail pages used to let a portal fetch failure escape as an uncaught
  throw, surfacing Next.js's generic error page instead of the truthful
  "Portal access required" state. All four detail pages now wrap their
  fetches in try/catch and render the same access-required state as the
  portal home page, with a vm-render test
  (`web/src/app/customer-portal/customer-portal-detail-access.test.ts`).
  The browser run's GAP-1 case (revoke the session, reload a detail page,
  expect the access-required state) proves the repaired behavior live.
- **GAP-2 (open, by design):** staff revocation has no web UI — no
  `revokeCustomerPortal*` function exists in `web/src/lib/api.ts` and no
  component calls the revoke endpoint. Revocation is API-only. The browser
  run therefore proves revocation as API + browser session-invalidation
  capture. A staff revoke control is a separate small UI change, not
  required for certification.
- **GAP-3 (note):** `GET /api/v1/customer-portal/session` is a dead surface
  in the web app (no caller in `web/src/**`). The run exercises it directly
  (step C1) rather than treating it as unused.
- **GAP-4 (by design):** the pending-access cookie lives 10 minutes. A
  customer who waits longer on the confirm page must re-open the emailed
  link. Fail-closed by design; do not misread it as an expired-link
  failure.
- **GAP-5 (coverage):** no HTTP-level test exercises the portal Express
  surface through a live server; controller behavior (Zod parsing,
  `requirePermissions`, `requireAuth`, the missing-header branch of
  `requireCustomerPortalSession`, status mapping) is proven by the browser
  run's API probes plus the live-DB integration tests, not by supertest.

## 7. Expiry-browser blocker (B6/E4)

True expired-token / expired-session browser states cannot be produced
against a hosted deployment: the only token-creation path is the issue
endpoint, which always sets `expiresAt = now + 7d`, and direct staging-DB
writes need staging-DB write access, which this runner does not have.
Playwright clock manipulation does not help — `redeemAccessToken` /
`resolveSession` compare `expiresAt > now` server-side. Waiting out the
real TTLs (7 days / 12 hours) is not viable inside a sprint run. No TTL
override or test-only backdoor was added, and none should be: the TTLs are
plain `Date` arithmetic on `expiresAt` columns, so the fixture is a
data-layer row, not a code change.

- **Missing infrastructure:** staging-DB write access (or a
  Billy-provisioned expired fixture) for the hosted browser run.
- **Owner:** Billy.
- **Substitute (live-PostgreSQL):** `app/tests/s059.portal.integration.ts`
  seeds genuinely expired rows in the disposable database and drives the
  real, unmodified `redeemAccessToken` / `resolveSession` paths: B6
  (expired token → 410, no session created, token stays unredeemed) and E4
  (expired session → 401). The capture script records B6/E4 as BLOCKED with
  this reason and its exit code is unaffected by them.

## 8. Run record (fill in on dispatch)

| Field | Value |
| --- | --- |
| Workflow run | _pending_ |
| Workflow head SHA | _pending_ |
| Deployed SHA (Vercel + `/health`) | _pending_ |
| Target base URL | _pending_ |
| Data-plane project ref (`/ready`) | _pending_ |
| Smoke tenant (label / org id) | _pending_ |
| Artifact (`s059-browser-evidence`, 30 days) | _pending_ |
| Credential scan | _pending_ |
| Result | PENDING DISPATCH |

Dispatch (do not run from this document — the parent agent dispatches after
this PR merges, because GitHub only accepts a `workflow_dispatch` for a
workflow that exists on the default branch; verified 2026-11-23: both
`gh workflow run --ref feat/s059-portal-certification` and the dispatch API
returned 404 while the file existed only on the branch):

```text
gh workflow run s059-browser-evidence.yml \
  --ref main \
  -f base_url=https://<approved-preview>.vercel.app \
  -f expected_sha=<full 40-char deployed SHA> \
  -f smoke_org_id=<TEST Org or Beta Smoke UUID> \
  -f sanitized_tenant=true -f use_test_org=true \
  -f require_sha_correlation=true
```

Record the run id, workflow head SHA, deployed SHA, and artifact in the
table above in a follow-up PR. The implementation PR merges on the merge
bar before the browser run exists; S059 stays `IN_REVIEW` until the
browser evidence (or its named blocker) is recorded.

Preflight first (recommended): dispatch the Beta Evidence workflow in
`preflight` mode for the same target to prove the smoke identity + data
plane resolve before spending the S059 run.
