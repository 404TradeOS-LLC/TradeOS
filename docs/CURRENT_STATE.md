---
status: current
owner: platform
last_verified: 2026-09-02
source_of_truth: true
related_code:
  - app/modules/auth
  - app/backend/controllers/auth.controller.ts
  - app/backend/controllers/adminDashboard.controller.ts
  - app/backend/server.ts
  - app/domain/contracts.ts
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260831214500_add_costbook_code_trgm_indexes
  - app/backend/routes
  - app/modules/payments
  - app/modules/costbook
  - app/modules/cost-database
  - app/modules/assemblies-database
  - app/modules/estimate-engine
  - app/modules/supplier-integration
  - app/modules/athena-kernel
  - app/modules/athena-tools
  - app/modules/athena-tools/costbook
  - app/modules/athena-events
  - app/modules/athena-observability
  - app/modules/athena-action-engine
  - web/src/app
  - web/src/app/(app)/dashboard
  - web/src/components/dashboard
  - web/src/app/(app)/costbook
  - web/src/app/(app)/dispatch
  - web/src/app/(app)/customers
  - web/src/app/(app)/projects
  - web/src/app/customer-portal
  - web/src/app/(app)/portal
  - web/src/app/api/proxy/[...path]/route.ts
  - web/src/proxy.ts
  - web/src/lib/supabase/proxy.ts
  - web/src/lib/api.ts
  - web/src/lib/api-response.ts
  - web/src/lib/clientApi.ts
  - web/src/lib/customer-portal-session.ts
  - web/src/lib/json-response.ts
  - web/src/lib/proxy-origin.ts
  - .github/workflows/verify-repository.yml
---

# Current State

Last reconciled against `origin/main` commit `e872fa40f6e32175a80284f44c768d3307bdc22f` on 2026-09-01 after PR #425 merged. This document records repository truth, not a guarantee that every merged capability is deployed or exercised in every environment. Production/deployment claims remain tied to the specific evidence noted below.

## Current milestone

TradeOS is in RC1 hardening. The active posture is production readiness, lifecycle consistency, contractor-facing usability, tenant-boundary verification, and retained release evidence rather than MVP planning.

## Authenticated shell and navigation

- The authenticated web shell uses a shared 404TradeOS copper token system and
  semantic warning, success, info, and destructive tokens. The light-theme
  semantic fill/foreground pairs are contrast-tested for normal-size text;
  copper remains the sole brand accent.
- The responsive navigation includes the 404TradeOS Control Dock with Today,
  Dispatch, Create, Work, and More actions. The More sheet preserves the
  existing routes and permissions, traps keyboard focus, restores focus on
  close, and coordinates body-scroll locking with the global command palette.
- The Dispatch attention badge is advisory and loads after the authenticated
  shell renders through the same-origin client API, aborts on unmount, and
  propagates cancellation through the proxy; the Dispatch workspace remains
  the source of truth when the advisory lookup fails.
- Status badges use solid semantic fills with their paired foreground tokens
  so warning, success, info, and destructive labels remain contrast-safe in
  both themes.
- Route-level loading states expose concise status announcements while keeping
  visual skeletons decorative. Document skeleton grid ratios normalize
  Tailwind-encoded underscores for valid CSS at the wide-screen breakpoint.

## Implemented product areas

