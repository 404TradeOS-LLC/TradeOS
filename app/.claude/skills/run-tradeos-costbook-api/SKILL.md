---
name: run-tradeos-costbook-api
description: Build, run, and screenshot the TradeOS Cost Book API and its server-rendered admin UI. Use when asked to start the API, seed sample data, run its tests, build it, take a screenshot of /admin or /admin/pricing-history (including mobile/responsive checks), or otherwise drive the running app.
---

This is an Express/Prisma API with a server-rendered admin UI (no SPA build step). It's driven end-to-end by `.claude/skills/run-tradeos-costbook-api/driver.mjs`, a Node script that provisions a disposable Postgres container, seeds sample data, builds and launches the API in the background, and uses Playwright to log into the admin UI and screenshot it. All paths below are relative to `app/`.

## Prerequisites

- Docker (for the disposable Postgres container — no system package install needed beyond Docker itself).
- Node (whatever this repo already targets; no extra runtime needed).
- A `psql` client on `PATH` — `driver.mjs db` shells out to `scripts/deploy-migrations.sh`/`scripts/provision-app-role.sh`, which need it. On macOS via Homebrew it's keg-only: `brew install libpq` and add `$(brew --prefix libpq)/bin` to `PATH` for the shell you run `driver.mjs` from.

## Setup

```bash
npm install   # playwright is already a devDependency; this also fetches it
npx playwright install chromium   # one-time browser download, ~260MB, cached at ~/Library/Caches/ms-playwright
```

No `.env` is required up front — `driver.mjs serve` writes one for you each run (see Gotchas).

## Build

```bash
npm run build   # tsc -p tsconfig.json — also run automatically by `driver.mjs serve`
```

## Run (agent path)

Use `driver.mjs`. Each subcommand is independently re-runnable; `all` chains them for a one-shot clean run.

```bash
node .claude/skills/run-tradeos-costbook-api/driver.mjs all /admin/pricing-history 390 844
```

This: recreates the disposable `tradeos-costbook-test` Postgres container fresh, applies both migrations, seeds sample org/user/material data, builds and starts the API on port 4000, authenticates into `/admin/pricing-history` with the seeded dev bearer token, and screenshots it at 390x844 (mobile). Swap the trailing args for a different route/viewport, e.g. `/admin/pricing-history 1440 1000` for desktop.

Individual commands, if you don't want a full reset every time:

| command | what it does |
|---|---|
| `driver.mjs db [--fresh]` | Starts/reuses the `tradeos-costbook-test` Postgres container on `127.0.0.1:55432`, then runs `scripts/deploy-migrations.sh` (tracked Prisma migrations + app-role provisioning) — the same automation a real production deploy uses. Reuses an already-running container unless `--fresh` is passed. |
| `driver.mjs seed` | Seeds sample org/user/material/project data via the **admin** Postgres role (required — forced RLS blocks the restricted role from inserting organizations) and writes the dev bearer token to `.dev-token`. |
| `driver.mjs serve` | Writes `.env` pointing at the restricted `tradeos_app` role, runs `npm run build`, starts `dist/api/server.js` in the background, polls `/health`, writes the pid to `.dev-server.pid`. |
| `driver.mjs shot [route] [width] [height]` | Playwright: loads the route (default `/admin/pricing-history`, 390x844), fills in the bearer token from `.dev-token` + the seeded org id, submits the form if the route is a token-gated admin page, screenshots to `.claude/skills/run-tradeos-costbook-api/screenshots/`, and prints `scrollWidth` vs `clientWidth` so overflow regressions are caught by the numbers, not just by eye. |
| `driver.mjs stop` | Kills the pid in `.dev-server.pid`. |

Screenshots land in `.claude/skills/run-tradeos-costbook-api/screenshots/<route>_<width>x<height>.png`.

To check a different admin page (e.g. membership history): `driver.mjs shot /admin/member-history 390 844` — the driver fills the same `bearerToken`/`orgId` fields generically for any route containing `pricing-history` or `member-history`.

