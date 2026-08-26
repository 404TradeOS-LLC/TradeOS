---
status: archived
superseded_by: docs/ROADMAP.md
do_not_use_for_implementation: true
---

# Rolling TODO

## In Progress
- Keep application-level org filters and permission checks as defense in depth beside forced RLS.
- Preserve passing unit, live integration, lint, and build checks after each phase slice.
- Keep membership and material-price audits append-only and admin-readable only.

## Next Up
- Resolve why required-reviewer protection rules won't enable on the `production` GitHub Environment despite being on GitHub Pro (API rejected with a billing-plan error) — try the web UI, or check if this needs an Organization-owned repo.
- Deploy the actual API application somewhere (Vercel/Fly/Railway/a VM) — the database schema and `tradeos_app` role exist live on Supabase now, but nothing is serving traffic yet.
- Configure deployment-level network restrictions around the platform provisioning route, now that there's a real deployment target.
- Add a real `SupplierFeedFetcher` once an actual supplier feed exists — the CRUD API, queue/review/worker plumbing, scheduler, and clean error responses are all ready to receive it now.
- Consider seeding more common assembly templates beyond the one example, now that `isTemplate` exists.

## Recently Completed
- Provisioned a disposable PostgreSQL 16 Docker database and repeatable `npm run test:integration` harness.
- Applied migrations `0001` then `0002` from scratch through the harness.
- Proved same-org reads, cross-org read/write denial, viewer write denial, and admin membership-history access through a non-superuser database role.
- Replaced tenant-level organization creation with secret-gated platform provisioning.
- Proved atomic organization, owner, membership, and audit creation under forced RLS.
- Added membership-derived scoped database sessions for background jobs and proved viewer restrictions remain active.
- Added immutable material price audit persistence, filtered admin API reads, and RLS policies.
- Proved admins can inspect price history while viewers receive no audit rows.
- Added the broader server-rendered admin shell at `/admin` and `/admin/pricing-history`.
- Added and inspected the admin-shell visual concept and desktop implementation screenshot.
- Verified the complete admin pricing workflow in the browser against live PostgreSQL data.
- Added a mobile overflow fix after the responsive screenshot exposed the wide-table grid issue.
- Closed the mobile QA recheck: confirmed the wide-table fix held, found and fixed a second overflow source (`.sidebar`/`.sidebar nav` missing `min-width:0` inside the 760px collapse), and verified `scrollWidth` matches viewport exactly at 390px.
- Final local verification: 56 unit tests across 16 suites, lint, and build all pass.
- Latest live verification before the CSS-only mobile fix: 8 integration tests pass.
- Added a committed run/screenshot skill at `app/.claude/skills/run-tradeos-costbook-api/` (db provisioning, seeding, build/serve, and Playwright-driven screenshots with scrollWidth/clientWidth overflow checks).
- Added rate limiting (`express-rate-limit`, 5/15min default) and an optional IP allowlist to `POST /api/v1/platform/organizations`, ahead of the existing secret check. Live-verified the 429 triggers correctly.
- Started supplier queue persistence: `supplier_price_updates` table + RLS (any org member reads, estimator+ enqueues, admin/owner-only review), `SupplierIntegrationService` (enqueue/list/approve/reject/syncFromFeed), and `runSupplierPriceSyncJob` actually exercising `runWithBackgroundDatabaseSession`. Live-verified the full HTTP flow (enqueue → approve → price+audit updated; reject → price untouched) and added a live RLS integration test proving estimator-can-enqueue-but-not-approve. The feed fetch itself is still a stub — no real supplier API exists yet.
- Added a supplier CRUD API at `/api/v1/suppliers` (write-only `apiIntegrationKey`, masked in all reads). Fixed an `on delete cascade` on `supplier_price_updates.supplier_id`/`material_id` from the prior session that would have silently wiped price-update history on deletion — changed to `on delete restrict`, matching `material_price_audits`. Live-verified the full CRUD lifecycle and the restrict protection against the running API.
- Added a scheduler/cron consumer for `runSupplierPriceSyncJob`: explicit `SUPPLIER_PRICE_SYNC_JOBS` target list (no cross-tenant auto-discovery, by design — that would need an RLS-bypassing connection), an optional in-process `node-cron` timer started from `api/server.ts`, and `npm run jobs:supplier-price-sync` for external cron/k8s CronJob use. Live-verified the in-process timer actually fires on a real `* * * * *` schedule (not just registers), and that one bad job spec fails independently without blocking the others.
- Added a Prisma constraint-violation-to-4xx mapper in the central error handler: P2002 (unique) → 409, P2003 (foreign key) → 409, P2025 (not found) → 404, with `meta` attached as `details`. Applies to every controller automatically. Live-verified a duplicate division code and a delete-supplier-with-history now both return clean 409s instead of 500.
- Resolved the project's two-parallel-migration-mechanism conflict: baselined the hand-written `db/migrations/*.sql` files verbatim into real, tracked `prisma/migrations/` history (verified byte-for-byte schema equivalence and full live RLS test parity first). `prisma migrate deploy` is now the one authoritative rollout command. Added idempotent app-role provisioning (`scripts/provision-app-role.sh`) and a composite `scripts/deploy-migrations.sh` for CI/CD. Unified all three places that previously hand-rolled this logic (test harness, run skill, and the old manual psql docs) onto one path. Deleted the now-redundant `db/migrations/` directory.
- Wired `scripts/deploy-migrations.sh` into `.github/workflows/deploy-migrations.yml` (manual dispatch + auto-trigger on migration-path pushes, against a `production` Environment for required-reviewer gating). Repo has no git remote yet, so verified as thoroughly as possible without one: `actionlint` static validation (clean) plus an actual `act`-driven run of the workflow's job in a real GitHub Actions runner image against the disposable test database — including a second run proving idempotency at the workflow level, not just the script level.
- Merged `/admin/member-history` into the shared admin-shell visual system: extended `adminShellCss` with chips/pagination/snapshot-details CSS the page needed, rewrote its markup to use the shared layout, kept all existing filter/pagination/snapshot logic unchanged. Live-verified visually at 1440x1000 and 390x844 with real seeded audit data (not just the empty state) — no overflow, table/chips/pagination all render correctly.
- Added common assembly templates for quick adding to estimates: `isTemplate` flag on `Assembly` (new migration, hand-written after `prisma migrate diff` showed the auto-generated diff was pure cosmetic noise across nearly the whole schema), `listTemplates`/`GET /api/v1/assemblies/templates`, one seeded example. The "quick add to an estimate" half was already solved (`assemblyId` on `addLineItem` already existed) — this closed the actual gap, which was having templates to add. Live-verified the full flow: query templates → confirm rolled-up unit cost → add to an estimate in one call.
- Created the real GitHub repo (private, pushed) and ran `.github/workflows/deploy-migrations.yml` for real against a live Supabase project — all 3 migrations applied, `tradeos_app` role provisioned, verified directly against the database (24 tables, forced RLS active). Fixed a real Supabase/GitHub-Actions networking bug (direct host is IPv6-only; switched to the Session-mode pooler). The `production` Environment has no required-reviewer gate yet — that protection rule wouldn't enable via API even on GitHub Pro.