- Auth and tenancy, including local-session refresh hardening, Supabase JWT verification, organization bootstrap/recovery, request-scoped database sessions, and forced PostgreSQL RLS.
- CRM: customers, service addresses, customer equipment, service agreements, notes, and company profile.
- Projects and project workspace, including task and site-visit workflows.
- Estimating: estimate creation, sections/line items, Costbook provenance, custom lines, pricing formulas, tax, duplication, comparison, finalized-estimate behavior, and review-first AI Estimate Assist.
- Proposals, contracts, invoices, recorded payments, and downstream lifecycle flows.
- Invoice line-item storage now uses canonical selling-price columns `unit_price` and `line_total`; synchronized legacy `unit_cost`/`line_cost` aliases remain during the expand/contract rollout, while the `unitPrice`/`lineTotal` API contract stays unchanged.
- Jobs and Dispatch: job creation from the project workspace, scheduling, assignment, rescheduling, conflict handling, field-status transitions, and dispatcher work queues.
- Owner dashboard (contractor command center): a synthesized header status sentence (greeting + attention count + today's job count), organization work queues ("Needs attention"), a Continue Working panel surfacing each in-progress project's next non-blocking step (proposal not sent, contract needed after an accepted proposal, scheduling needed after a signed contract, invoice needed after completed field work — deliberately distinct from Needs Attention's stuck/overdue states, all derived from already-loaded project detail with no added queries), an Outstanding Money card aggregating canonical invoice `balanceDue` into total/overdue receivables with honest partial-total disclosure when the loaded invoice page doesn't cover every open invoice, KPI drill-downs, payment-backed revenue, dispatch-backed schedule, task pressure, a merged activity feed spanning task movement plus proposal/contract/invoice/site-visit milestones (`entityType: "project"` activity events), quick actions, truthful degraded states, and bounded project-detail fan-out that preserves healthy recent-project data when one detail request fails.
- Brand Studio and Settings/organization operations.
- Customer portal document views and the public customer magic-link portal approved by ADR-010.
- Knowledge Runtime integration and backend structured estimator orchestration.

## Costbook domain

The canonical Costbook workspace is implemented across `/api/v1/costbook/*` and `/costbook/*` while reusing the established catalog tables and services instead of creating duplicate pricing subsystems.

Implemented Costbook surfaces include:

- workspace summary
- divisions, categories, and subcategories
- materials
- labor rates
- equipment
- Cost Items
- Assemblies and components
- calculation-only pricing preview
- Material price audit/history and Estimate pricing snapshots
- supplier-feed proposal/review flow
- bounded search/filter/sort/cursor pagination across canonical catalog collections

Costbook permissions, organization scope, request-scoped sessions, and forced RLS remain the authority for tenant boundaries. Estimate lines preserve source identifiers plus captured `unitCost`/`lineCost` snapshots so later catalog changes do not rewrite historical estimate pricing.

Cost Item and Assembly case-insensitive substring search is supported on both `name` and `code`. The database provides GIN `pg_trgm` indexes for both fields, including `idx_cost_items_code_trgm` and `idx_assemblies_code_trgm`, so the existing `ILIKE '%query%'` code predicates do not rely on the unrelated btree uniqueness indexes.

### S027 production-readiness truth

The implementation that older revisions of this document labeled **Unreleased** is merged repository state:

- PR #257 merged the supplier review concurrency repair.
- PR #260 merged the standardized Costbook catalog query contract.
- PR #268/#271 repaired bounded Supabase/Vercel serverless database pooling and TLS compatibility.
- PR #273 merged the bounded request-transaction acquisition wait.
- PR #274 added the real PostgreSQL `connection_limit=1` contention regression and hermetic timeout coverage.
- PR #278 supplied the production deployment/replay evidence referenced by the S027 readiness record.

The S027 readiness record therefore remains `PARTIAL`, **not because those repository/runtime repairs are unreleased**, but because exact authenticated rendered evidence is still missing at **1440 / 1024 / 768 / 390 px**, including keyboard-focus and mutation/error-state coverage. The production replay already reached all nine canonical Costbook routes with `200` API responses and no warning/error/fatal entries in the exact-deployment logs; exact viewport evidence remains the final promotion gate. See `docs/architecture/COSTBOOK_S027_READINESS.md`.

Cold/concurrent Costbook requests in the retained production evidence reached approximately 12.6 seconds in the worst observed case. Treat that as performance follow-up, not as proof of an incomplete response.

### Costbook ↔ Athena boundary

Athena A12 includes three landed **read-only/recommendation-only** Costbook Intelligence tools under `app/modules/athena-tools/costbook`:

- catalog lookup
- margin analysis
- price recommendation

Those adapters call existing `CostDatabaseService` / `AssembliesDatabaseService` methods and shared Estimate formulas. They do not reach Prisma directly, do not define competing pricing math, and do not mutate Costbook or stored pricing state. Athena Costbook writes/autonomous Costbook mutation remain outside the landed architecture and require separate governance.

## Lifecycle normalization status

The bounded lifecycle-normalization sequence through Project, Estimate, Proposal, Contract, Invoice, and Job behavior has landed through the numbered sprint evidence recorded in `docs/SPRINT_BACKLOG.md` and the corresponding architecture/completion records.

Important compatibility truths that remain intentional:

- historical Project aliases remain readable while new writes use canonical Project states;
- Estimate `sent` remains distinct from internal `ready`;
- historical Proposal `rejected` normalizes to canonical `declined`;
- Contract persistence may retain compatibility storage such as `pending_signature` while DTOs expose the canonical lifecycle contract;
- Invoice paid/partial/overdue presentation is derived from persisted Invoice/Payment truth rather than inventing ledger rows;
- destructive historical rewrites are not implied by lifecycle normalization.

## Customer portal and identity

Two portal surfaces are intentionally distinct:

- `/portal/*` is the authenticated staff preview/workspace.
- `/customer-portal/*` is the ADR-010 public customer-scoped magic-link surface.

The public portal uses one-time hashed access tokens redeemed into short-lived hashed sessions, customer/tenant-scoped forced-RLS reads, replay/revocation protection, and a narrowly authorized pending-contract customer-signing transition with explicit customer attribution. It does not claim certificate-backed signing, notarization, or standalone legal identity verification.

Customer-portal server API reads preserve structured backend errors, normalize non-JSON upstream failures into the portal failure path, and reject malformed successful responses explicitly instead of leaking raw parser exceptions.

## Athena implementation state

Athena remains a feature-flagged orchestration layer over existing application services rather than a parallel business-domain implementation.

Landed foundations include:

- kernel lifecycle and execution persistence
- memory infrastructure with scoped visibility rules
- canonical event/outbox persistence and delivery infrastructure
- action engine, approval/risk boundaries, and durable idempotency
- observability/trace/alert derivation
- first-party business tools routed through existing application services
- safe background/retry/correlation semantics
- security audit-event coverage

Athena business tools must preserve service ownership and existing authorization/RLS boundaries. Direct Prisma access from tools, duplicate domain logic, and autonomous Costbook mutation remain outside the intended module boundary.

Repository merge state does not by itself prove Athena is enabled in production; feature flags and deployment configuration remain authoritative.

## Security and tenant-boundary posture

Current repository architecture uses authenticated request context plus organization membership authorization, request-scoped database sessions, and forced PostgreSQL RLS as layered tenant protection. Route/service permission checks remain defense in depth rather than a substitute for database isolation.

Security-sensitive maintenance already landed includes:

- local refresh-token rotation/revocation hardening
- Supabase JWT claim/lifetime validation
- organization bootstrap/RLS lookup repairs
- tenant-boundary regression coverage
- protected storage/server-action session checks
- bounded database transaction acquisition under serverless contention
- safe audit/security event capture
- exact-origin enforcement for cookie-backed `POST`/`PUT`/`PATCH`/`DELETE` calls through the generic authenticated Next.js API proxy before the HttpOnly session is read or translated into a backend bearer token; safe read methods remain unchanged
- browser-side same-origin API response handling normalizes non-JSON proxy/upstream failures into `ClientApiError` with the HTTP status preserved and treats malformed successful responses as explicit API contract failures rather than leaking raw parser exceptions
- server-only staff API response handling preserves structured backend error status/details, normalizes non-JSON upstream failures into `ApiClientError`, and treats malformed successful responses as explicit API contract failures rather than leaking raw parser exceptions

The authenticated-proxy origin check closes the same-site sibling-origin CSRF gap that `SameSite=Lax` cookies do not cover by themselves without changing backend JWT, membership, permission, or RLS policy.

This document does not treat a passing unit test or route-level organization predicate as equivalent to RLS evidence where the repository requires PostgreSQL-backed verification.

## Deployment and beta-evidence posture

Repository state and production state are separate evidence domains.

Known retained deployment evidence includes the S027 production Costbook replay described above and later production/auth fixes recorded by their owning PRs. Exact release-candidate browser evidence, environment configuration, credentials/storage states, and retained multi-viewport artifacts must be proven through the approved deployment/evidence workflows rather than inferred from merged code.

RC smoke run #10 on 2026-09-02 proved the repaired workflow now passes its
non-production configuration gate without serialized storage-state secrets, but
the owner authentication check still used a stale lifecycle identity and timed
out on successful-login navigation. The bounded follow-up maps owner auth to the
maintained Beta smoke credentials while keeping the field technician password
isolated; this is evidence-fixture maintenance, not a product auth-policy change.

Run #11 then returned a login alert before credential evaluation. A direct
sanitized signup probe reported `SUPABASE_URL is not configured`; the stable
staging backend remained database-ready, isolating the defect to its missing
branch-scoped Supabase issuer URL. The Beta owner and technician now have
confirmed staging Supabase Auth identities mapped to their existing active
owner/technician memberships. The first guarded environment-repair dispatch did
not alter the deployment: Vercel CLI 59.11.2 prompted before `env update` and
rejected the removed `redeploy --yes` option. The workflow now uses the verified
non-interactive update and redeploy contracts. Full lifecycle evidence remains
blocked until the corrected repair dispatch restores the staging backend and the
smoke rerun passes.

Customer magic-link portal implementation is merged, but its merge alone does not constitute beta-readiness evidence. The same applies to other product flows that still require authenticated rendered verification.

## Contractor project-to-job bridge

The authenticated project workspace now has a reachable `Create job` path into `/projects/[id]/jobs/new`. The form resolves the linked customer, reuses saved service addresses, can create a missing service address through the existing CRM contract, and creates the initial Job through the existing authenticated `POST /api/v1/jobs` API before continuing into `/dispatch`. Before any missing-address CRM mutation, the form normalizes and validates the required job title and job type so an invalid job submission cannot leave a newly created service address behind.

This closes the prior UI-only break between approved/billable project work and field execution. It does not add a new Job lifecycle, permission, role, schema, migration, RLS policy, or authentication mechanism; the existing backend service and request-scoped tenant boundary remain authoritative. Repository implementation truth is separate from RC promotion evidence: the full contractor flow still requires retained authenticated proof through payment -> job -> schedule -> dispatch/field progression -> completion plus the required 1440 / 1024 / 768 / 390 viewport evidence.

## RC dashboard schema-drift incident

On 2026-09-01, the production-like Supabase database serving the RC deployment was behind the repository migration head. The API Prisma client queried `estimates.tax_pct` and project-detail financial fields that were absent from the database, causing the estimate queue and one project-detail request to return generic 500 responses while `/dashboard` itself rendered. The authenticated organization, membership, and forced-RLS context were valid; authorization was not bypassed or weakened.

The repository-authoritative migrations from `20260814120000` through `20260831214500` were applied to the canonical RC database and its Prisma migration history was reconciled with the exact repository checksums. This incident also adds structured 5xx request logging and a readiness schema check for dashboard-critical estimate, invoice, and contract columns. The focused application repair is merged as `e09101f6c436f1f5648f2188a9621b5dc1a26477` and the backend is deployed READY as `dpl_2gWxCWF4wbiQS7FBxeu3a522h1VK` at `tradeos-costbook-ocq61wy8f-billykshowalters.vercel.app`; the frontend was correctly unchanged because no web files were modified. Authenticated multi-viewport and contractor-smoke evidence remain outstanding until the runtime-authenticated RC workflow completes and retains its artifacts; no baked browser-state secret is required by that workflow.

## Current verification surface

Backend commands defined in `app/package.json` include:

- `npm test`
- `npm run test:integration`
- `npm run lint`
- `npm run build`

Frontend commands defined in `web/package.json` include:

- `npm test`
- `npm run lint`
- `npm run build`

Repository governance additionally uses documentation consistency, dependency review, branch-currency/live-reconciliation checks, and PostgreSQL-backed integration/migration rehearsals where applicable.

### Beta contractor vertical regression coverage

`app/tests/beta-vertical-price-transfer.test.ts` chains real `ProposalsService.create()` and `ContractsService.create()` calls (not per-module mocks with independent fixtures) to guard the estimate -> proposal -> contract price and scope transfer, including its tenant-isolation (`orgId`) and `documents.manage` role-guard boundaries. `web/src/app/actions/invoices.test.ts` and `web/src/app/(app)/projects/[id]/invoices/[invoiceId]/page.test.ts` pin `recordInvoicePaymentAction`'s validation/payload/error-handling contract and lock the invoice page's `canRecordPayment` role list to the backend's `billing.write` grant in `app/domain/contracts.ts`. Record-payment UI/API and contract amount/snapshot rendering were already correct; this closes the prior zero-regression-coverage gap on that path. It does not add authenticated browser/Playwright e2e coverage (no such harness exists in this repository) and does not add the `subtotal`/`taxAmount`/`taxPct` fields `Proposal` is still missing, so only a single collapsed `finalPrice` survives estimate -> proposal -> contract.

## Known blockers and unresolved technical debt

- S027 exact authenticated rendered evidence at 1440 / 1024 / 768 / 390 px remains incomplete; repository/runtime repairs are merged and production replay is already evidenced.
- Persisted organization-wide Costbook pricing-policy/rule governance is not implemented; `/costbook/pricing` remains calculation-only preview behavior.
- Supplier feeds remain review-first and do not auto-apply prices; supplier-SKU matching and provider-specific connector depth remain future work.
- Athena Costbook writes/autonomous pricing mutation are not implemented.
- Production environment values, Preview isolation, runtime-authenticated RC sessions, and multi-viewport browser artifacts must be verified externally rather than inferred from repository state.
- Settings brand-asset uploads use a shipped S017 orphan reconciler: stale generated, non-current objects can remain in private Storage until an authorized operator runs the dry-run-by-default cleanup after the 24-hour grace period. No automatic cleanup scheduler exists by design.

## Canonical sequencing

Numbered-sprint eligibility and ordering are owned by `docs/SPRINT_BACKLOG.md` and the repository reconciliation protocol. `CURRENT_STATE.md` describes implementation truth; it does not override the backlog, readiness plans, ADRs, or completion-evidence records.

## Module documentation

See `docs/modules/` for the maintained domain/module records and `docs/architecture/` for readiness plans, ADRs, and completion evidence.

## Web password recovery

The web forgot-password flow uses Supabase Auth recovery: the recovery request is sent through Supabase, `/auth/confirm` exchanges the PKCE or token-hash link for a server-side session, and the reset form updates the Supabase password. Legacy backend-token reset links remain supported. This avoids requiring the web recovery flow to reach Prisma or the backend Resend adapter.
The callback attaches Supabase recovery session cookies directly to its redirect response before navigating to `/reset-password`, preventing the reset form from losing the recovery session between requests. `/reset-password` binds the HttpOnly recovery marker to the user returned by the recovery exchange and requires that same live user before rendering the native form, so a stale marker or unrelated sign-in session fails closed at page load. Malformed or unrecognized recovery callbacks log only a static diagnostic; recovery query strings, PKCE codes, and token hashes are never written to server logs.

`/reset-password` verifies a valid recovery session server-side (the `tradeos-recovery` cookie set by `/auth/confirm`, or a legacy invite token) before ever rendering the password form. A missing session, or an `?error=` from a failed `/auth/confirm` exchange (expired, reused, or scanner-consumed link), renders a recovery-error card with a link back to `/forgot-password` instead of the form — the form is never shown to a caller without a valid session. `resetPasswordForEmail`, the `/auth/confirm` exchange, and `updateUser` each log their real Supabase error server-side (`console.error`) on failure while returning a generic, safe message to the client.


## Dashboard weather compatibility seam

The standing dashboard weather selector in `web/src/lib/dashboard-weather.ts` remains intentionally disabled until adverse-weather handling is owned by the scheduled exterior-job needs-attention queue. It preserves its typed input contract and returns `null` without issuing Census or NWS requests; the follow-up lint cleanup is behavior-neutral.

## RC beta evidence validation — 2026-09-05

- Beta Evidence run `33945411532` completed successfully against the approved non-production RC preview with deployment SHA correlation to `ee2300a438311e50f6813510578c125073a1f850`. Authentication, tenant isolation, 1440/1024/768/390 browser captures, downstream contractor workflow, artifact validation, and credential scanning all passed.
- The validated contractor path creates a customer and project, builds and finalizes an estimate, transfers the exact customer-facing price into a proposal, sends and accepts it, creates a contract, and creates an invoice with the accepted `$7,105.07` total.
- RC defects repaired for promotion are browser API proxy path normalization, proposal cents preservation, invoice Decimal-to-number display normalization, and mobile `PageHeader` wrapping that removes 390px horizontal overflow.
- Custom estimate line items are valid without a Costbook source. Migration `20260905050000_allow_custom_estimate_line_items` changes the database invariant from exactly-one-source to at-most-one-source, preserving mutual exclusivity while allowing source-less custom lines.
- Tenant-isolation evidence now asserts denial at the authenticated same-origin API proxy/backend boundary (403/404 required) and treats the browser page as a secondary UX signal, avoiding false failures from Next.js error boundaries that can retain an outer HTTP 200 after a denied server-component fetch.
