---
status: current
owner: platform
last_verified: 2026-08-04
source_of_truth: false
related_code:
  - web/src/app
  - web/proxy.ts
  - web/src/lib/envSecurity.test.ts
  - web/scripts/preview-smoke-check.mjs
  - web/.env.example
  - docs/DEPLOYMENT_GUIDE.md
---

# Web Preview Deployment QA Checklist

Use this checklist for pull-request deployments of the `web/` frontend. The
frontend already exists as the separate Vercel project
`tradeos-costbook-web`; do not create or reconnect a project as part of this
check. The backend remains the separate `tradeos-costbook` project.

On 2026-08-04, Vercel reported READY Preview and production deployments for
the frontend, including a READY production deployment from `main` commit
`2d80214a`. This is evidence that the projects and deployment pipeline exist,
not evidence that every environment value or authenticated product flow is
correct for a later deployment.

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
- Prefer isolated Preview data and credentials. If Preview intentionally uses
  production dependencies, restrict testing to non-destructive reads and
  obtain explicit approval before any write-path test.

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
make this script pass.

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

Inspect page source, response headers, and browser-loaded JavaScript. They
must not contain service-role credentials, database connection strings,
provisioning secrets, or a `NEXT_PUBLIC_*SERVICE_ROLE*` variable name.

## 4. Authenticated product smoke

Use a dedicated test account and non-production records whenever possible.
At minimum verify:

- login and logout, including immediate denial after logout;
- dashboard render and navigation;
- customer and project list/detail views;
- Dispatcher render and its current scope label;
- Settings and Brand Studio render;
- a permitted Brand Studio image upload, reload, authenticated asset fetch,
  and removal, using a disposable passive raster image no larger than 6 MB;
- denial of the same privileged upload for a user without the required
  organization permission;
- one representative proposal, contract, invoice, and customer-portal view;
- a same-origin `/api/proxy/*` request reaches the intended backend and does
  not expose its bearer token or backend origin to browser JavaScript.

Do not alter real customer, billing, migration, access-control, or production
configuration data during a Preview check.

## 5. Browser and responsive checks

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

## 6. Pass criteria

A Preview is ready for merge only when:

- its source SHA matches the reviewed pull-request head;
- required GitHub checks and the Vercel deployment are successful;
- the automated source checks and HTTP smoke check pass;
- environment ownership and server/client boundaries are confirmed without
  exposing values;
- the representative authenticated and responsive checks have no new
  blocking regressions; and
- every intentional limitation is recorded in the pull request rather than
  silently treated as a passing result.
