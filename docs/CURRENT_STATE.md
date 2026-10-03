---
status: current
owner: platform
last_verified: 2026-09-28
source_of_truth: true
related_code:
  - app/modules/auth
  - app/modules/billing
  - app/backend/controllers/auth.controller.ts
  - app/backend/controllers/adminDashboard.controller.ts
  - app/backend/server.ts
  - app/domain/contracts.ts
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260912044500_add_stripe_billing
  - app/prisma/migrations/20260831214500_add_costbook_code_trgm_indexes
  - app/prisma/migrations/20260908120000_add_active_job_assignment_lookup
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
  - app/modules/athena-mobile
  - web/src/app
  - web/src/app/(app)/dashboard
  - web/src/app/(app)/settings/billing
  - web/src/components/dashboard
  - web/src/app/(app)/costbook
  - web/src/app/(app)/dispatch
  - web/src/app/(app)/team-time
  - web/src/app/(app)/customers
  - web/src/app/(app)/projects
  - web/src/app/customer-portal
  - web/src/app/(app)/portal
  - web/src/app/api/proxy/[...path]/route.ts
  - web/src/app/api/project-files/[projectId]/[fileId]/route.ts
  - web/src/proxy.ts
  - web/src/lib/billing-api.ts
  - web/src/lib/supabase/proxy.ts
  - web/src/lib/team-time-api.ts
  - web/src/lib/team-time-config.ts
  - web/src/lib/team-time-route.ts
  - web/src/lib/team-time-model.ts
  - web/src/components/team-time/use-team-time-workspace.ts
  - web/src/components/team-time
  - web/src/app/api/team-time
  - web/src/lib/api.ts
  - web/src/lib/api-response.ts
  - web/src/lib/clientApi.ts
  - web/src/lib/customer-portal-session.ts
  - web/src/lib/json-response.ts
  - web/src/lib/proxy-origin.ts
  - .github/workflows/verify-repository.yml
---

# Current State

## Desktop estimate visibility repair — 2026-10-02

The nightly gate reproduced a production draft estimate showing only its header
and totals at a desktop viewport. The mobile workflow hides at `lg`, while the
desktop editing container had no responsive display override. This repair makes
the existing desktop workspace visible at `lg`, preserving the staged mobile
flow below that breakpoint. A focused regression checks the matching visibility
boundary. CI and post-merge/deployment browser verification remain required;
this repair is not a release-certification or sprint-completion claim.

## Staging auth bypass work in progress

The `feature/staging-auth-bypass` branch implements a gated fixture owner for credential-free Preview Playwright checks and a visible banner. The dedicated Supabase staging project contains a synthetic organization, owner, project, and draft estimate. This is not yet deployed or browser-verified on Vercel Preview; the current Preview API readiness is blocked by a database authentication error. Vercel Production remains denied by the guard. Do not count these branch changes as current production behavior.

Last reconciled on 2026-09-22 for the merged private-storage hardening and the rebased Stripe Billing subscription slice on PR #491. This document records repository truth, not a guarantee that every merged capability is deployed or exercised in every environment. Production/deployment claims remain tied to the specific evidence noted below.

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
  Every loading.tsx in the app now carries this pattern (`role="status"
  aria-live="polite" aria-busy="true"` plus an sr-only label), not just the
  document-detail skeletons.
- A personal, per-browser Light/System/Dark theme toggle lives in the nav
  (desktop header and the mobile More sheet); it is stored in localStorage,
  not organization settings, applies before first paint via a blocking script
  in the root layout to avoid a flash of the wrong theme, and live-updates
  when "System" tracks an OS scheme change. The `.dark` token set existed
  beforehand but was never applied anywhere before this.
- The light-theme focus ring/border (`--ring`) is a darker copper shade
  (`#5c3814`) than `--copper` itself, computed to clear WCAG 1.4.11's 3:1
  non-text contrast against background/card/input surfaces; the previous
  value only reached 1.7-1.93:1. Dark theme's ring is unchanged.
- `PageHeader` supports an optional `breadcrumbs` trail (in addition to the
  existing single-level `backHref`); the estimate builder and the invoice,
  proposal, and contract detail pages use it to show the parent project by
  name, not just a generic "Back to project" link.
