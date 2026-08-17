---
status: current
owner: platform
last_verified: 2026-08-17
source_of_truth: false
related_code:
  - web/src/app
  - web/proxy.ts
  - web/src/lib/envSecurity.test.ts
  - web/scripts/preview-smoke-check.mjs
  - web/.env.example
  - app/vercel.json
  - web/vercel.json
  - docs/DEPLOYMENT_GUIDE.md
---

# Web Preview Deployment QA Checklist

Use this checklist for pull-request deployments of the `web/` frontend. The
frontend already exists as the separate Vercel project
`tradeos-costbook-web`; do not create or reconnect a project as part of this
check. The backend remains the separate `tradeos-costbook` project.

As of 2026-08-17, Preview deployments on both projects are isolated from
Production by design and by live verification (signup, email confirmation,
login, an authenticated API round trip, and a Storage upload/retrieve/delete
cycle all confirmed against staging only — see "Environment identification"
and "Production safety" below). This is the current operational state, not
a one-time result; re-verify it whenever Preview environment variables
change.

## 0. Environment identification

Before testing any specific feature, confirm which environment you are
actually looking at. Never assume — check.

- **Git branch**: the deployment's `githubCommitRef` must be the exact PR
  branch under review (or, for backend-only checks, `staging` — the
  dedicated branch that exists solely to give `tradeos-costbook` a stable
  Preview branch-alias URL for use as the shared staging backend).
- **Vercel deployment**: confirm `target` is `Preview` (never `production`),
  and the deployment state is `READY`.
- **Supabase project ref**: Preview must resolve to TradeOS Staging,
  `qfbgdkbamfaasmtjfyru` — never `kssaceuetdjwfqnbzhly` (Production,
  `404TradeOScostbook`). You cannot see this ref from the browser (the app
  has no client-side Supabase usage — auth and storage both go through
  server actions and middleware, so `NEXT_PUBLIC_*` values are never
  inlined into a client JS bundle). Confirm it instead by: reading the
  actual Supabase Auth confirmation email link's host (see "Authentication"
  below), or reading Vercel's Preview-scoped `NEXT_PUBLIC_SUPABASE_URL` in
  the dashboard.
- **Backend origin**: Preview's `BACKEND_API_URL` must resolve to
  `https://tradeos-costbook-git-staging-billykshowalters.vercel.app`, never
  `https://api.404tradeos.com`.

## 1. Deployment identity and safety

Before testing:

- Confirm the deployment belongs to `tradeos-costbook-web`, has target
  `Preview`, and was built from the exact pull-request head under review.
- Confirm the deployment is READY and its build log contains no ignored
  TypeScript, lint, or framework errors.
- Check that Preview-scoped values exist for the variables documented in
  `web/.env.example`. Never copy secret values into an issue, pull request,
  terminal transcript, or browser screenshot.
- Treat `NEXT_PUBLIC_*` values as browser-visible. Keep
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET_PUBLIC`, and
  `BACKEND_API_URL` server-only.
- Ensure the Supabase URL and service-role key belong to the same Supabase
  project. A mismatched pair can make privileged Storage operations target
  the wrong project.
- Confirm `BACKEND_API_URL` is a deployed backend origin. Its source default,
  `http://localhost:4000`, is only valid for local development.
- Preview must use isolated staging data and credentials — TradeOS Staging
  Supabase and the staging backend, never Production. This is a decided
  architecture, not a case-by-case judgment call; if you find Preview
  pointed at Production dependencies, that is a defect to report and fix,
  not a coupling to work around.

Repository source and an unauthenticated HTTP response cannot prove the value
of a server-only Vercel variable. Verify those settings in Vercel and confirm
behavior through server-side routes; do not infer correctness because a build
completed.

## 2. Automated checks

Run the frontend source checks from the repository root:

```bash
npm --prefix web test
npm --prefix web run lint -- .
npm --prefix web run build
```

Run the dependency-free HTTP smoke check against the exact Preview URL:

```bash
node web/scripts/preview-smoke-check.mjs https://<preview-url>
```

If a hostname or Supabase project ref must not appear in browser-visible
responses, add a repeatable `--forbid-host` flag:

```bash
node web/scripts/preview-smoke-check.mjs https://<preview-url> \
  --forbid-host=<forbidden-host-or-project-ref>
```

The smoke script checks public pages, unauthenticated protected-route
redirects, 404 handling, response headers, and common secret-leak patterns.
It does not authenticate, inspect the browser console, prove the server-only
backend target, or replace the manual checks below.

If Vercel Deployment Protection returns 401 before the application runs,
perform the smoke check from an approved browser session or use the team's
approved automation-bypass mechanism. Do not disable protection merely to
make this script pass. (As of 2026-08-17, Vercel Authentication is disabled
for Preview deployments on both projects — see
`docs/DEPLOYMENT_GUIDE.md`'s "Environment architecture" section for why —
so this should not normally trigger.)

## 3. Unauthenticated routes

In a private browser session, verify:

| Route | Expected result |
|---|---|
| `/` | Redirects to `/login` without an authenticated session |
| `/login` | Renders with status 200; an invalid login shows a safe inline error |
| `/signup` | Renders with status 200; do not create production data without approval |
| `/dashboard` | Redirects to `/login` |
| `/customers` | Redirects to `/login` |
| `/projects` | Redirects to `/login` |
| `/dispatch` | Redirects to `/login` |
| `/settings` | Redirects to `/login` through the authenticated app layout |
| `/brand-studio` | Redirects to `/login` through the authenticated app layout |
| `/portal/projects/<nonexistent-id>` | Redirects to `/login` |
| `/this-route-does-not-exist-preview-smoke-check` | Returns a real 404 |
| `/api/proxy/<any-path>` | Returns `401 {"error":"Not authenticated"}` before reaching the backend |
| `/api/documents/<any-path>` | Returns `401` the same way |

Inspect page source, response headers, and browser-loaded JavaScript. They
must not contain service-role credentials, database connection strings,
provisioning secrets, or a `NEXT_PUBLIC_*SERVICE_ROLE*` variable name.

## 4. Authentication

Use a dedicated, disposable test account — a `mailinator.com` address works
well since its inbox is publicly readable, letting you retrieve the real
confirmation email without any mail server access. (`example.com` and
similar reserved domains are rejected by Supabase Auth as invalid; use a
real, checkable disposable domain instead.)

- **Signup**: submit `/signup`. Confirm the app's response ("check your
  email") rather than assuming success from a 200 status.
- **Email confirmation**: retrieve the confirmation email and read the
  actual verification link before clicking it — its host
  (`https://qfbgdkbamfaasmtjfyru.supabase.co/auth/v1/verify?...`) is the
  single most reliable way to prove which Supabase project this deployment
  is really using, since it comes directly from Supabase, not from
  anything the app could misreport. Click it and confirm it lands back on
  the Preview deployment, not Production.
- **Login**: sign in with the confirmed account. Confirm it lands on
  `/dashboard` and the dashboard renders your test organization's name.
- **Session persistence**: reload the dashboard and navigate between
  authenticated routes; the session must not drop.
- **Logout**: confirm it returns you to `/login` and that `/dashboard`
  immediately redirects to `/login` again afterward (no lingering session).

## 5. Backend

Hit the backend staging URL directly (not through the frontend proxy):

- `GET /health` → `200`, dependency-free liveness check.
- `GET /ready` → `200` with `checks.database.status: "ok"`. A `503` here
  with `"Can't reach database server"` most often means `DATABASE_URL` is
  pointed at Supabase's direct-connection host
  (`db.<ref>.supabase.co:5432`), which is IPv6-only on this project tier
  and unreachable from Vercel's serverless runtime — it must use the
  Supavisor transaction-mode pooler instead
  (`aws-0-us-east-2.pooler.supabase.com:6543`, username
  `tradeos_app.<project-ref>`, `?pgbouncer=true`).
