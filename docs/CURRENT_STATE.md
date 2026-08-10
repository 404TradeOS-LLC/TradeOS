---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
related_code:
  - app/modules/auth
  - app/backend/controllers/auth.controller.ts
  - app/backend/server.ts
  - app/domain/contracts.ts
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260703090000_add_search_trgm_indexes/migration.sql
  - app/prisma/migrations/20260804020000_harden_database_security_boundaries/migration.sql
  - app/scripts/sql/provision-app-role.sql
  - app/backend/routes
  - web/src/app
  - web/src/components/dashboard/needs-attention-card.tsx
  - web/src/components/dashboard/owner-dashboard-data.ts
  - web/src/components/dashboard/owner-dashboard-header.tsx
  - web/src/components/dashboard/owner-kpi-card.tsx
  - web/src/components/dashboard/owner-today-schedule.tsx
  - web/src/components/dashboard/ai-assistant-placeholder-panel.tsx
  - web/src/components/dashboard/owner-activity-feed.tsx
  - web/src/components/dashboard/owner-quick-actions.tsx
  - web/src/components/estimate-assist/ai-estimate-assist.tsx
  - web/src/app/(app)/dispatch/page.tsx
  - web/src/components/dispatch
  - app/modules/jobs/dispatchRules.ts
  - web/src/app/actions/settings.ts
  - web/src/lib/storage.ts
  - web/src/lib/settingsAssetUpload.ts
  - web/src/lib/envSecurity.test.ts
  - web/scripts/preview-smoke-check.mjs
  - web/.env.example
  - .github/workflows/verify-repository.yml
  - web/src/proxy.ts
  - web/next.config.ts
  - app/backend/middleware/productionHardening.ts
  - app/.env.example
  - app/modules/athena-kernel
  - app/prisma/migrations/20260809120000_add_athena_kernel_execution/migration.sql
---

# Current State

Last reconciled against `origin/main` commit `2d80214a` on 2026-08-04 for merged PR evidence, documentation truth, and source-of-truth status. Runtime implementation claims remain grounded in the code paths and merged evidence named below. Repository state does not by itself prove production deployment state, which must be verified through the approval-gated deployment workflows and the target platform.

## Current milestone

TradeOS is in RC1 hardening.

The repository is no longer organized around MVP planning documents. The active posture is production readiness, lifecycle consistency, verification, and contractor-facing polish.

## Implemented modules

- Auth and tenancy
- CRM: customers, service addresses, customer equipment, service agreements, notes, company profile
- Projects and project workspace
- Site visit intake
- Cost book: divisions, categories, subcategories, cost items, labor, materials, equipment, assemblies
- Estimating: estimate creation, line items, duplication, comparison, AI estimate assist, and structured contractor-language draft generation
- Proposals
- Contracts
- Invoices and payment recording
- Change orders
- Jobs and scheduling: job creation, assignment, scheduling, rescheduling, dispatcher coordination, and field-status workflows
- Project tasks
- Activity, notifications, recents, saved views, feature flags, and search-oriented intelligence primitives
- Owner dashboard foundation: morning command-center shell, KPI cards, "Needs attention" decision queues, mock schedule, UI-only AI briefing, activity timeline, and quick actions across existing contractor workflows
- Brand Studio
- Settings and organization operations
- Customer portal document views
- Supplier review queue and scheduler plumbing
- Knowledge runtime integration
- Backend structured AI estimator orchestration that stages contractor-language scopes into reviewable estimate drafts using existing costbook and estimate-engine services
- Project Athena A1 kernel lifecycle foundation (`app/modules/athena-kernel`): feature-flagged, non-mutating kernel shell with durable execution/transition/telemetry persistence, RLS-protected tenant and actor isolation, and a kernel-owned `AbortController` for timeout/cancellation. Dark by default behind `ATHENA_KERNEL_ENABLED=false`; see [athena/roadmap/A1-ai-kernel-implementation-plan.md](athena/roadmap/A1-ai-kernel-implementation-plan.md). No production business tools, memory, plugins, or autonomous writes exist yet.