- Costbook catalog tables and the Dispatch work-queue table have sticky
  column headers (`top-16`, matching the app header's height) with an opaque
  background so scrolled row content doesn't show through.
- A `@media print` stylesheet hides site chrome (header, nav, every button)
  and forces light, ink-safe colors regardless of the viewer's theme, for
  invoices, proposals, and contracts.
- The global error boundary (`web/src/app/error.tsx`) and a new
  `(app)/not-found.tsx` use plain contractor-facing copy (no "API logs"/
  engineering language) and always offer a link back to the dashboard rather
  than stranding the viewer.
- A "?" keyboard-shortcuts overlay and a bell-style "what's new" popover
  (real shipped-change summaries in `web/src/lib/changelog.ts`, never
  invented copy) are mounted once in the nav shell.
- Two dashboard sections (Knowledge Runtime Coverage, Recent project
  lifecycle) are collapsible via `CollapsibleCard`, persisted per-browser;
  Needs Attention, the KPI grid, and Quick Actions always stay expanded.
- Owner-dashboard KPI icon metadata crosses the React Server Component boundary as serializable identifiers; the client-side KPI grid resolves those identifiers to Lucide components locally so dashboard rendering never passes component functions from the server into a client component.
- `EmptyState` supports an optional decorative `icon` and is reserved for
  genuine loaded-data absence. `feedback-state.tsx` now encodes the canonical shared state
  taxonomy and supplies `FilteredEmptyState` plus `FeedbackState` for non-empty recovery
  and access boundaries. The first production migrations separate Materials filtered-no-match
  from a genuinely empty Material catalog and separate Costbook-import permission/load failure
  from missing business data. Material load failure confirms no Costbook data changed and
  offers retry/back navigation; import restriction confirms no import/data mutation occurred.
  This is the start of the cross-product rollout, not a claim that every existing route has
  already migrated away from historical `EmptyState` error/permission usage.

## Settings contractor control center

The authenticated `/settings` surface now follows the canonical contractor-control-center hierarchy rather than presenting every platform/admin section with equal visual weight.

- The default landing section is **Pricing**, with Company, Estimating, Team & Access, Communication, Athena, and Connections grouped as common contractor settings.
- Workspace/display, Branding, Roles & Permissions, CRM/document/template compatibility controls, Knowledge, API keys, Security, Billing compatibility, Backups, Audit Log, and Developer metadata remain available under **Advanced / admin** rather than competing with labor/markup/waste controls.
- Team and role summaries continue to use the existing permission-aware organization membership response. This does not enable or absorb the separate staging-only Team & Time workspace.
- Pricing values remain organization settings; Costbook/source provenance continues to govern whether material/supplier pricing is trustworthy. Settings defaults never upgrade stale, placeholder, or unverified Costbook data.
- The frontend distinguishes persisted organization keys from product fallbacks. Missing organization-specific business, pricing, AI, template, communication, and security values no longer render as fabricated company facts.
- The backend `PATCH /settings` contract still validates the complete settings object, so the Control Center sends the full draft on save. The frontend truthfulness fix therefore focuses on safe fallbacks: organization-specific business, pricing, supplier, AI, communication, and security defaults are blank/off rather than fabricated facts.
- Scaffolded integration/admin cards remain explicitly marked as sample data. Developer metadata reports unavailable/unexposed values as such rather than claiming healthy platform state without a live diagnostics source.

No backend Settings route, permission, tenant, RLS, Brand Studio, supplier, billing, or Team & Time contract changes are included in this frontend reorganization.

## Customer ↔ Project connection

The current Customer workflow now exposes the existing CRM/Project relationship directly without adding a parallel lead or address model.

- Customer list/detail reads use the canonical `crm.read` permission and Customer/address writes use `crm.write`; technician/read-only roles do not receive write controls.
- Customer creation performs an advisory same-organization duplicate check using exact normalized name/email comparison over bounded authenticated Customer searches. Each term requests at most 250 rows. A failed search or a full 250-row result is treated as incomplete, and creation fails closed until the lookup can complete.
- Possible matches are advisory: staff can open an existing Customer or explicitly create a separate record. TradeOS does not silently merge Customer records or use phone-only similarity as a definitive match.
- Customer detail loads active CRM ServiceAddress rows and lets authorized staff add, edit, and soft-remove them through the existing organization/customer-scoped service boundary.
- Project create/update coverage verifies that the selected `customerId`, `siteAddress`, and plain-language `simpleScope` remain organization-scoped and persist through the existing Project controller.
- No schema, migration, RLS, Customer merge, Lead database, CRM-stage, or Project-parent model was added.

Automated unit/controller coverage owns the bounded search, fail-closed duplicate workflow, service-address parent checks, permission denial, and Customer-linked Project persistence. Authenticated browser mutation/reload evidence and disposable PostgreSQL/RLS certification are still outstanding; this section does not claim those acceptance gates complete.

## Project-backed Lead and Site Visit workspace

TradeOS now presents two canonical pre-estimate Lead states directly from existing Project/SiteVisit truth instead of introducing a parallel Lead database.

- A Project with no Estimate, Proposal, Contract, or Job and status `lead` renders the **New Lead** overview on its default Project route.
- A Project with a captured Site Visit, no Estimate, no Proposal/Contract/Job, and status `lead` or `estimating` renders **Ready to Estimate**.
- Once an Estimate exists, the Project falls back to the normal Project workspace; this slice does not invent later Lead-stage screens beyond the approved canonical states.
- Lead progress is derived from Project existence, Site Visit presence, Estimate presence, and `awarded` status. Qualification is not stored as a separate Lead-stage field.
- The Lead overview uses existing Customer contact data, Project scope/address/job type, Site Visit measurements/notes, Project photo files, missing-information output, AI follow-up questions, and intake confidence. Budget, timeline, and source are shown as not recorded because they are not dedicated Project fields today.
- The Site Visit route is now capture-first on mobile: photos, measurements, and field notes are primary; arrival/departure/GPS/transcript/customer/material/safety/verification details remain available under progressive disclosure.
- **Finish Visit** continues to call the existing `createSiteVisitAction`; no Site Visit API or storage semantics changed.
- The next commercial handoff is **Create Estimate**, using the existing Project-linked Estimate action. The UI explicitly does not claim Site Visit findings are automatically converted into priced Estimate line items.
- The prior direct Site Visit → Proposal-draft shortcut is removed from the intake page.

No new Lead, opportunity, qualification, Site Visit session, CRM-stage, Estimate-generation, or backend persistence model is introduced.

## Implemented product areas

- Auth and tenancy, including local-session refresh hardening, Supabase JWT verification, organization bootstrap/recovery, request-scoped database sessions, and forced PostgreSQL RLS.
- CRM: customers, service addresses, customer equipment, service agreements, notes, and company profile.
- Projects and project workspace, including task and site-visit workflows.
- Estimating: estimate creation, sections/line items, Costbook provenance, custom lines, pricing formulas, tax, duplication, comparison, finalized-estimate behavior, and review-first AI Estimate Assist.
- Proposals, contracts, invoices, recorded payments, and downstream lifecycle flows.
- Invoice line-item storage uses canonical selling-price columns `unit_price` and `line_total`; production migration `20260902200000_contract_invoice_line_price_columns` applied successfully on 2026-09-08, removing the synchronized legacy `unit_cost`/`line_cost` aliases and their sync objects. The disposable PostgreSQL rehearsal verified canonical data, index/constraint preservation, and tenant-scoped forced RLS; live production schema verification confirmed the canonical columns, required indexes, and forced RLS. The `unitPrice`/`lineTotal` API contract stays unchanged.
- Jobs and Dispatch: job creation from the project workspace, scheduling, assignment, rescheduling, conflict handling, field-status transitions, and dispatcher work queues.
- Team & Time staging integration: `/team-time` uses the existing signed-in Supabase session through a same-origin server route to call the staging `team-time` Edge Function. It supports assigned-job punches, breaks, manager review/correction, employee vs. subcontractor classification, and approved-hours CSV handoff. The route requires an exact same-origin `Origin`; its server-only gate requires `TEAM_TIME_ENABLED=true`, pins `TEAM_TIME_SUPABASE_PROJECT_REF` to the verified staging project, and checks that it matches the project reference in the `NEXT_PUBLIC_SUPABASE_URL` hostname. It is always disabled on Vercel Production. Staging verification on 2026-09-25 confirmed the function is active at version 4 with JWT verification and the two Team & Time migrations applied. The corresponding Edge Function and migration source are not currently versioned in this repository; this is a release blocker for production enablement. Staging has no active job assignments or Team & Time profiles yet, so live phone-to-office testing is pending. Payroll submission and location verification are not implemented or claimed.
- Owner dashboard (contractor command center): a synthesized header status sentence (greeting + attention count + today's job count), organization work queues ("Needs attention"), a Continue Working panel surfacing each in-progress project's next non-blocking step (proposal not sent, contract needed after an accepted proposal, scheduling needed after a signed contract, invoice needed after completed field work — deliberately distinct from Needs Attention's stuck/overdue states, all derived from already-loaded project detail with no added queries), an Outstanding Money card aggregating canonical invoice `balanceDue` into total/overdue receivables with honest partial-total disclosure when the loaded invoice page doesn't cover every open invoice, KPI drill-downs, payment-backed revenue, dispatch-backed schedule, task pressure, a merged activity feed spanning task movement plus proposal/contract/invoice/site-visit milestones (`entityType: "project"` activity events), quick actions, truthful degraded states, and bounded project-detail fan-out that preserves healthy recent-project data when one detail request fails.
- Financial Intelligence draft lane (#507): the organization-wide `billing.read` financial summary reports current-week recorded cash, exact open/overdue balances, unsigned proposal opportunity, and projected committed margin from unique accepted-proposal Estimate snapshots. Every source reports complete/partial/unavailable coverage; failed reads remain unknown instead of zero. Projected margin excludes tax and includes persisted estimate overhead; it is not actual job margin. Actual job costs remain unavailable until TradeOS persists verified labor, material, and equipment usage against jobs. The current Dashboard integration remains intentionally deferred on this draft branch so the newer Today Command Board is not replaced by the stale pre-command-board layout.
- Brand Studio and Settings/organization operations.
- Stripe Billing SaaS subscription foundation is implemented on PR #491: hosted Checkout for Starter/Pro/Business/Scale, 14-day trials, signed webhook synchronization, tenant-scoped billing/event persistence, a TradeOS-native entitlement resolver, Stripe billing-portal session creation, and `/settings/billing`. The server-owned catalog drives both displayed prices and checkout validation. Persisted organization-scoped attempts plus stable Stripe idempotency keys prevent duplicate Checkout sessions, while authoritative subscription hydration protects against out-of-order webhook delivery. Stripe—not the browser return URL—is authoritative for subscription state, and only `active` or `trialing` grants entitlements. The sandbox product/price catalog exists, but this is not yet a live-mode or production-deployment claim: runtime API key, webhook-signing secret, webhook endpoint registration, and a sandbox Customer Portal configuration still require environment setup and end-to-end evidence.
- Customer portal document views and the public customer magic-link portal approved by ADR-010.
- Knowledge Runtime integration and backend structured estimator orchestration. `knowledge-runtime/repository.ts`'s trade classifier (`inferTrade()`) was rewritten 2026-09-08 from raw substring matching (which misclassified the Tree Service assembly-index record as trade "Trim") to a deterministic, word-boundary/token-aware matcher that prioritizes each record's own curated `category` field and returns `null` on genuine ambiguity rather than guessing. Full before/after audit of the entire Knowledge Engine corpus: `docs/reports/KNOWLEDGE_TRADE_INFERENCE_AUDIT_2026-09-08.md`. No pricing value or Costbook record changed.

## CRM operating overview

The authenticated `/crm` route now composes the pre-job relationship workflow from existing organization-scoped sources: Customers, Projects, incomplete Project Tasks, `site_visit.created` activity, and the Proposal work queue. It introduces no Lead table, opportunity table, CRM-stage field, or follow-up table.

Pipeline lanes are derived at render time. Project `lead` remains Lead unless a real Site Visit milestone exists; Site Visit activity plus pre-proposal work can surface Ready to Estimate; Project `estimating` remains the estimating source; Proposal `sent`/`viewed` supplies Proposal Sent; and Project `awarded` supplies Awarded. Accepted-proposal side effects therefore stay owned by the existing Project/Proposal lifecycle rather than CRM.

The Follow-ups surface uses existing incomplete organization Project Tasks, including tasks created through Athena's bounded `create-follow-up` tool. Because Project Tasks do not persist a separate follow-up type, the UI describes them honestly as Project Tasks due next rather than inferring a new record class. Source reads use independent settled loading so one unavailable queue degrades visibly without blanking healthy CRM data.

## Customer workspace

The authenticated `/customers/[id]` surface now follows the canonical Customer overview without inventing a separate customer analytics model.

- The page loads the canonical Customer record plus a bounded fan-out of the most recent eight linked Project details. Individual Project failures degrade locally; if a Project detail fails or the customer has more Projects than the bounded fan-out, the workspace explicitly reports partial coverage instead of treating missing work or money as zero.
- **Needs You** is limited to supported human-attention signals in the loaded customer work: overdue Invoices with a positive balance, stale unanswered Proposals using the existing 14-day dashboard staleness policy, and blocked Project Tasks. Draft Estimates and normal progression do not become attention items.
- **Current work** is derived from real Project status plus the latest available non-terminal Job, Proposal, or Estimate context. The surface does not fabricate completion percentages or unsupported customer-stage fields.
- **Money** aggregates server-derived Invoice `amount`, `paidAmount`, and `balanceDue` across the loaded Project details while excluding voided Invoices from the financial rollup. Partial Project coverage remains disclosed next to the workspace.
- **Upcoming** uses the dispatcher Jobs list filtered by the real `customerId` and the backend-provided current-week time boundary, so scheduled time and assigned-technician names come from the Job/assignment source of truth.
- **Recent activity** is composed only from timestamps already present in loaded Project records: Proposal sent/viewed/responded events, recorded Invoice payments, Site Visit captures, and Project file creation. TradeOS does not synthesize customer messaging history when no such communication contract exists.
- Customer files link back into the authenticated Project Documents workspace; the Customer page does not expose raw Project-file storage URLs.
- Existing Customer edit, portal-link issuance, and soft-delete actions are preserved behind their current permissions. Portal link issuance remains limited to owner/admin/dispatcher/estimator.
- The canonical Figma customer-scoped Athena card is intentionally deferred while contractor Athena is not authoritative on current `main`; the Customer workspace does not link into the operator-only Athena observability route.

No Customer/CRM backend route, schema, permission, RLS, Invoice/Proposal/Job lifecycle, portal-session, or communication subsystem changes are included in this frontend composition slice.

## Costbook domain

The canonical Costbook workspace is implemented across `/api/v1/costbook/*` and `/costbook/*` while reusing the established catalog tables and services instead of creating duplicate pricing subsystems.

Implemented Costbook surfaces include:

- workspace summary
- divisions, categories, and subcategories
- materials
- labor rates
- equipment
- Cost Items
- Assemblies and components, including a versioned 14-recipe residential starter catalog browsed by NAHB work group and classified with CSI section codes. Installation requires an estimator to map every slot to a distinct, active, same-organization Cost Item with a compatible unit and component kind before real reusable Assembly/AssemblyItem records are created atomically; the shared catalog carries no prices.
- calculation-only pricing preview
- Material price audit/history and Estimate pricing snapshots
- supplier-feed proposal/review flow
- regional supplier evidence intake (PR #531): normalized supplier workbooks are staged into tenant-scoped `SupplierProduct` and `SupplierPriceObservation` evidence through authenticated, manager-gated endpoints. Priced, unavailable, and not-listed states are preserved; the importer never changes `Material.unitCost` or creates `SupplierPriceUpdate` rows. The supplied validation bundle contains 8 workbooks, 5,189 products/observations, and 701 unavailable observations; Carter Lumber remains catalog-only because all 670 observations are unavailable.\n- authenticated `/costbook/import` batching for governed composite installed-price benchmarks; its same-origin server proxy checks mutation origin before reading the HttpOnly session, keeps the bearer token server-side, accepts 1–500 row API batches, and the browser import client sends batches of up to 100 rows and up to 80 KiB of encoded request data while preserving the same authorization, tenant scope, validation, and idempotent upsert boundary; any individual encoded row larger than 80 KiB is rejected before upload so an oversized one-row batch cannot cross the backend parser boundary
- bounded search/filter/sort/cursor pagination across canonical catalog collections

Costbook permissions, organization scope, request-scoped sessions, and forced RLS remain the authority for tenant boundaries. Estimate lines preserve source identifiers plus captured `unitCost`/`lineCost` snapshots so later catalog changes do not rewrite historical estimate pricing.

Cost Item and Assembly case-insensitive substring search is supported on both `name` and `code`. The database provides GIN `pg_trgm` indexes for both fields, including `idx_cost_items_code_trgm` and `idx_assemblies_code_trgm`, so the existing `ILIKE '%query%'` code predicates do not rely on the unrelated btree uniqueness indexes.

### Costbook pricing-intelligence UI

The authenticated Costbook frontend now follows the canonical search-first information hierarchy without inventing a universal trust score.

- `/costbook` prioritizes Materials, Labor, Equipment, and Assemblies search/navigation and keeps hierarchy, Cost Items, calculation-only pricing preview, import, and other administration below the primary pricing workflow.
- The landing page may preview recent active Materials, but each preview uses the real stored Material `unitCost`, `supplierName`, and `lastPriceUpdate` only. A missing supplier/date is shown as missing rather than converted into a confidence or freshness claim.
- The shared `PricingProvenance` presentation primitive has separate catalog and research evidence modes. Ordinary Material records do not receive “high confidence”, “verified”, “current local”, placeholder, or stale-age labels from supplier/date alone.
- Research Review retains its richer persisted provenance contract (status, source/reference, observation/retrieval dates, regional basis, confidence) and its existing named-human review + explicit promotion governance.
- No global stale threshold, “price health” count, supplier auto-apply, research auto-promotion, or Athena pricing mutation is introduced.
- `/costbook/assemblies/[id]` now provides the canonical estimator-first Assembly detail using existing tenant-scoped reads only: Assembly identity/scope, per-output-unit recipe quantities, current recursively resolved unit cost, and bounded component count. The page deliberately does not invent sell price, gross margin, job quantity, confidence, or component-level supplier/date provenance because those fields are not returned by the current Assembly detail contract. Estimate-specific use remains inside Estimate Items, where the existing engine captures source identity and pricing snapshots. Assembly composition/edit/deactivate, starter installation, unit-cost resolution, and Estimate snapshot semantics are unchanged.

### Costbook composite installed-price benchmarks (INDOT)

The INDOT ingestion lane adds an organization-scoped reference dataset for installed/composite awarded-bid unit-price benchmarks without changing canonical material, labor, equipment, estimate, proposal, invoice, or customer bill-rate values. `costbook_composite_price_benchmarks` stores source/year/item identity plus low, weighted-average, high, quantity, provenance, geography, and source-row metadata. The table uses forced RLS; reads remain tenant-scoped and writes require the established owner/admin `costbook.manage` boundary. Imports derive organization and importer identity from authenticated request context and upsert idempotently by `(org, source, year, item)`. The authenticated `/costbook/import` surface streams a locally selected normalized file in bounded batches through a same-origin proxy; it does not embed the source dataset or expose the session token to browser JavaScript. INDOT benchmark values are reference evidence only and are never decomposed into invented material/labor/equipment costs or written directly into production pricing.

### Material active/deactivate state

Material catalog rows now carry an `isActive` flag (migration `20260912120000_add_material_active_state`), matching the Division/Category/Subcategory/CostItem/LaborRate soft-delete pattern. `GET /api/v1/costbook/materials` accepts an `active` filter, a PATCH changing `isActive` requires `costbook.manage`, and the authenticated `/costbook/materials` page shows an Active/Inactive status badge with a manager-only Deactivate action. No RLS policy changed: `materials_write_policy` already restricted every material write to the `costbook.manage` boundary.

### S027 production-readiness truth

The implementation that older revisions of this document labeled **Unreleased** is merged repository state:

- PR #257 merged the supplier review concurrency repair.
- PR #260 merged the standardized Costbook catalog query contract.
- PR #268/#271 repaired bounded Supabase/Vercel serverless database pooling and TLS compatibility.
- PR #273 merged the bounded request-transaction acquisition wait.
- PR #274 added the real PostgreSQL `connection_limit=1` contention regression and hermetic timeout coverage.
- PR #278 supplied the production deployment/replay evidence referenced by the S027 readiness record.

The S027 readiness record is now `DONE`. GitHub Actions workflow run `#22` on
`main` at `c7003f3` passed all 36 authenticated route/viewport captures at
**1440 / 1024 / 768 / 390 px**, including keyboard focus, equipment
validation/create/edit/reload/delete, pricing preview, deployment immutability,
and credential scanning. The redacted evidence artifact is `#10042902412`.
The earlier production replay still records the nine canonical Costbook routes
with `200` API responses and no warning/error/fatal entries in the exact-
deployment logs. See `docs/architecture/COSTBOOK_S027_READINESS.md`.

Cold/concurrent Costbook requests in the retained production evidence reached approximately 12.6 seconds in the worst observed case. Treat that as performance follow-up, not as proof of an incomplete response.

### Costbook ↔ Athena boundary

Athena A12 includes three landed **read-only/recommendation-only** Costbook Intelligence tools under `app/modules/athena-tools/costbook`:

- catalog lookup
- margin analysis
- price recommendation

Those adapters call existing `CostDatabaseService` / `AssembliesDatabaseService` methods and shared Estimate formulas. They do not reach Prisma directly, do not define competing pricing math, and do not mutate Costbook or stored pricing state. Athena Costbook writes/autonomous Costbook mutation remain outside the intended module boundary and require separate governance.

### Costbook ↔ Knowledge Engine: provenance status and candidate ingestion contract

The 2026-09-08 audit (`docs/reports/COSTBOOK_KNOWLEDGE_ENGINE_AUDIT_2026-09-08.md`) established that the relational Costbook above and the read-only Knowledge Engine corpus (`packages/knowledge-engine/`) are independent systems with no write path between them, and that the canonical Knowledge Engine cost items carry no provenance/timestamp/confidence trail. The figure previously recorded here as "1,770 of 1,795" was wrong and is corrected as of 2026-09-12: the canonical export holds 1,795 items across 24 categories, **all 1,795** of which lack item-level provenance, and it contains **zero** Tree Service items (the 25 Tree Service files are staged under `packages/knowledge-engine/knowledge/knowledge/cost-items/tree-service/` and have never been merged into `exports/json/costbook.json`). `npm run costbook:audit-provenance` reports the same 1,795/1,795 figure. A follow-up slice landed a provenance-aware foundation without changing either system's pricing:

- Every Knowledge Runtime trade, search result, matcher output, and AI Estimate Assist suggestion/draft line item now carries `provenanceStatus` (`"documented" | "unverified-legacy" | "placeholder"`), defined once in `app/modules/costbook/provenance.ts`. It is resolved per-trade from `packages/knowledge-engine/knowledge/knowledge/trade-progress.json`'s new `provenanceStatus` field, defaulting to `"unverified-legacy"` when missing/unrecognized. All 24 legacy "Stable" trades resolve to `"unverified-legacy"`; Tree Service resolves to `"placeholder"` (its own per-item files self-label `pricingStatus: "PLACEHOLDER"`); no trade is currently `"documented"`.
- `app/modules/costbook/candidateCostItem.ts` defines the governed candidate contract, and `CostbookCandidateService` now persists it through Stage 6's reviewed queue. Candidates remain unapproved until a human `costbook.manage` reviewer records the decision; promotion is explicit, org-scoped, and requires an existing matching Subcategory before it creates new Costbook component rows.
- Stage 6 added the `CostbookResearchCandidate` migration/model, forced RLS, review/promotion constraints, candidate routes, and regression/RLS coverage. No existing production Costbook row or Knowledge Engine price changed, and the Knowledge Engine remains an independent static corpus until Stage 7.

### Costbook Stage 6: reviewed candidate persistence, review, and promotion

A follow-up slice implements Stage 6 of `docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md`: the first real, human-review-gated bridge between a researched candidate and the production relational Costbook.

- New model `CostbookResearchCandidate` (migration `20260908050000_add_costbook_research_candidates`) persists the Stage 5 contract per organization, with forced RLS matching `materials_write_policy` (any org member with `costbook.read` may see the queue; insert/update requires `current_app_can_manage_costbook()`, i.e. owner/admin). Database check constraints independently require a named human `reviewedByUserId`/`reviewedAt` whenever `reviewStatus` is `approved`/`rejected`, and require an approved review plus `promotedAt`/`promotedByUserId` whenever `promotedCostItemId` is set — defense in depth alongside the application-layer `isEligibleForCostbookPromotion()` gate.
- `app/modules/costbook/candidateCostItemService.ts` (`CostbookCandidateService`) adds `create`/`listPage`/`getById`/`review`/`promote`. `review()` records `reviewedByUserId` as the authenticated caller's real user id — never a free-text field, so a synthetic reviewer identity like `"AI"` or `"system"` cannot be recorded. `promote()` re-checks `isEligibleForCostbookPromotion()` against the persisted row inside a transaction serialized by a per-candidate Postgres advisory lock (never trusting `reviewStatus` alone), requires an existing Subcategory in the organization matching the candidate's `category` (422 if none — it does not invent Division/Category/Subcategory structure), and writes exclusively through the existing `CostbookService.createMaterial`/`createLaborRate`/`createEquipment` and `CostDatabaseService.create` methods — no parallel pricing store, no direct Prisma writes to production tables from this module.
- New routes under `/api/v1/costbook/candidates` (`GET`/`POST` list+create requiring `costbook.write`/`costbook.read`, `GET /:id`, `POST /:id/review` and `POST /:id/promote` requiring `costbook.manage`, mirroring supplier-integration's approve/reject boundary). See `docs/API_REFERENCE.md`.
- AI may prepare and submit candidates (as an authenticated owner/admin-permissioned caller); AI may never approve or promote one — both actions require an authenticated human's `costbook.manage` session, and the reviewer/promoter identity is always that user's real id.
- No existing production `CostItem`/`Material`/`LaborRate`/`Equipment` row is modified by this slice; promotion only ever creates new rows from an already-approved candidate. No Knowledge Engine export data changed. Stage 7 (regenerating the Knowledge Engine corpus from governed Costbook data) remains unimplemented.

### Costbook item/assembly provenance trust layer (2026-09-11)

The reconciled provenance slice extends the existing trade-level trust marker without changing any pricing value:

- Cost-item and assembly schemas accept the same nine optional provenance/source fields: `provenanceStatus`, `sourceName`, `sourceUrl`, `sourceIdentifier`, `sourceDate`, `retrievedAt`, `confidence`, `reviewedBy`, and `reviewedAt`.
- Knowledge Runtime resolves record-level provenance when present, otherwise preserving the existing trade-level fallback. Invalid provenance/confidence values and blank optional metadata are ignored rather than promoted into trusted output.
- AI Estimate Assist suggestion and structured-draft records expose optional `provenanceDetail`, and the UI shows the status/source/date/confidence context without changing the match-confidence score or pricing decision.
- The new-batch approval/validation pipeline requires provenance fields for newly submitted cost-item batches; existing canonical data is not rewritten.
- `npm run costbook:audit-provenance` is wired into repository CI as a structural audit. Missing source metadata remains an explicit warning; structural corruption fails the check.
- Coverage remains deliberately honest: the current canonical corpus has no real item- or assembly-level source citations populated, so the new detail fields remain absent until authoritative/licensed or qualified-estimator-reviewed data is supplied.

### Costbook research review: normalization, matching, UI, and promotion audit (2026-09-12)

A follow-up slice closes the pipeline gap between the landed Stage 6 candidate
queue and a reviewer who can actually use it. No schema change was required:
the existing `CostbookResearchCandidate` model, its forced RLS policies, and
its review/promotion check constraints already cover this work.

- **Stage 3 landed.** `app/modules/costbook/knowledgeCandidateNormalizer.ts`
  converts a Knowledge Engine corpus record into a typed candidate, and
  `app/modules/costbook/candidateMatch.ts` performs deterministic duplicate
  analysis (`new-candidate` / `probable-match` / `ambiguous-match` /
  `conflict`) with signed price deltas. Both are pure — no Prisma, no
  organization, no I/O — so neither can mutate Costbook state. An ambiguous or
  conflicting match deliberately names no target, so name similarity alone can
  never steer an overwrite.
- **Fails closed, and fabricates nothing.** Normalization refuses any record
  missing a cited source, source date, retrieval timestamp, confidence, a
  supported unit, or a usable cost, and reports machine-readable block reasons
  instead of defaulting the missing field. A record that asserts no source
  stays `unverified-legacy`. Because the corpus carries no per-item market
  field, `regionalBasis` is recorded as an explicit national/default basis
  rather than presenting national research as local pricing.
- **New read-only endpoints.** `GET /api/v1/costbook/candidates/summary`
  (real per-organization queue counts), `GET .../candidates/corpus-report`
  (deterministic classification of the shared corpus), and
  `GET .../candidates/:id/match` (duplicate analysis through the canonical
  `CostDatabaseService`). `POST .../candidates/from-knowledge`
  (`costbook.write`) ingests a single corpus item as an unreviewed candidate or
  fails with 422 naming the missing evidence. Ingestion can never approve or
  promote.
- **Promotion audit trail.** Review and promotion now append an immutable
  `ActivityEvent` (`entityType: "costbook_research_candidate"`) inside the same
  transaction as the decision, recording the reviewer, the outcome, the
  provenance that justified it, and the Cost Item a candidate became. Reusing
  the existing org-scoped, RLS-protected activity feed rather than introducing
  a second audit store.
- **Review UI.** `/costbook/research-review` is the first real human review
  surface for researched pricing. Every count comes from live data; an empty
  queue reports zeroes. The detail panel shows complete provenance beside the
  current Costbook price and the difference. Approve, reject, and promote
  render only for `costbook.manage`; read-only viewers get a truthful
  explanation rather than disabled controls. The forms submit no reviewer
  identity or organization id — the API records the authenticated caller.
- **Nothing historical moved.** Promotion only ever creates new rows, so no
  existing `Material`, `CostItem`, `LaborRate`, `Equipment`, estimate snapshot,
  proposal, contract, or invoice price changed, and no Knowledge Engine export
  data changed. Stage 7 (regenerating the corpus from governed Costbook data)
  remains unimplemented.

Honest coverage note: because **no** Knowledge Engine item currently carries a
cited source, the corpus report returns 1,795 total / 0 documented / 0
candidate-ready, and `POST .../candidates/from-knowledge` correctly rejects
every item in the canonical corpus today. The end-to-end ready path is proven
by deterministic fixtures, not by a claim that the research corpus is usable.

### First real-source trade proven end to end: Jones & Sons Terre Haute aggregate (2026-09-14)

The Costbook research pipeline now has one real cited material slice wired through the canonical candidate path: the two branch-verified Jones & Sons Terre Haute aggregate records. `app/modules/costbook/jonesAndSonsIngestion.ts` serializes ingestion per `(orgId, sourceIdentifier)` with a transaction-scoped advisory lock, checks for an existing candidate inside the same RLS-bound transaction, and creates only candidate-state rows. The operator script derives the actor from active organization membership; it never reviews or promotes records. PostgreSQL integration coverage includes same-organization concurrent ingestion, tenant isolation, review, promotion, and source/audit provenance. No live tenant population is claimed; a real operator run and human review/promotion remain separate actions. See `docs/reports/JONES_AND_SONS_TERRE_HAUTE_INGESTION_2026-09-12.md`.

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

Customer-portal invitations are delivered through the server-side
transactional email adapter. The emailed GET is non-consuming: it places the
validated opaque token into a ten-minute HttpOnly cookie restricted to the
access path and redirects to a token-free confirmation page. Redemption occurs
only after an exact-origin confirmation POST, which prevents automated email
link scanners from spending the single-use invitation; that POST clears the
pending cookie before redirecting to the portal or access-error flow.

Customer-portal server API reads preserve structured backend errors, normalize non-JSON upstream failures into the portal failure path, and reject malformed successful responses explicitly instead of leaking raw parser exceptions.
The portal redemption web route now fails closed when the backend exchange returns an absent, malformed, or expired session payload or fails before returning a response. It clears the pending invitation and creates no session cookie in these cases. Focused service and web tests cover more replay, expiry, malformed input, draft exclusion, and document-scoping denial paths; current-head authenticated browser and live RLS certification remain pending, so S059 is not complete.

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
- governed first-party plugin/runtime boundaries through A13
- A14 channel-aware voice/mobile readiness primitives

Athena business tools must preserve service ownership and existing authorization/RLS boundaries. Direct Prisma access from tools, duplicate domain logic, and autonomous Costbook mutation remain outside the intended module boundary.

### Contractor Athena workspace

The authenticated web route `/athena` is now the contractor-facing Athena Workspace rather than the owner/admin observability dashboard. It uses one browser kernel client over the existing `POST /api/v1/athena/chat` contract, carries optional validated selected scope (`customerId`, `projectId`, `jobId`, `estimateId`, `invoiceId`, and bounded page context), and renders the kernel's real summary/message, warnings, follow-ups, clarification, degraded, denied, timeout/failure, and telemetry-reference states. The app navigation exposes this contractor workspace to authenticated users; individual Athena tools continue to enforce their existing permission/risk/service boundaries.

Owner/admin observability is preserved at `/athena/ops`. Existing operator subroutes for approvals, traces, tool health, model/cost, and events/DLQ remain operator-gated and their Overview link now targets `/athena/ops`.

The contractor UI does not fabricate data the chat response does not expose. The current kernel result does not include a provider-by-provider “context used” list, so the workspace shows selected-scope/write-path/authority trust statements but does not claim which context providers were used. The platform also has no durable contractor conversation/session lifecycle behind the optional `conversationId` reference, so the workspace does not invent or send one; visible turns are page-local UI history only. When the kernel returns `needs_clarification`, the workspace surfaces at most one question at a time. When it returns `awaiting_approval`, the workspace states that confirmation is required but does not simulate approval or perform a direct business write; plain-language contractor confirmation cards remain a bounded follow-up over the durable approval contract.

Repository implementation does not prove Athena is enabled in a deployed environment. `ATHENA_KERNEL_ENABLED` and deployment configuration remain authoritative.

### A14 voice/mobile readiness

A14 extends the existing Athena kernel rather than creating a second assistant or
channel-specific execution engine. The request contract can carry additive safe
interaction metadata for text, mobile, or voice. Voice can be disabled
independently with `ATHENA_VOICE_ENABLED` without disabling text/mobile Athena.
The request-scoped voice registry view only narrows the existing A2/A12 tool
surface: medium/high-risk tools are unavailable through the voice-only path,
while low-risk tools with contextual confirmation bind confirmation to the exact
registered tool/version and A6 canonical validated-input hash.

The A14 mobile C010 provider delegates selected-job reads to `JobsService`, so
existing actor scope and forced RLS remain authoritative. It exposes only
minimized field context (job identity/status/priority, city/state, schedule
windows, selected page) and omits customer contact details, full street address,
and assignment identity. The backend does not accept or persist raw audio. A14
is backend readiness infrastructure; it does not claim a production speech
provider integration, offline autonomous execution, or production enablement.

The A14 post-merge correctness repair aligns runtime behavior with those
contracts: an unconfirmed contextual voice action returns a kernel-level
`needs_clarification` challenge before A6/idempotency, so the confirmation pass
cannot be persisted or replayed as a completed action; the mobile provider
remains `explicit_only` and is requested only for `mobile`/`voice`, not ordinary
`text`; and the assembled bounded context is carried forward into both tool
execution and the model-provider seam. These changes do not broaden authority,
tenant scope, or PII exposure.

Repository merge state does not by itself prove Athena is enabled in production; feature flags and deployment configuration remain authoritative.

## Security and tenant-boundary posture

Current repository architecture uses authenticated request context plus organization membership authorization, request-scoped database sessions, and forced PostgreSQL RLS as layered tenant protection. Route/service permission checks remain defense in depth rather than a substitute for database isolation.

Security-sensitive maintenance already landed includes:

- local refresh-token rotation/revocation hardening
- Supabase JWT claim/lifetime validation
- organization bootstrap/RLS lookup repairs
- tenant-boundary regression coverage
- protected storage/server-action session checks
- managed project-file Storage is private by default; browser-facing links for storage-backed photos and documents use a same-origin binary proxy that authenticates the session, resolves the requested project through the tenant-scoped backend, verifies the file belongs to that project, and only then downloads the exact metadata-backed object with server-only Storage credentials. Public object URLs require the explicit `SUPABASE_STORAGE_BUCKET_PUBLIC=true` opt-in; missing, false, or unrecognized values fail closed. Legacy files without managed `storagePath` metadata retain their previously saved URL.
- project-file Storage deletion resolves tenant-scoped metadata and completes the `crm.write`-protected metadata delete before removing only exact generated, project-scoped Storage objects; ambiguous metadata-create failures preserve Storage so a late commit cannot point at deleted data, and cleanup failures abort instead of reporting a successful deletion
- bounded database transaction acquisition under serverless contention
- safe audit/security event capture
- exact-origin enforcement for cookie-backed `POST`/`PUT`/`PATCH`/`DELETE` calls through the generic authenticated Next.js API proxy before the HttpOnly session is read or translated into a backend bearer token; safe read methods remain unchanged
- browser-side same-origin API response handling normalizes non-JSON proxy/upstream failures into `ClientApiError` with the HTTP status preserved and treats malformed successful responses as explicit API contract failures rather than leaking raw parser exceptions
- server-only staff API response handling preserves structured backend error status/details, normalizes non-JSON upstream failures into `ApiClientError`, and treats malformed successful responses as explicit API contract failures rather than leaking raw parser exceptions
- Stripe Billing webhooks are mounted before JSON parsing, verify the exact raw body against `Stripe-Signature` with timestamp tolerance and timing-safe HMAC comparison, atomically claim event IDs for idempotent retry handling, hydrate authoritative subscription state, and enter an explicit tenant RLS context only after resolving `tradeos_org_id` from Stripe metadata

The authenticated-proxy origin check closes the same-site sibling-origin CSRF gap that `SameSite=Lax` cookies do not cover by themselves without changing backend JWT, membership, permission, or RLS policy.

This document does not treat a passing unit test or route-level organization predicate as equivalent to RLS evidence where the repository requires PostgreSQL-backed verification.

## Deployment and beta-evidence posture

Repository state and production state are separate evidence domains.

Known retained deployment evidence includes the S027 production Costbook replay described above and later production/auth fixes recorded by their owning PRs. Exact release-candidate browser evidence, environment configuration, credentials/storage states, and retained multi-viewport artifacts must be proven through the approved deployment/evidence workflows rather than inferred from merged code.

The Stripe Billing implementation in PR #491 is repository/preview work until its migration is applied and sandbox environment configuration is complete. The connected Stripe sandbox already has the four subscription products and eight monthly/annual prices, but the current integration still requires a runtime Stripe API credential, webhook endpoint/signing secret, `TRADEOS_APP_URL`, and an active sandbox Customer Portal configuration before end-to-end Checkout/renewal/cancellation evidence can be retained. Live-mode price IDs/secrets must be configured explicitly; production code refuses to fall back to sandbox price IDs.

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

## Canonical invoice workspace

The authenticated invoice detail at `/projects/[id]/invoices/[invoiceId]` now follows the canonical Money/Invoice workspace rather than a stack of equally weighted administration cards.

- The page leads with server-derived Invoice total, recorded paid amount/payment count, and balance due. It does not recompute a competing running balance in the browser.
- Billing/customer/job context and work-performed line items remain visible in the main record surface; Invoice activity continues to use the existing sanitized timeline contract.
- When an eligible sent/overdue Invoice has a positive balance, **Record Payment** is the dominant billing action for users whose role matches the backend `billing.write` grant. The existing role-list regression remains locked to the backend permission map.
- Record Payment explicitly means logging money already received. The workspace states that recording a Payment does not mean TradeOS processed the customer's payment.
- Manual `mark paid without recording a payment` and Invoice voiding remain supported existing actions, but are progressively disclosed under **More billing actions** instead of competing with the normal payment-recording path.
- The real Invoice PDF and staff Customer Portal preview remain available from the Document panel. Customer-view telemetry is not claimed because the current product does not record it.
- Draft Invoice send behavior, Payment reconciliation, status derivation, organization/tenant scope, RLS, and backend lifecycle semantics are unchanged.

The Money page's Expense receipt-capture design remains `[TARGET]` in canonical Figma and is not implemented by this slice.

## Customer portal project workspace

The public project workspace at `/customer-portal/projects/[id]` follows the canonical document-focused portal composition without expanding capability. It presents verified customer/project context, the latest shared Proposal and Contract, every returned Invoice, and a Money summary built from active, non-voided Invoice `amount`, `paidAmount`, `balanceDue`, and recorded-payment rows. Voided invoices remain visible as document history but are excluded from current Money totals. Public Proposal review remains read-only. Pending Contracts link to the existing customer-signing route; signed and voided Contracts are described according to their actual status. Messaging, project progress/photos, schedule updates, customer change-order approval, and Pay Now remain unavailable. ADR-010 access-token/session/replay/revocation certification remains a separate evidence lane.

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

- S036's active JobAssignment lookup index is merged in PR #476
  (`96caffc8877f77b96f8c3ae099d147c839be355f`). It targets the S035-observed
  dispatch queue assignment scan with a partial `(org_id, job_id)` index for
  non-removed, non-declined assignments. The migration is repository-complete
  but remains unapplied to production until its attached isolated before/after
  plans, measured write-cost, rollback rehearsal, and production cost budget
  are accepted. The selective synthetic fixture shows a conditional plan
  benefit; the representative fixture does not select the index.
- Persisted organization-wide Costbook pricing-policy/rule governance is not implemented; `/costbook/pricing` remains calculation-only preview behavior.
- Supplier feeds remain review-first and do not auto-apply prices; supplier-SKU matching and provider-specific connector depth remain future work.
- Athena Costbook writes/autonomous pricing mutation are not implemented.
- Stripe Billing sandbox runtime configuration is incomplete until an API credential, webhook-signing secret, webhook endpoint, app URL, and active Customer Portal configuration are installed and exercised. Stripe Connect/direct contractor customer payments remain a separate follow-up integration and are not provided by PR #491.
- Production environment values, Preview isolation, runtime-authenticated RC sessions, and multi-viewport browser artifacts must be verified externally rather than inferred from repository state.
- Settings brand-asset uploads use a shipped S017 orphan reconciler: stale generated, non-current objects can remain in private Storage until an authorized operator runs the dry-run-by-default cleanup after the 24-hour grace period. No automatic cleanup scheduler exists by design.
- The residential Assembly Catalog now pins catalog/recipe metadata and quantities, publishes its NAHB/CSI coverage matrix, validates Cost Item unit/type compatibility on both client and server, and installs within an explicit transaction that composes with the active request transaction. Live RLS integration coverage verifies tenant-scoped starter installation and cross-tenant rejection. Authenticated rendered browser evidence and qualified-estimator expansion beyond the 14-recipe baseline remain outstanding; see `docs/architecture/ASSEMBLY_CATALOG_IMPLEMENTATION.md`.

## Canonical sequencing

Numbered-sprint eligibility and ordering are owned by `docs/SPRINT_BACKLOG.md` and the repository reconciliation protocol. `CURRENT_STATE.md` describes implementation truth; it does not override the backlog, readiness plans, ADRs, or completion-evidence records.

## Module documentation

See `docs/modules/` for the maintained domain/module records and `docs/architecture/` for readiness plans, ADRs, and completion evidence.

## Web password recovery

The web forgot-password flow uses Supabase Auth recovery: the recovery request is sent through Supabase, `/auth/confirm` exchanges the PKCE or token-hash link for a server-side session, and the reset form updates the Supabase password. Legacy backend-token reset links remain supported. This avoids requiring the web recovery flow to reach Prisma or the backend Resend adapter.
The callback attaches Supabase recovery session cookies directly to its redirect response before navigating to `/reset-password`, preventing the reset form from losing the recovery session between requests. After a successful exchange it resolves the authenticated Supabase user server-side and stores that verified `user.id` in the short-lived HttpOnly `tradeos-recovery` marker. `/reset-password` requires that same live user before rendering the native form or updating the password, so a stale marker, unrelated sign-in session, or unresolved recovery identity fails closed. Malformed or unrecognized recovery callbacks log only a static diagnostic; recovery query strings, PKCE codes, and token hashes are never written to server logs.

`/reset-password` verifies a valid recovery session server-side (the `tradeos-recovery` cookie set by `/auth/confirm`, or a legacy invite token) before ever rendering the password form. A missing session, or an `?error=` from a failed `/auth/confirm` exchange (expired, reused, or scanner-consumed link), renders a recovery-error card with a link back to `/forgot-password` instead of the form — the form is never shown to a caller without a valid session. `resetPasswordForEmail`, the `/auth/confirm` exchange, and `updateUser` each log their real Supabase error server-side (`console.error`) on failure while returning a generic, safe message to the client.

## Dashboard weather compatibility seam

The standing dashboard weather selector in `web/src/lib/dashboard-weather.ts` remains intentionally disabled until adverse-weather handling is owned by the scheduled exterior-job needs-attention queue. It preserves its typed input contract and returns `null` without issuing Census or NWS requests; the follow-up lint cleanup is behavior-neutral.

## RC beta evidence validation — 2026-09-05

- Beta Evidence run `33945411532` completed successfully against the approved non-production RC preview with deployment SHA correlation to `ee2300a438311e50f6813510578c125073a1f850`. Authentication, tenant isolation, 1440/1024/768/390 browser captures, downstream contractor workflow, artifact validation, and credential scanning all passed.
- The validated contractor path creates a customer and project, builds and finalizes an estimate, transfers the exact customer-facing price into a proposal, sends and accepts it, creates a contract, and creates an invoice with the accepted `$7,105.07` total.
- RC defects repaired for promotion are browser API proxy path normalization, proposal cents preservation, invoice Decimal-to-number display normalization, and mobile `PageHeader` wrapping that removes 390px horizontal overflow.
- Custom estimate line items are valid without a Costbook source. Migration `20260905050000_allow_custom_estimate_line_items` changes the database invariant from exactly-one-source to at-most-one-source, preserving mutual exclusivity while allowing source-less custom lines.
- Tenant-isolation evidence now asserts denial at the authenticated same-origin API proxy/backend boundary (403/404 required) and treats the browser page as a secondary UX signal, avoiding false failures from Next.js error boundaries that can retain an outer HTTP 200 after a denied server-component fetch.

## Customer portal issuance

The authenticated contractor customer detail workflow now exposes the existing staff portal-link issuance endpoint. Authorized staff can create a single-use, expiring customer-scoped link, copy it once, and share it through the controlled UI. Customer redemption, session scoping, portal reads, and revocation remain on the existing security boundary; email delivery remains follow-up work.


## Today command board

The owner dashboard is now the canonical Today command surface rather than a dashboard-plus-widget-stack. The page-level header identifies Today first, keeps company/freshness context secondary, and the landing route renders one four-part operational rhythm: **Now / Needs you / Coming up / Money**.

- **Now** owns work already moving and normal resumable progression: today's scheduled Jobs, draft/ready Estimates, Continue Working stages, and Project-backed work that is ready to begin estimating.
- **Needs you** is exceptions-only. It currently contains stale Proposal follow-up and overdue Invoice action; ordinary draft Estimates, non-stale sent Proposals, not-yet-overdue Invoices, and normal next workflow steps do not appear there.
- **Coming up** is sourced from real scheduled Jobs after today's organization-timezone boundary through the end of the backend-provided current-week window. It is not an unscheduled-work or Continue Working bucket.
- **Money** is a receivables summary over canonical Invoice/payment truth. It does not create a parallel Money ledger or link to a nonexistent organization-wide Money route; overdue action stays in Needs you, with direct Invoice detail available when one is loaded.

The previous task board, recent-activity feed, Knowledge Runtime diagnostic card, recent-project lifecycle card, KPI tile wall, and standalone receivables/schedule panels are not rendered below Today. Their dedicated underlying workspaces remain available. The landing page also no longer loads task/activity, Knowledge stats, payment-ledger, or weather data solely for removed dashboard modules. Schedule, Estimate, Proposal, and Invoice source failures degrade locally inside the command surface instead of replacing healthy sections.


## Universal creation entry point

The mobile Control Dock Create action now opens a keyboard-accessible bottom creation sheet instead of navigating directly to project creation. Estimate from scope is the featured first action, followed by Job, Customer, Invoice, Change Order, and Schedule; each option reuses an existing production route and closes the sheet before navigation. The existing More sheet behavior and Control Dock touch targets remain unchanged.


## Estimates primary workflow

Estimates are now a first-class authenticated workspace at `/estimates`, backed by the existing organization estimate queue and linking directly into project estimate builders. Desktop primary navigation keeps Today, Dispatch, Projects, and Estimates visible together; lower-frequency Customers and Costbook remain available in secondary navigation. The universal Create sheet's featured Estimate from scope action lands on project intake with the scope field emphasized and ready for plain-language entry. No estimate or queue API contract changed.


## Estimate workbench composition

The estimate builder now presents a continuous desktop workbench rather than a stack of independent metric and totals cards. A compact summary rail keeps Job Cost, Sell Price, Gross Profit, and Margin visible; the editable line-item workspace receives the dominant area; and the pricing inspector remains sticky beside it. Existing Costbook search, custom lines, pricing mutations, finalization, and estimate state remain unchanged. The mobile staged workflow and contextual Athena/assembly work remain the next estimating pass.


## Mobile estimate stages

The estimate builder provides the canonical mobile staged path—Scope, Items, Price, and Review—rather than collapsing the desktop workbench into one column. Scope is now editable in place and persists through the existing partial Project PATCH using `simpleScope`; the same current draft is passed to contextual Athena. Items remain the single production list and now expose only the source identity the persisted estimate line actually carries: Assembly source, Costbook source, or Custom item. Price keeps the existing authoritative pricing controls. Review remains customer-facing while preserving the real lifecycle: draft estimates finalize first, then create a proposal; the UI does not pretend a draft estimate can directly send a proposal.

Leaving Scope through the dominant Continue action or a stage tab now waits for the existing Project `simpleScope` PATCH when the draft differs from the persisted scope. A failed save keeps the contractor on Scope and surfaces the mutation error, so Review and proposal creation cannot silently use different wording. Each mobile stage keeps one dominant bottom action above the Control Dock with safe-area spacing. Stage language is normalized to Scope → Items → Price → Review with Continue to items / Continue to price / Continue to review. Persisted estimate lines do not currently carry the pre-apply Athena provenance detail, so the Items surface does not fabricate documented/unverified trust badges after apply.

## Contextual Athena in estimating

The estimate builder includes an embedded Athena context panel beside the desktop pricing inspector and within the mobile Scope stage. It uses the existing reviewable suggestion contract to surface assembly and Costbook matches, confidence, provenance warnings, and explicit setup-required states without applying anything automatically. The full review route now uses contractor-facing Athena terminology while the internal API/type names remain unchanged. Estimate Engine mutations remain authoritative.

The canonical one-question clarification interaction is still a real product gap. Structured estimator output can report missing information, but production does not yet expose a persisted one-question-at-a-time answer/regenerate contract, so the mobile UI explicitly does not simulate that behavior.

## Contextual Athena provenance clarification

Contextual Athena now labels legacy Costbook matches as “Unverified pricing” in addition to placeholder pricing warnings, matching the full AI Estimate Assist provenance language. This is presentation-only; source trust remains review-first and no estimate records are applied automatically.

## Assembly pre-install cost preview

The starter assembly mapper now provides a read-only pre-install cost preview after every required slot is mapped. It resolves each selected same-organization Cost Item through the existing unit-cost endpoint, shows cost per assembly unit, accepts an output quantity for a job-cost estimate, and exposes loading/unavailable states. The preview does not create, mutate, or apply pricing; installation remains an explicit review-first action.


## S064 embedded Assembly Picker — active implementation

The Estimate Items picker now treats assemblies as a first-class embedded estimating choice rather than a bare search result. Installed organization assemblies can resolve their current unit cost and a bounded component preview through the existing Costbook assembly APIs; the picker shows the selected quantity's estimated job cost, persisted assembly identity, and an explicit provenance/trust note before the contractor chooses **Add**. The authoritative write remains the existing Estimate Engine line-item endpoint, and a successful add invalidates the current estimate query so Items and totals refresh in place.

The same search now includes TradeOS starter assembly recipes that are not already installed. These results are explicitly labeled **Setup required** and expose the recipe slots/quantities and reviewed starter-catalog provenance. Each slot can be mapped inline to an active compatible Costbook item; duplicate or unit/type-incompatible mappings fail closed, mapped Cost Items resolve a read-only pre-install cost preview, and installation uses the existing tenant-scoped starter-catalog install contract. Installation does not write the estimate line: after install the picker converts to the real organization assembly, resolves its current assembly cost, and still requires the contractor to use the separate explicit **Add** action. TradeOS does not invent Cost Item mappings or a price. Core S064 search → setup → preview → install → explicit add → refresh behavior is now implemented on PR #624; final verification, responsive evidence, and any reproduced defects remain before completion.

## Sprint execution / certification separation — 2026-10-02

External browser/deployment availability is no longer a global development mutex. When a sprint's implementation is merged and repository-verified but its final authenticated evidence is blocked only by the non-production evidence environment, that sprint remains incomplete (`IN_REVIEW`) and release certification stays blocked, while independent downstream implementation may continue against the landed contract. Reproduced product defects and auth/RBAC/RLS, tenant-isolation, schema/migration, financial-correctness, or unresolved product-policy failures remain hard blockers and are not covered by this exception.

Under this rule S053 remains `IN_REVIEW` until its full authenticated browser run passes; S064 is the current `READY` implementation sprint. No S053 release-certification claim is implied.

## S053 structured estimate-assist

The estimate-assist frontend now stages structured scope-to-estimate drafts through the existing `/ai-estimator/draft` and `/ai-estimator/apply` contracts. Draft generation remains review-only; accepted lines retain backend review-token, draft-status, organization-target, idempotency, and Estimate Engine safeguards. Authenticated browser certification at 1440/768/390 remains pending.


## Schedule / Dispatch workspace

The existing authenticated `/dispatch` route now defaults to the current contract-backed Schedule workspace rather than the legacy attention table. Plain `/dispatch` renders the organization-timezone-aware Day view; `?mode=week` uses the backend-provided week boundary; and `?mode=crew` groups real scheduled work using stable sorted technician identities while displaying technician names. All three views are derived from `GET /api/v1/jobs` plus `GET /api/v1/jobs/dispatch-summary`; they do not maintain a second client calendar store.

A persistent Unscheduled tray comes from the existing Job `unscheduled` state and visibly discloses its six-row display bound when more Jobs exist. Schedule cards reuse the existing dispatcher actions for assignment, schedule/reschedule, dispatch, conflict preview, and authorized override behavior. The prior attention/all/invoice-ready work queue remains available through `/dispatch?view=...`; attention pagination keeps an explicit queue discriminator so page-one navigation does not fall back to the Day board.

This is an interim production composition, not a claim that Schedule has an approved canonical calendar-grade visual. `.stitch/DESIGN.md` still classifies Schedule visual authority as partial/pending approval. The UI does not imply drag/drop persistence, GPS/live location, route optimization, external calendar synchronization, or automatic conflict resolution. The current dispatcher assignment editor still requires a technician user UUID because the only existing organization-member list exposed to the web Settings contract is owner/admin-only; widening that read boundary is not part of this slice.

## Mobile Field Workspace

The mobile technician field workspace now presents today's assigned jobs through a current-job-first mobile layout with schedule/arrival context, service address directions, job briefing, bounded lifecycle actions, equipment disclosure, and a dedicated report-back notes area. This remains a frontend refinement over the existing authenticated technician and job APIs; no new backend endpoint or data model is introduced.

Current-job selection is lifecycle-aware: On site, Traveling, Paused, and Dispatched work ranks ahead of Scheduled/Unscheduled and terminal Completed/Cancelled records while preserving the server's existing schedule ordering inside a lifecycle tier. The selected-job workspace uses a section landmark inside the app shell rather than nesting a second `main`, and the dominant mobile lifecycle action is viewport-fixed above the Control Dock so it remains reachable while the technician moves through briefing and report-back content.


## UI branch reconciliation — 2026-10-02

A current-`main` reconciliation pass recovered four contractor-facing UI slices from stale branches without merging obsolete branch history:

- Estimate Workspace contextual Athena suggestions remain review-first and can now be explicitly added to the current estimate; a successful acceptance refreshes the estimate Items/totals on desktop and mobile.
- Universal Create preserves current Project context for Job, Invoice, and Change Order creation, otherwise routes through an intent-aware Project chooser; Schedule opens real unscheduled work and Ask Athena carries current page/Project context only when Athena is enabled.
- Athena Workspace uses the focused two-column hierarchy from the later UI polish pass without replacing the recovered canonical workspace.
- Schedule/Dispatch presents the same real Jobs and conflict-aware actions with a flatter action-workspace hierarchy rather than nested card chrome.

The older `feature/ui-review-mobile-field-workspace`, `feat/canonical-athena-workspace`, and `feat/canonical-crm-workspace` branches were not merged wholesale: current `main` already contains newer Field Workspace behavior and the recovered Athena/CRM implementations from PRs #588 and #587.


## S062 Universal Create reconciliation — 2026-10-02

PR #615 merged the shared Universal Create route contract and context-aware entry routing. Current `main` now keeps existing Project context for Job, Invoice, and Change Order entry, routes context-free versions through the Project chooser, opens Schedule on the real unscheduled queue, and carries current page/Project context into Athena when enabled.

S062 is implemented on `main` through merged PR #629 for the two authorized continuity gaps:
- Customer creation now keeps the exact persisted Customer returned by the existing CRM create route and uses that server-owned id to continue into `/customers/{customerId}`; duplicate-review and tenant/auth behavior are unchanged.
- Context-free Create → Job now preserves only the validated `job` continuation through Project creation and redirects the newly created Project into `/projects/{projectId}/jobs/new`. Estimate continuation remains unchanged, and invoice/change-order creation behavior is not broadened.

The implementation reuses the existing CRM/Project APIs and Universal Create destination helper; it adds no backend route, schema, migration, auth/RBAC/RLS, billing, or payment change. Focused unit coverage pins created-Customer identity handoff and allowed new-Project continuation intents. The implementation PR merged as `6f6a0a6567c1413c837afc86b943c1c45f5f03e0` after exact-head Web/docs/governance checks passed. S062 remains `IN_REVIEW` until authenticated browser, permission/tenant-negative, and state-refresh evidence for its owned journey is retained. S052/S056/S058 remain separate release-certification prerequisites; no browser-certified release claim follows from this merge.


## S063 CRM continuity readiness — 2026-10-03

The existing Project-backed Lead and Site Visit flow (PR #582), Customer connection (PR #586), and /crm operating overview (PR #587) are already on main. S063 must extend those sources. Today /crm shows the first Project per mobile pipeline lane, up to five per desktop lane, and the first five incomplete Project Tasks. Its task DTO carries assignedTo but the overview does not show ownership. Proposal Sent and Awarded are already derived from Proposal/Project truth; CRM does not own acceptance mutations. PR #631 is the S063 implementation lane for complete bounded access/navigation, truthful existing Task ownership, and awarded-Project handoff. The branch displays all loaded follow-ups (the API read remains capped at 50), makes every loaded pipeline Project reachable on desktop/mobile, links Task rows to the Project Tasks tab, and labels Awarded links as canonical Project destinations. No new CRM persistence or lifecycle is authorized. This is branch implementation, not a merged or browser-certified claim.

## S061 Today structural completion reconciliation — 2026-10-02

PR #585 already shipped the canonical Today page structure now present on current `main`: `OwnerDashboardHeader` plus one `TodayCommandBoard` with **Now / Needs you / Coming up / Money**. The old repeated task/activity/Knowledge/KPI/widget regions are absent, compact action rows remain the dominant interaction, and unavailable/partial data stays explicit. S061 is implementation-complete but remains `IN_REVIEW` until S060 supplies its separate live-data/multi-viewport release certification.