- One authenticated request (e.g. the frontend's own post-login calls to
  `/api/v1/settings`, `/api/v1/projects`) → `200`, correctly scoped to the
  test account's organization.

## 6. Database

- Migrations: staging's `_prisma_migrations` row count must match the
  number of folders in `app/prisma/migrations/`, with zero
  unfinished/rolled-back rows.
- RLS: every application table (i.e. excluding `_prisma_migrations`) must
  have both `rowsecurity` and `relforcerowsecurity` set.
- Tenant isolation: as the `tradeos_app` role (never the Supabase
  `postgres` admin role), confirm a session scoped to one `org_id` cannot
  see another org's rows, and that a write attempted without the required
  `current_app_can_write()`/`current_app_can_administer()` role is silently
  filtered (0 rows affected), not merely blocked by an application-level
  check that RLS would otherwise allow through.

## 7. Storage

- **Upload**: use a disposable passive raster image no larger than 6 MB
  (e.g. Brand Studio's logo upload). Confirm success in the UI.
- **Retrieve**: confirm the uploaded asset renders/downloads correctly
  through the app's authenticated proxy route
  (`/api/brand-assets/<orgId>/<assetKey>`) — never a raw Supabase Storage
  URL, since the bucket is private and access is enforced entirely at the
  application layer (Storage itself carries no RLS policies by design; see
  `app/prisma/migrations/20260728120000_add_settings_asset_uploads/migration.sql`).
- **Unauthorized access**: the same asset URL, requested with no session
  cookie, must return `401`.
- **Delete**: use the UI's own removal control, then confirm the
  underlying storage object is actually gone (not just hidden in the UI).
- Confirm the bucket in use is TradeOS Staging's `project-files` — same
  name as Production's bucket, but a separate bucket on a separate
  Supabase project. A bucket-name match is not proof of project isolation.

## 8. Browser and responsive checks

Check representative public and authenticated routes at:

| Width | Height | Label |
|---:|---:|---|
| 1440 | 1000 | Desktop |
| 1024 | 768 | Laptop/tablet |
| 390 | 844 | Mobile |

At each size:

- confirm `document.documentElement.scrollWidth` does not exceed
  `document.documentElement.clientWidth`;
- inspect the console for uncaught exceptions, hydration errors, and new
  warnings;
- inspect failed requests and confirm expected redirects rather than raw 500
  responses;
- check keyboard focus, labels, error messages, and visible loading states;
- verify navigation and action controls do not point to missing routes.

## 9. Production safety

Preview must never reach Production. Confirm, for the full duration of
testing:

- No request — client-side (browser network tab) or server-side (Vercel
  runtime logs for both projects) — targets `api.404tradeos.com`.
- No request targets `kssaceuetdjwfqnbzhly.supabase.co` (Production's
  Supabase project ref) in any form: REST calls, Storage calls, or the
  Auth confirmation email's link host.
- Production's own health stays green throughout: `https://app.404tradeos.com/`
  returns 200, and `https://api.404tradeos.com/health` returns
  `{"status":"ok"}`. Check both before and after your test session — a
  clean check afterward is what proves your testing didn't have a side
  effect, not just that Production happened to be up.
- Clean up disposable test data when you're done: delete the test
  organization, its Supabase auth user, and any uploaded Storage objects
  from TradeOS Staging. Do not leave permanent fake business data in
  staging.

## 10. Pass criteria

A Preview is ready for merge only when:

- its source SHA matches the reviewed pull-request head;
- required GitHub checks and the Vercel deployment are successful;
- the automated source checks and HTTP smoke check pass;
- environment ownership and server/client boundaries are confirmed without
  exposing values;
- the representative authenticated and responsive checks have no new
  blocking regressions;
- Production safety (§9) holds for the entire session; and
- every intentional limitation is recorded in the pull request rather than
  silently treated as a passing result.