See module docs in `docs/modules/`.

## Partially implemented or compatibility-layer areas

- Legacy role values `estimator` and `viewer` are still tolerated in stored data but normalize to canonical roles
- Project lifecycle persistence still contains legacy values such as `proposal_sent` and `accepted`; UI and shared contracts normalize these into canonical display states
- Contract persistence still stores `pending_signature`; global lifecycle docs treat that as compatibility storage under canonical contract states
- Supplier integration feed ingestion is scaffolded around a stub fetcher; queue, review, audit, and scheduling plumbing are real
- Customer portal exists for proposal, contract, invoice, and project views, but hardening is still tracked as RC work
- Structured AI estimator drafts remain review-first; they do not autonomously write estimate line items and do not call external model APIs in the current implementation
- Structured AI estimator apply now uses server-signed review tokens, server-side active target validation, per-estimate apply serialization, and optional estimate-line `sourceKey` duplicate protection for reviewed AI lines; Docker-backed live RLS integration verification passed locally on this branch
- Route-level `requirePermissions` checks were added to `app/backend/controllers/{aiEstimateAssist,crm,estimateEngine,projectTasks,proposals}.controller.ts`, closing a gap where those routes previously relied on org-membership alone (no route-level permission check). Customer and estimate mutation endpoints also now record `ActivityTimelineService` events (see [modules/activity-and-intelligence.md](modules/activity-and-intelligence.md)).

## Recent verified changes