## Run (human path)

```bash
npm run dev      # ts-node + nodemon on :4000, needs .env already pointing at a real Postgres instance
```

Useless headless; only worth it if you want to poke the UI yourself in a real browser. Stop with Ctrl-C.

## Test

```bash
npm test          # jest --runInBand — 56 tests / 16 suites as of this writing
npm run lint      # tsc --noEmit
npm run test:integration   # separate live-Postgres RLS suite, also stands up tradeos-costbook-test
```

---

## Gotchas

- **Seeding is not idempotent past org/user/membership.** `db/seed/seed.ts` does plain `.create()` for divisions/categories/materials/etc. Re-running `seed` against an already-seeded container throws `Unique constraint failed on the fields: (org_id,code)`. If you need to reseed, recreate the container first (`driver.mjs db --fresh`) — `driver.mjs all` always does this for you.
- **Seeding must use the admin/superuser Postgres URL, not the app's restricted role.** Forced RLS (`prisma/migrations/20260623180000_enable_org_rls/migration.sql`) intentionally blocks ordinary tenant sessions from inserting `organizations` rows — that's by design, not a bug. `driver.mjs seed` connects as `postgres`; `driver.mjs serve` writes `.env` pointing the actual running API at the restricted `tradeos_app` role, which is the combination that exercises RLS realistically.
- **`driver.mjs db` needs a host `psql` client**, not just Docker. The migration/role-provisioning step now shells out to `scripts/deploy-migrations.sh`, which calls `psql` directly against the container's exposed port rather than `docker exec`-ing into it — this is deliberate, since it's the identical path a real production deploy uses, but it means `psql` must be on `PATH` for the shell `driver.mjs` runs in.
- **A stray previous server process silently swallows the next `serve` run.** If an old `node dist/api/server.js` is still bound to port 4000 from an earlier session (e.g. started by hand, not through this driver), `driver.mjs serve`'s health check passes immediately against the *old* process, and the new pid it just spawned has already crashed on `EADDRINUSE` — `driver.mjs stop` then reports "already gone" while the API is still actually up. `driver.mjs serve` now checks `lsof -ti :4000` up front and fails loudly with the offending pid instead of silently succeeding against the wrong process.
- **The bearer token field on the admin pages is a `<textarea>`, not an `<input>`** (`api/views/adminShell.view.ts`) — a generic `input[name="bearerToken"]` Playwright selector times out waiting for an invisible hidden `<input>` of the same name used by the secondary filter form on the same page.
- **CSS Grid track sizing can overflow the viewport even when the offending element has its own `overflow-x:auto`.** The admin shell's mobile nav (`@media(max-width:760px)`) lets the tab row scroll internally, but without `min-width:0` on `.sidebar`/`.sidebar nav`, the grid's auto-minimum sizing pushed the single `1fr` track ~18px past the viewport anyway. Don't just eyeball the screenshot for this class of bug — `driver.mjs shot` prints `scrollWidth` vs `clientWidth` precisely so a 390-vs-408 mismatch shows up as text, not as something you have to notice visually.
- **Reused containers carry state across sessions.** `docker ps` showing `tradeos-costbook-test` already `Up` from a previous session is expected — `driver.mjs db` (without `--fresh`) reuses it rather than recreating it, which is faster but means old seeded data/audit rows persist.

## Troubleshooting

- **`API did not become healthy within 15s`**: usually means `npm run build` produced stale/broken `dist/`, or Postgres isn't actually reachable on `127.0.0.1:55432` yet. Check `docker ps` for `tradeos-costbook-test` and `docker logs tradeos-costbook-test`.
- **`page.fill: Timeout 30000ms exceeded` on `bearerToken`**: you're targeting the wrong element — see the `<textarea>` gotcha above. Use `textarea[name="bearerToken"], input[name="bearerToken"]` to match either form on the page.
- **`no .dev-token — run seed first`**: `driver.mjs shot` reads `.dev-token`, which only exists after `driver.mjs seed` has run successfully against a database that actually has the seeded org/user.