- Fixed a critical production bug found immediately after the finish-setup fix went live: `hello@404tradeos.com` successfully completed finish-setup once (real `AppUser`/`Organization`/`OrganizationMembership` created), but every login *after* that got a false `409 User exists but has no active organization membership` from `POST /api/v1/auth/bootstrap` and, per `loginAction`'s own correct handling of that case, was left stuck on `/login` unable to sign in at all. Root cause: `bootstrapSupabaseIdentity`'s "does this identity already have an organization" lookup (`app/modules/auth/service.ts`) was a single un-flagged `basePrisma.appUser.findFirst` with a nested `include` for memberships/organization — but this database's RLS policies (`memberships_login_lookup_policy`, `organizations_select_policy`) require the request-scoped `app.login_lookup` → `app.user_id` → `app.org_id` session flags to be set, in that order, before those tables become visible; every other pre-authenticated lookup in this file (`login`, `refresh`, `requestPasswordReset`, `resetPassword`, `acceptInvite`) already followed that pattern, but this one call site never did. The user row itself was visible (some other policy permits that), but the nested memberships/organization queries were silently filtered to empty by RLS regardless of what actually existed — so this affected every already-provisioned identity's second-and-later login, not just this one account. Directly confirmed against production: `tradeos_app` (the app's runtime database role) has `rolbypassrls: false`, so RLS genuinely applies; `hello@404tradeos.com`'s `AppUser`/`OrganizationMembership` rows were confirmed present and correct in Postgres throughout, proving the bug was purely a visibility gap in the lookup, not missing data. Never caught by the existing unit test suite because it mocks Prisma entirely, which can't reproduce an RLS gap.
  - Fix: rewrote the lookup to run inside a `basePrisma.$transaction`, mirroring `login()`'s exact three-step `set_config` sequence: find the user under `app.login_lookup`, set `app.user_id`, find their active membership, set `app.org_id`, find their organization. External behavior/return shape is unchanged for every existing caller.
  - New regression coverage: `app/tests/auth.service.test.ts` gained a test asserting the exact `set_config` call sequence and values (the only way a mocked-Prisma unit test can pin this class of bug); `app/tests/rls.integration.ts` (Docker-backed, live Postgres, run in CI) gained `bootstrapSupabaseIdentity finds an already-provisioned identity's real membership against live RLS, not a false 409` — the authoritative proof, since only a real RLS-enforcing database can actually catch this bug class.
- **Verified live in production**: the finish-setup recovery flow below (and the full auth/bootstrap chain it depends on) works end-to-end. `hello@404tradeos.com` — the real orphaned account this entire chain of fixes was diagnosed against — logged in, was routed to `/finish-setup`, submitted a company name, and `POST /api/v1/auth/bootstrap` returned `201`. Confirmed directly against production Postgres: a real `AppUser` (`role: owner`, `status: active`) and `Organization` ("404 TradeOS LLC") now exist for that identity, created at the exact timestamp of the successful bootstrap call in the Vercel runtime logs.
- That same login surfaced a new, unrelated production bug: once bootstrap succeeded and `/dashboard` began actually loading real data, `GET /api/v1/knowledge/stats` started failing with `"Unable to locate the TradeOS repository root for Knowledge Engine loading"` (`app/modules/knowledge-runtime/loader.ts`), crashing the dashboard into the generic root `error.tsx` boundary the same way the auth gap had. Root cause: `packages/knowledge-engine/` (the actual data this module reads) is a sibling of `app/` at the repo root, but the `tradeos-costbook` Vercel project deploys with Root Directory `app` — only files inside `app/` land in the deployed Lambda's filesystem (confirmed against production runtime paths, e.g. `/var/task/app/node_modules/...`), so that data was never reachable there. This is why it was never caught before now: this code path only started actually running in production once the `jose`/`ERR_REQUIRE_ESM` fix below unblocked JWT verification, and no request had reached it until this real login.
  - Fix: `app/scripts/vendor-knowledge-engine.js` (new) copies `packages/knowledge-engine/{exports,knowledge,schemas}` (~2.4MB) into `app/vendor/knowledge-engine/` as a build step (`npm run build`), physically inside the deployed Root Directory. `resolveKnowledgeEnginePaths()` checks that location first, falling back to its original repo-root search unchanged for local/CI. Manually verified against the exact production topology: built `dist/`, moved `packages/` out of the way entirely, and confirmed the compiled loader still finds real data (289 assemblies, 1795 cost items) via only the vendored copy.
  - Also hardened `web/src/app/(app)/dashboard/page.tsx` and the AI Estimate Assist page's `getKnowledgeStats`/`getKnowledgeTrades` calls with `.catch()` fallbacks to their existing null/empty UI states — both pages already rendered "Unavailable"/empty states for missing knowledge data, they just weren't guarded against the fetch itself rejecting, so any future knowledge-runtime failure degrades gracefully instead of crashing the page.
  - New regression coverage: `app/tests/knowledge-runtime.loader.test.ts` (vendored-path preferred-over-fallback behavior, using the loader's real fixed offset, not a stand-in), `app/tests/vendorKnowledgeEngineScript.test.ts` (runs the real copy script and diffs output against source), `web/src/app/(app)/dashboard/dashboard-knowledge-resilience.test.ts` (pins both `.catch()` guards).
- Fixed the remaining production auth gap, found immediately after the `jose`/`ERR_REQUIRE_ESM` fix below unblocked bootstrap for real: an authenticated Supabase identity with an application membership already resolved correctly, but a legacy/orphaned identity — confirmed in Auth, but with no `AppUser`/`Organization`/`OrganizationMembership` row and no `organization_name` in its Supabase user metadata (any account created before the earlier bootstrap-on-login fix started storing that metadata) — had no recovery path. `loginAction` swallowed the resulting `400 organizationName is required to create a new organization` from `POST /api/v1/auth/bootstrap`, logged it, and still redirected to `/dashboard`, where every page's backend calls then 403'd with "Authenticated user is not provisioned in this organization" — a server-render-time throw that crashed into the app's generic root `error.tsx` boundary in production (the "Minified React error #441" / "Something went wrong" screen; Next.js redacts real server error text from the client-side error object in production, which is why the boundary itself couldn't route around this). Confirmed live against the real orphaned account, `hello@404tradeos.com`.
  - Fix: `bootstrapSupabaseIdentity` (`app/modules/auth/service.ts`) now attaches a stable, machine-readable `details: { code: "organization_name_required" }` to that specific `400` (deliberately not something the frontend has to parse out of the message text). `loginAction` (`web/src/app/actions/auth.ts`) now has three distinct outcomes after its bootstrap call: success → `/dashboard`; `organization_name_required` → `redirect("/finish-setup")`; anything else (transient backend error, network failure, the `409` "user exists but has no active membership" edge case) → returns `{ error }` and stays on `/login`, rather than falling through to a guaranteed-broken dashboard visit.
  - Added `/finish-setup` (`web/src/app/finish-setup/page.tsx` + `finish-setup-form.tsx`, new standalone route — not under the `(app)` group, since that layout's full nav would 403 for an unprovisioned user) and `finishSetupAction`. The only client input is `organizationName`; identity comes exclusively from the verified Supabase session cookie (never a client-supplied `role`/`userId`/`organizationId`/`authSubject`), and it calls the same idempotent bootstrap endpoint every other entry point uses, so a resubmit or an already-provisioned identity landing here again safely no-ops instead of creating a duplicate organization.
  - Separately, found and fixed a second production issue while investigating: `TRUST_PROXY` (the env var `app/backend/server.ts`/`app/backend/middleware/productionHardening.ts` already correctly consume, and have since the repository's initial scaffolding) was simply never set in Vercel, so every production request logged `express-rate-limit`'s `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` warning (harmless on its own — a warning, not a failed request — but worth closing out while auditing this incident). No code change was needed; `app/tests/trustProxy.test.ts` is new end-to-end regression coverage proving `TRUST_PROXY=1` resolves the client IP from only the single innermost `X-Forwarded-For` entry Vercel's edge proxy appends (not a client-spoofable earlier entry), and `app/.env.example` now spells out the exact required Production/Preview value (`"1"`, never `"true"`) with justification.
  - New regression coverage: `app/tests/auth.controller.bootstrap.test.ts` (supertest-level proof that a bootstrap request body carrying `role`/`userId`/`authSubject`/`organizationId` is rejected by Zod's `.strict()` schema before any provisioning logic runs), an extended assertion in `app/tests/auth.service.test.ts` for the new `details.code`, and `web/src/app/actions/auth.test.ts` (source-shape pinning — no mock harness exists for Server Actions in `web/` — covering the three-way `loginAction` routing outcome and every `finishSetupAction`/`/finish-setup` trust-boundary guarantee above).
- Fixed a critical production bug, found immediately after the bootstrap-on-login fix below shipped: every backend request bearing a Supabase-issued JWT (`POST /api/v1/auth/bootstrap` and any other authenticated route reached with a Supabase session, not a local HS256 token) returned `500 Internal Server Error`. Root cause: `app/backend/auth/jwt.ts`'s `verifySupabaseToken`/`getSupabaseJwks` load the `jose` package via `await import("jose")`, but this project's TypeScript compiles to CommonJS (`module: "commonjs"` in `app/tsconfig.json`), which downlevels that dynamic import into a plain `require("jose")` (confirmed against the compiled `dist/` output: `Promise.resolve().then(() => __importStar(require("jose")))`). `jose` v5+ ships ESM-only, so that `require()` throws `ERR_REQUIRE_ESM` at runtime — this has been broken since Supabase JWT verification was first added to the repository and was never caught because the existing test suite (`app/tests/auth.service.test.ts`) only calls `bootstrapSupabaseIdentity` directly with an already-verified `authSubject`, never exercising `jwt.ts`'s `jose` import at all. Confirmed live via Vercel runtime logs on a real signup/login (`hello@404tradeos.com`) and directly reproduced/fixed locally. Fix: pinned `app/package.json`'s `jose` dependency to `^4.15.9`, the last major version that ships a dual CommonJS/ESM build (`"require"` export condition) — no code change to `jwt.ts` was needed or made. New regression coverage in `app/tests/jwt.supabase.test.ts` signs a real RS256 JWT and verifies it against a local JWKS HTTP server through the actual `verifyAnyAuthToken` code path (not a mock), so a future dependency bump back to an ESM-only `jose` fails the suite immediately; confirmed this test suite fails to even load with `jose` reinstalled at `6.2.8` before reverting to the `4.15.9` fix.
- Fixed a production bug where a confirmed Supabase user could exist with zero application-side records (no `AppUser`, `Organization`, or `OrganizationMembership`). Root cause: `signupAction` (`web/src/app/actions/auth.ts`) only called `POST /api/v1/auth/bootstrap` in the same request as `signUp()`, which only returns a session immediately when email confirmation is disabled; `loginAction` never called it at all, so a user who confirmed their email asynchronously and came back to log in normally never got bootstrapped. `POST /api/v1/auth/bootstrap`'s `organizationName` is now optional (`app/backend/controllers/auth.controller.ts`, `app/modules/auth/types.ts`) — the existing-membership lookup in `AuthService.bootstrapSupabaseIdentity` (`app/modules/auth/service.ts`) already ran before using it, so making it optional lets `loginAction` call bootstrap on every login as a safe, idempotent, best-effort check; a brand-new identity with no membership and no `organizationName` still gets a clear 400 rather than a broken provisioning attempt. Separately, `signupAction` was not passing `emailRedirectTo` to `signUp()` at all, so Supabase's confirmation-email link fell back to the project's own Auth "Site URL" — which was `http://localhost:3000` — instead of production; `signupAction` now passes `emailRedirectTo: ${NEXT_PUBLIC_APP_URL}/login` (new env var, documented in `web/.env.example`) and also stores the typed organization name in Supabase's own user metadata (`options.data.organization_name`) so it survives the signup → confirm → first-login round trip for `loginAction` to read back. The Supabase project's Auth → URL Configuration → Redirect URLs allowlist still needs `https://app.404tradeos.com/login` added manually in the Supabase dashboard — no available tooling in this environment can read or write that setting; setting `NEXT_PUBLIC_APP_URL` alone is not sufficient on its own. New regression coverage in `app/tests/auth.service.test.ts` for the optional-`organizationName` bootstrap paths (existing user with and without a name supplied, new user rejected without a name, new user provisioned correctly).
- The owner dashboard (`web/src/app/(app)/dashboard/page.tsx`) now presents the logged-in contractor homepage as a morning command center. It keeps the existing authenticated app shell and live project-detail fan-out, adds unique route metadata, derives the company name from organization settings, composes reusable KPI/header/schedule/activity/quick-action components, and includes a UI-only AI Assistant briefing placeholder with no model calls or estimator-runtime writes. The schedule and owner activity feed use typed mock data only; no new backend endpoint, billing change, auth change, estimator runtime change, or `packages/knowledge-engine/**` change was introduced.
- The dashboard (`web/src/app/(app)/dashboard/page.tsx`) now composes a "Needs attention" section from the existing per-project data fan-out it already fetches (draft/ready estimates, proposals awaiting a response, invoices that are sent, overdue, or partially paid, and projects with no estimate yet), each linking directly into the existing estimate builder, AI Estimate Assist, proposal, and invoice pages. AI assist is only offered for draft estimates, since a `ready` estimate's line items are locked. No new backend endpoints, aggregation service, or design system were introduced; the new `web/src/components/dashboard/needs-attention-card.tsx` component reuses `Card`, `StatusBadge`, `EmptyState`, and `Button` plus the existing `createEstimateAction` server action.
- The AI Estimate Assist review panel (`web/src/components/estimate-assist/ai-estimate-assist.tsx`) now also surfaces the resolved target's `matchMethod` (already returned by the backend but previously unused by the frontend) next to the existing match-score badge, making the "why this was matched" provenance more visible without adding any new backend field.
- Five duplicate private `round2()` rounding helpers (in `cost-database`, `assemblies-database`, `change-orders`, `estimate-engine`, and `knowledge-runtime` services) were consolidated to import the one already exported from `app/modules/estimate-engine/formulas.ts`. No rounding behavior changed.
- Four internal-only exports (`mapPrismaKnownRequestError`, `CreateOrganizationInput`, `SupplierPriceUpdateStatus`, `SupplierFeedQuote`, `ClientApiError`) had their `export` keyword removed after confirming no other file imports them.
- Confirmed-dead frontend code was removed: the unused shadcn `Select` primitive (`web/src/components/ui/select.tsx`), an unwired AI-suggestions component pair, an unused project-files panel, and a dead Supabase browser-client wrapper (`web/src/lib/supabase/client.ts`) that had already been superseded by server-side `@supabase/ssr` usage.
- Unused `web/src/lib/api.ts` helpers (`signup`, `login`, `AuthSession`, `listProposalsByProject`, `listInvoicesByProject`) were removed after confirming the real auth path calls Supabase directly from Server Actions and that no caller used the two list helpers.
- `claude.md` was renamed to `CLAUDE.md` — both names pointed at the same file only because of this machine's case-insensitive filesystem; git tracked the lowercase name, which would not resolve as `CLAUDE.md` on a case-sensitive filesystem (Linux CI, most Docker images).
- Explicitly *not* removed: `web/src/components/ui/checkbox.tsx` and the `lucide-react` dependency — both are live (used by Brand Studio and Settings consoles), and `@supabase/supabase-js` — it is a required peer dependency of the actively-used `@supabase/ssr` package, not a dead dependency.
- Two new shared components (`web/src/components/shared/{list-row-link,line-item-row}.tsx`) replace hand-rolled, non-truncation-safe row markup that had drifted across the customers list/detail pages, the projects list page, and the recent-documents card. `ListRowLink` is the standard "link to a detail page" row; `LineItemRow` is the equivalent for the invoice detail page's priced line items. Both guard against a long name/description pushing trailing content (price, status badge) off the card on narrow viewports, which the prior per-page copies didn't. See `docs/ui-guide.md`. The Estimate Builder's own line-item list (metric tiles, assembly/cost-item picker, sticky pricing rail) is a different, richer layout and intentionally doesn't use `LineItemRow`.
- Settings Console's brand asset uploader (logo/dark logo/icon/watermark) previously staged an ephemeral `URL.createObjectURL()` blob straight into the settings draft, which silently broke on page reload since it was never actually persisted anywhere durable. It now uploads to the same private Supabase Storage bucket project files already use via `uploadSettingsAssetAction` (`web/src/app/actions/settings.ts`), records bucket/path metadata in `settings_asset_uploads`, and serves image bytes through the authenticated server-side proxy at `web/src/app/api/brand-assets/[orgId]/[assetKey]/route.ts`.
- Follow-up hardening on the settings asset uploader: `assetKey` is validated against a strict allowlist (`logoUrl`, `darkLogoUrl`, `iconUrl`, `watermarkUrl` — the only four settings asset fields that exist) via `validateSettingsAssetUpload` (`web/src/lib/settingsAssetUpload.ts`), uploads use a server-only service-role Supabase client after session/org/permission checks, and the backend independently pins metadata to the authenticated organization's generated `project-files` namespace. Only passive raster formats up to 6 MB are accepted, and the proxy returns `nosniff` plus a restrictive CSP. Uploading before "Save changes" can still leave an orphaned storage object if the user abandons the form without saving — tracked as non-blocking technical debt, not fixed here.

- A Dispatcher Workspace (`/dispatch`, linked from the authenticated nav) was added as a founder-directed feature branch, outside the numbered sprint queue (the closest backlog item, S030 "Dispatcher workspace end-to-end verification", is still `PLANNED` and blocked on S012, which is not `DONE` — see [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md); this branch does not claim S030 completion). It reuses the existing `Job`/`JobAssignment` model and `GET /api/v1/jobs` list endpoint (now with an additive `unassigned` filter and additive `project`/`customer`/`assignedTechnicians`/`isOverdue`/`isUnassigned`/`needsAttention` DTO fields) plus one new read-only aggregate route, `GET /api/v1/jobs/dispatch-summary` (count()-only, never `findMany`). A new pure-logic module, `app/modules/jobs/dispatchRules.ts`, is the single source of truth for terminal-status exclusion, overdue/unassigned/unscheduled "needs attention" predicates, and organization-timezone-aware day/week boundary math (derived from `domain/contracts.ts`'s canonical `jobStatuses`, validated via built-in `Intl` — no new dependency). Organization timezone is read from the existing but previously-unused `organizationSettings.settingsJson.timezone` field, with an honest UTC-fallback label surfaced in the UI when it is absent or invalid. Because the underlying `jobs_select_policy` RLS policy already narrows job visibility to owner/admin/dispatcher or an assignee, the summary endpoint's response includes a `scope` field so a non-manager caller's narrower counts are never presented as an org-wide total. No new database migration, canonical status, lifecycle transition, or privileged role check was introduced.

- Web frontend deployment foundation: the separate `tradeos-costbook-web` Vercel project now has READY Preview and production deployments, including a production deployment from `main` commit `2d80214a` on 2026-08-04. `web/.env.example` documents the frontend's server-only and browser-visible configuration contract with placeholders only, while `web/src/lib/envSecurity.test.ts` guards against importing `SUPABASE_SERVICE_ROLE_KEY` into a `"use client"` dependency graph. `docs/QA_PREVIEW_DEPLOYMENT_CHECKLIST.md` and `web/scripts/preview-smoke-check.mjs` provide repeatable validation for existing Preview deployments. Repository state cannot prove that every Vercel environment value is present or correct, so environment configuration remains a deployment check. No CORS, cookie, proxy/middleware, or backend auth code changed.
- `web/proxy.ts` was never actually running: `web/` uses a `src/` layout (`web/src/app`), and Next.js only auto-detects `proxy.ts`/`middleware.ts` at the project root **or** inside `src/` if the project has one — not both. It sat at the wrong location with no build error or warning, so `updateSession` (the Supabase session refresh that gates `/dashboard`, `/customers`, `/projects`, `/dispatch`) silently never ran. Fixed by moving it to `web/src/proxy.ts` (also renaming its `proxyConfig` export to the required `config` name — the same naming bug independently fixed in the sibling `404-tradeos` marketing site's own `proxy.ts`). `web/next.config.ts`'s `turbopack.root` is now pinned explicitly to the repo root rather than left to Next.js's auto-inference: Turbopack does not honor `experimental.externalDir` (that flag only affects the webpack build path), so `web/src/domain`'s cross-directory re-export of `app/domain` only resolves because `turbopack.root` literally includes both directories; auto-inference landed on the same directory but emitted a spurious "multiple lockfiles" warning because of the repo root's own docs-governance `package-lock.json`. Verified via build output (`ƒ Proxy (Middleware)` now present) and behaviorally (unauthenticated requests to `/dashboard` and `/customers` now invoke `updateSession`, while `/login` correctly does not). Separately, `app/backend/server.ts`'s previously-unrestricted `cors()` is now an explicit allowlist (`app/backend/middleware/productionHardening.ts`: `isAllowedCorsOrigin`/`buildCorsOriginHandler`) — the production frontend (`https://app.404tradeos.com`), any `tradeos-costbook-web` Vercel Preview deployment, and localhost, extensible via `CORS_ADDITIONAL_ORIGINS`. Auth is bearer-token-only (no cookies), so the prior wide-open policy was not a credential-hijack risk, but the allowlist is tighter without hardcoding a single origin that would break Preview deployments.

## Known blockers and unresolved technical debt

- Supplier feed connectors are not live
- Cost-item and assembly combined name-or-code substring search can still degrade into scan-heavy plans because only `name` columns are trigram-indexed today
- Documentation governance is implemented; ongoing governance work should update `docs/DOC_OWNERSHIP.yml`, `docs/README.md`, and `docs/REPOSITORY_GOVERNANCE.md` together when ownership policy changes
- Production deployment state and environment approvals are not inferred from code and must be verified per environment
- Some older implementation notes and planning artifacts required archiving because they conflicted with the live repository
- Settings brand asset uploads (`uploadSettingsAssetAction`) use the private `project-files` bucket through a server-only Supabase service-role client and authenticated proxy; no service credential or direct public/signed Supabase Storage URL is returned to the browser
- Settings brand asset uploads can leave an orphaned storage object if a user uploads a file but abandons the settings form before pressing "Save changes" — non-blocking, no cleanup logic exists for this yet

## Recent verified infrastructure facts

- the repository now includes `20260804020000_harden_database_security_boundaries`, which enables RLS on Prisma migration history without forcing it for the table-owning migration administrator, revokes runtime/public migration-history privileges, pins the eight existing RLS helper functions to an empty search path, and replaces three permissive auth-record update checks with guarded policies plus immutable identity triggers
- `app/scripts/sql/provision-app-role.sql` reapplies the `_prisma_migrations` privilege exception after its broad runtime table grant, preserving the boundary on every idempotent role provisioning run
- static migration regression coverage, the PostgreSQL parser check, all 437 backend unit tests, TypeScript lint, and the backend build passed before the security-hardening change merged as PR #65; GitHub Actions also completed the Docker-backed live RLS integration suite successfully
- merging application or migration code does not change the live database by itself; normal production rollout remains manual and Environment-approval-gated through the tracked migration deployment workflow

- migration `20260703090000_add_search_trgm_indexes` enables PostgreSQL `pg_trgm`
- the migration adds GIN trigram indexes on `cost_items.name`, `assemblies.name`, `materials.name`, and `suppliers.name`
- this supports the current case-insensitive substring-search behavior used by cost-item and assembly name search, and it covers representative name-search patterns for materials and future supplier search surfaces
- RLS behavior is unchanged because the indexes only affect query planning, not tenancy enforcement
- verification state: the migration is merged on `main`; the PR notes local migration and `EXPLAIN` verification on a throwaway Postgres 18 cluster, while the repository's own `npm run test:integration` harness was still recommended separately in that PR

## Current verification surface

Backend commands defined in `app/package.json`:

- `npm test`
- `npm run test:integration`
- `npm run lint`
- `npm run build`

Frontend commands defined in `web/package.json`:

- `npm run lint`
- `npm run build`
- `npm test` (framework-free `node --test` against `src/**/*.test.ts`; today this is `web/src/lib/envSecurity.test.ts`, which statically checks that `SUPABASE_SERVICE_ROLE_KEY` never leaks into a `NEXT_PUBLIC_`-prefixed name and never becomes reachable from a `"use client"` import graph)

Current CI workflows:

- `.github/workflows/verify-repository.yml` runs backend lint, unit tests, build, integration tests, and frontend unit tests/lint/build
- `.github/workflows/deploy-migrations.yml` runs tracked database rollout logic for migration changes

## Module documentation

- [modules/auth-and-tenancy.md](modules/auth-and-tenancy.md)
- [modules/crm.md](modules/crm.md)
- [modules/cost-book.md](modules/cost-book.md)
- [modules/estimating.md](modules/estimating.md)
- [modules/proposals.md](modules/proposals.md)
- [modules/contracts.md](modules/contracts.md)
- [modules/invoices-and-payments.md](modules/invoices-and-payments.md)
- [modules/projects.md](modules/projects.md)
- [modules/jobs-and-scheduling.md](modules/jobs-and-scheduling.md)
- [modules/activity-and-intelligence.md](modules/activity-and-intelligence.md)
- [modules/brand-studio.md](modules/brand-studio.md)
- [modules/customer-portal.md](modules/customer-portal.md)
- [modules/ai-estimate-assist.md](modules/ai-estimate-assist.md)
- [modules/settings-and-operations.md](modules/settings-and-operations.md)
