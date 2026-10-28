---
status: current
owner: platform
last_verified: 2026-10-20
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
  - app/prisma/migrations/20261007031500_add_supplier_refresh_token_vault
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

# TradeOS Current State

## Web performance telemetry — PR #744

The Next.js root layout includes Vercel Speed Insights for browser performance
measurements. The dependency is scoped to `web/`; the JSON-only Express API
does not load a browser telemetry SDK. This does not certify production metrics
collection or enable the optional service in the Vercel project dashboard.


## API validation security prerequisite — 2026-10-27

Existing PR #795 is extended to repair the dependency audit blocking Today 2.0 PR #798. The isolated runtime branch retains dotenv/Vercel patch updates, adds patched Zod 4.6.7 including Vercel's transitive validator, and includes body-parser 1.20.9 from #799. The previous identifier syntax contract is preserved using `z.guid()`; record and enum pipeline compatibility repairs do not alter JWT/membership, permissions, RLS, financial or supplier policy. No production change or merge is claimed. Full verification and PR-only major-upgrade review remain required; the independent moderate ip-address patch is tracked by #786. See [runtime upgrade evidence](architecture/API_VALIDATION_RUNTIME_UPGRADE.md).



## Today 2.0 implementation branch — 2026-10-26

PR #798 continues on `feat/today-2-command-center` (`EXISTING_WORK_FOUND`, Sprint ID NONE). Today, Needs You and Work share authenticated source data, operational indicators, contextual source workspaces, semantic themes and the persistent five-slot Control Dock. Previous head `fdcc63cc6c6a28d94c8642e9e821857fda729960` passed 518 frontend tests, 20 Chromium component tests and hosted PostgreSQL integration/migration rehearsal (run 40427077847). Its real Vercel Preview is READY; unauthenticated dashboard redirect to login was observed. Secure sign-in was declined, so authenticated live-data journeys remain unverified.

The current continuation adds task-status editing to the contextual workspace for existing `crm.write` roles, using the established authenticated project-task PATCH endpoint and its transactional activity record. Controls require a structured source task/project target and canonical write permission. A save is reported only after the server confirms the same record and requested status. Pending saves block duplicate submission and dialog dismissal; offline edits send no request; failures preserve the unresolved source. A successful save refreshes all operational data from source truth. The existing task PATCH now accepts optional `expectedUpdatedAt`; Today uses a guarded status-only route that requires this source revision and fails closed on older backends. The atomic update rejects stale/concurrent saves with 409 and advances revisions even within one millisecond; legacy clients can omit the guard. No rejected save records an activity event.

Real stale proposals, overdue invoices/tasks/jobs, blocked tasks, conflicts and pending approvals feed Needs You; passive drafts remain separate. Counts retain unknown/partial semantics. Distinct people are not invented crew groups. The backend addition is the optional task revision precondition; no schema, role, JWT/membership, RLS, financial or supplier policy changes. Field Task writes, unsupported visit/crew/milestone aggregation and broader Athena confirmation/execution remain acceptance gaps. Current continuation verification belongs in [Today 2.0 implementation evidence](architecture/TODAY_2_IMPLEMENTATION.md); earlier results do not certify a later head.

## Openings and dishwasher catalog gap — source branch, 2026-10-18

PR #774 on branch `feat/costbook-openings-appliance-gaps-20261018`
is retargeted to main after parent PR #773 merged as `ef983efc` (and #771). Adds three distinct
unpriced EA source recipes: flanged vinyl window for **new construction**
(CSI 08 53 13, NAHB 4000), sectional steel garage door for qualified
installation (CSI 08 36 13, NAHB 4000), and ready-connection built-in
dishwasher (CSI 11 31 00, NAHB 5000). Manufacturer reference IDs
SRC-0071–SRC-0073 resolve to JELD-WEN, Clopay and GE installation pages.

All price, labor, product choice, construction, utility, and permitting
conditions still require estimator validation. A combined 107 templates
are proposed, not merged/installed/deployed or authenticated verified
by this status entry. New research templates reuse costbook.write,
tenant mapping, review and installed Estimate snapshot behavior.

## Kitchen assembly gaps — merged PR #773 (2026-10-23)

PR #773 on branch `feat/costbook-kitchen-assembly-gaps-20261018` extends
merged PR #771's research catalog with two additional scoped, unpriced kitchen
recipes: wall cabinet installation by EA, and straight-run prefabricated
laminate countertop by LF. Both are NAHB finishing phase 5000 and CSI division
12; source refs `SRC-0069` and `SRC-0070` are registered. The combined
catalog has 104 candidate templates. The work preserves per-tenant installation
and Estimate Engine snapshots, and expressly blocks EA-to-LF piece conversion.

No new wall-cabinet or laminate unit price was inferred. Stone/quartz slab
fabrication, sink/cooktop cutouts, kitchen fillers, backsplash and separate
mechanical/electrical scope are not silently included. PR #773 merged as `ef983efc` after all four required checks passed on
reviewed head `97709786`. Authenticated staging mapping/install evidence
remains a separate certification gate; no deployment is certified.

## Custom Item control ergonomics — implementation pending review

The Estimate Builder's existing Custom Item form now scopes 44px text inputs
to phone/tablet widths, keeps compact 32px text inputs at desktop widths, and
uses 44px Add/select controls and a 44px Taxable label target. Field labels
align at the top; the desktop Add action aligns with the text-input control
row rather than the bottom of wrapping cost help. Shared primitives and
other Estimate entry modes are unchanged.

This implements the bounded control ergonomics from the canonical Figma
Custom Item handoff (793:11017), not the entire illustrated shell. Request
payloads, explicit blank-cost gating, validation, pending/failure retention,
and success reset/refresh remain the existing contracts. Component-browser
evidence uses production React Query, Input/Button/Label and generated
Tailwind with controlled transport; it does not certify authentication,
tenant isolation, server persistence, or deployed runtime behavior.


## Estimate mapping keyboard repair — in progress, 2026-10-21

Branch `fix/estimate-mapping-keyboard` continues the Figma mapping handoff from
main `f5743412fa721279f6f00c9d41aa12ea72cbfb2a`. PR #781 is merged as
`979198fc86edbababf57029e8d73b7ea08a26191`; its retry behavior is already on main.
The existing starter-component picker still lacked combobox Arrow/Enter/Escape
navigation. This bounded frontend repair keeps focus in the input, skips
incompatible/already-mapped options, exposes the active descendant, scrolls the
active result into view, and closes on Escape/Tab. Enter selects only an active,
currently available result; pending/debouncing/failed searches cannot select stale
rows. Pointer selection and explicit Install then Estimate Add remain separate.
No backend, auth/RLS, pricing, snapshot or mutation contract changes.

The isolated Playwright component suite passed all four cases using Chromium
153, production React and mapping logic with synthetic query/Input fixtures at
390/768/1024/1440. The same 390px case failed against the base implementation
at its first ArrowDown active-descendant assertion. Its evidence does not
certify the authenticated full application, persistence or tenant isolation.
Branch implementation is not yet merged or deployed; Ready for Dev remains
pending full canonical-screen and authenticated workflow evidence.

## Historical assembly rematch repair — PR #772

The second pass retains 18 additional historical supplier matches, yielding
153 raw component rows and 75 assemblies with partial material rollups.
Recipe quantities are preserved; ten-square synthetic rolls, 900-SF housewrap
rolls and a derived ten-LF sill allocation use explicit price conversions.
The exact 2-inch R-10 tongue-and-groove XPS observation replaces an ambiguous
edge match. Incompatible collated/bulk nails, cap-fastener lengths, unproven
foam adhesive/sealant/felt specifications and mechanically attached NailBase
remain unmatched. NailBase attachment is documented by CertainTeed at
https://www.certainteed.com/products/commercial-roofing-products/flintlastic-sa-nailbase.
These are dated research observations, not live quotes or bid-ready prices;
the existing audit boundary still excludes known first-pass false positives.

## Costbook researched assembly activation — PR #771 (proposed, 2026-10-18)

PR #771 on branch `feat/costbook-88-assembly-activation-20261018`
expands the existing 14 reviewed installable starter recipes with all 88
static `TradeosAssembly` recipes in the same Costbook and Estimate setup
path (102 browseable templates total). The researched set is explicitly
marked research, includes preserved component quantities and research
source IDs, and is NOT preinstalled or pre-priced. 11 recipes reference
absent source registry entries (SRC-0041–SRC-0050); API/UI block their
installation until those sources are verifiably repaired. NAHB phase
filtering and strict first-unit component mapping are added. Existing
tenant ownership, `costbook.write`, transaction-scoped assembly installs,
Cost Item lookup, and Estimate Engine snapshots remain unchanged.

Status: SOURCE IMPLEMENTATION UNDER REVIEW. Hosted checks are required;
authenticated staging/production execution is not certified. do not describe the 77 source-complete research
templates as price-ready without local mapping and estimator review.

## Items cost columns checkpoint — 2026-10-17 UTC

Reconciled main `41a62cea99c7bc91eda45d805e4b0363b8906132`: #760 progressive entry is merged as `17c339cf`, production READY `dpl_3FnbfxKB3J1NhRS62ixSme7CLBNL`; #761 explicit line-edit cost is merged as `41a62cea`, production READY `dpl_12gVocD7WKCA9vwgSp89YKc4apwi`. These are exact-source deployments, not authenticated workflow certification. Older pending/blocked statements below are historical.

Branch `feat/estimate-items-cost-columns-20261017` reconciles canonical Desktop Items `378:441` (Estimates page `4:10`, high-fidelity context/screenshot inspected). Existing saved items lacked quantity/unit-cost/line-cost columns and visible editor labels. Shared desktop column tracks now align actual saved values; mobile keeps the compact quantity × unit-cost summary and 44px edit actions. Six editor fields have visible, associated labels. Internal costs are explicitly distinguished from customer pricing; saved lineCost is rendered directly, never recomputed. Existing PATCH, draft/permission gates, validation, pricing and snapshots are unchanged.

The missing-header regression failed on the base; all 16 isolated layout/edit/entry/stage browser cases now pass across 390/768/1024/1440. Headers align with cells, cost text matches the response, labels/keyboard Cancel work, mobile targets fit and no horizontal overflow occurs. Every mutation is intercepted; synthetic reads are clearly labeled. Desktop 1440/1024 and mobile 390 renders inspected. Local Web 506/506, lint/build, governance 151/151, docs 40/40, ownership/preflight and Playwright discovery pass. Current branch is unmerged/undeployed pending exact-head hosted checks/review. Authenticated nonproduction persistence and tenant denial remain unverified.

## Estimate line-edit cost presence — 2026-10-17 UTC

Items entry #760 is merged as `17c339cf`, web production source READY at `dpl_3FnbfxKB3J1NhRS62ixSme7CLBNL`. The next bounded edit-cost branch repairs the same unknown-to-zero defect in `EditableLineItem`: clearing Unit cost kept Save enabled and the handler coerced the empty string to zero. Save and the handler now require explicit input, the required field explains intentional zero, and rejected edits announce an alert while retaining entered values. Numeric zero remains allowed by the existing backend contract. No backend financial, authorization or snapshot rule changes.

A 390px regression failed before the repair; all 12 isolated edit/entry/stage browser cases then passed across 390/768/1024/1440. All mutation requests were intercepted, so this proves frontend validation/recovery only. The new branch's checks/merge/deployment remain separate from #760's delivered source and from authenticated nonproduction certification.


## Estimate Items progressive entry — 2026-10-17 UTC

Main `f9a93dc4` includes responsive stages (#755), single-stage finalization recovery focus (#758) and updated persisted-price evidence instrumentation (#756/#757); #751 is closed without merge. The bounded Items branch `fix/estimate-items-progressive-entry-20261017` reconciles canonical Desktop Items `378:441`: saved lines remain central while Add assembly, Costbook and Custom item open the existing entry controls inline. Catalog entry filters source kinds and fetches only the selected source with a distinct cache key and explicit loading state; starter mapping, resolved unit-cost review and explicit Add remain authoritative. Draft fields and same-source selection survive closing/reopening; changing catalog kind clears its prior selection. Only active Items owns the search shortcut; opening a form focuses its first field.

A browser reproduction also confirmed an existing blank custom Unit cost became a numeric zero request. The form now requires an explicit cost before Add and guards the same input in its handler; intentionally entered 0 remains valid. No new Estimate write, pricing calculation, source trust or backend permission contract. New isolated browser coverage intercepts all mutations and uses explicit synthetic catalog reads, proving frontend interaction rather than backend persistence. Current branch delivery and verification are tracked by the handoff/PR; previous merged source delivery must not imply this branch is deployed. Authenticated nonproduction workflow and data-plane isolation remain unverified.


## Proposal failure input retention — 2026-10-16

The existing proposal creation form lost uncontrolled edits when its server action returned validation/API errors: React treated the returned error state as a fulfilled action and reset the fields. A real incomplete-payment-row reproduction restored the initial company/scope and erased the entered milestone. The form now cancels that native reset; successful creation still follows the existing redirect. Failed attempts retain all fields/checkboxes and focus an alert followed by the retry submit in keyboard order. No server action, validation, financial or authorization behavior changes.

Four executed local browser cases at 390/768/1024/1440 submit the real server action's payment validation twice and verify all edits survive. Explicit synthetic form props only; no backend creation call or authenticated persistence claim. Selected-price #752 is merged at `3811e583`, production source READY. Separate estimate recovery #751 has green technical gates but its normal merge was rejected by GitHub because CodeRabbit's stale CHANGES_REQUESTED review remains; re-review is externally rate-limited.


## Selected Estimate price in proposal review — 2026-10-16

The existing proposal-new form previously displayed the project's intake price range even when a finalized Estimate was selected. The backend instead snapshots that Estimate's saved total as the new proposal's fixed price. The focused frontend continuation now displays the selected Estimate total, preserves cents, announces changes and identifies the pricing basis; intake-only selection is labeled Intake range and does not imply a fixed price. The existing server action and backend financial/lifecycle/authorization rules are unchanged.

A read-only browser matrix passed at 390/768/1024/1440 with explicitly synthetic local props, two different saved totals, selection changes, submitted form identity and no write requests. The temporary route/config is removed. Authenticated proposal creation, persistence and production functionality remain unverified; CI/merge/deployment belong to the focused PR.


## Focused Estimate proposal handoff evidence selector — 2026-10-16

After responsive stage PR #755 merged, the finalized Estimate page has both header Create proposal navigation and Review-stage Review proposal draft; the existing Beta Evidence union locator can match both. The bounded branch `test/beta-estimate-proposal-review-link-20261016` selects the existing exact Review-stage handoff instead. Only the non-production evidence runner, its source-contract test, and owner docs change. This does not create a Proposal, alter backend totals, bypass financial authorization, or constitute a passing authenticated certification run.


## Estimate finalization recovery focus — bounded frontend slice (2026-10-16)

The responsive Estimate Workspace merged in #755, with one Review stage at all breakpoints and a distinct finalized-to-proposal handoff. The earlier independent PR #751 was closed without merge; its focusable recovery UI is **not** in main. The branch `fix/estimate-finalization-error-focus-20261016` ports only the still-needed accessibility behavior onto that current shared Review stage: on actual finalize mutation failure, the visible error notice gains focus and scrolls above fixed mobile controls; keyboard focus then proceeds to Retry. Failed writes keep the saved draft; a successful finalize remains server-acknowledged before the Proposal link appears.

No API mutation, customer delivery, financial computation, Costbook source, role/tenant/RLS, database, or production config changes. Source assertions are distinct from authenticated failed-server browser verification. PR CI/review and deployment remain separate.


## Estimate → Proposal authenticated evidence hardening — proposed 2026-10-16

The isolated branch `test/estimate-proposal-evidence-parity-20261016` repairs the canonical Beta Evidence runner for the actual focused-stage Estimate workspace: it explicitly navigates Items / Price / Review, including returning from the s053 Athena assistant page. It refuses silently skipping a missing mobile navigator and verifies `aria-current="step"` before interacting. The browser test now checks authenticated persisted Estimate line costs and subtotal, saved ready state/total, and persisted Proposal `estimateId`/`finalPrice` equality after separate explicit Create. The existing non-production host/data-plane guards, synthetic run identities, tenant denial, four viewport screenshots, source-keyed fixed-price mathematics and credential-artifact scanning are unchanged. No production data mutation or auth mechanism changes.

This work only enhances the certification *test path*. Its source tests are not real authenticated evidence. PR #751 remains review-blocked, #755 owns the responsive builder UI, and true runtime certification requires an approved full Beta Evidence run with retained sanitized artifacts and backend isolation proof. No S053 or release readiness status is upgraded on source evidence.


## Responsive Estimate stages — 2026-10-16 implementation

Mobile navigation #754 merged as `9769dacf`; exact-source production deployment `dpl_CEbaBSEUmbp45yjcwbLCRA8sZdKZ` is READY. The active `feat/estimate-responsive-stages-20261016` branch closes the demonstrated desktop composition gap against canonical Figma `378:440–443`: one Scope → Items → Price → Review flow at every width, workspace beside a dark contextual Athena rail at lg and above, inline desktop progression/finalization, and existing mobile actions above the dock. Existing Project scope, Costbook selection, line edit/delete, pricing and finalize APIs remain authoritative. The old duplicate desktop controls are removed.

Inactive forms stay mounted and hidden so unfinished item/pricing inputs survive stage changes and resizing. Only active Items owns its search shortcut. Failed dirty-scope saves retain text and block progression; saved totals stay distinct from unsaved pricing input and Athena suggestions. No persisted clarification, price-verification gate, public send action, or financial rule is invented. Full visual parity and authenticated persistence/tenant proof remain incomplete. Exact checks and current PR delivery are recorded in the session handoff and implementation ledger.


## Universal Create access — proposed 2026-10-13

The mobile Create sheet now derives its write entry points from the backend-authenticated current role. CRM and billing entries reuse the shared permission contract; Job/Schedule use the normalized manager roles accepted by JobsService. Technician/viewer and unknown roles do not receive write entry links. Advisory Ask Athena retains its independent existing capability gate. The shell reads role and Athena capability concurrently with bounded requests, and missing role confirmation leaves write entries unavailable with retry guidance. Dock geometry, sheet focus/scroll/close behavior, destinations and backend authorization remain unchanged. Role predicate tests are evidence for presentation gating; rendered role/viewport and live tenant/API verification remain open.



## Price → Review → Copperline handoff — frontend parity slice 2026-10-15 (PR pending)

The current Estimate Workspace remains a four-stage mobile experience and a continuous desktop workbench. The bounded `fix/estimate-price-review-copperline-handoff-20261015` UI branch adds a read-only direct-cost breakdown from the persisted EstimateLineItem `lineCost` values grouped by recorded type, distinctly labeled internal and excluding overhead/markup/tax. The saved Estimate `totalPrice`, not this grouping, remains the only shown customer total. The Review stage labels individual line costs internal, explicitly states that Finalize does not send to customers, and shows inline failed-finalization detail with a retry using the existing `POST /estimates/:id/finalize` mutation; the saved draft stays available on failure. After backend status becomes non-draft, the contractor moves to the existing proposal draft form, which already surfaces creation errors and requires explicit Create.

Canonical Figma frames 432:26604 (desktop Price), 432:26746 (warnings), 432:27891 (mobile Price), 432:27999 (mobile Review), and Copperline 425:45123 / 425:46807 were reconciled in place. Mockup prices/dates remain examples. Public customer proposal acceptance is still **TARGET only**, not implemented by this slice. No proposal acceptance, backend pricing/repricing, tenant/RLS, schema, tax computation, or contract/payment mutation is introduced. Browser/hosted lifecycle certification and real provider-price trust remain separate evidence gates.

## Estimate scope, direct-cost transparency and recovery — implementation 2026-10-16

The follow-up `fix/estimate-desktop-scope-recovery-20261016` lane, based on merged Price/Review PR #748, exposes one shared scope editor at desktop and mobile widths, using the existing Project PATCH contract. Save acknowledgment records the submitted scope snapshot; pending saves disable editing, failures retain input, and mobile stage progression still awaits successful saving. This is capability-constrained parity with Figma Scope `432:25161`, not a new estimator or full desktop stage redesign.

Price now groups persisted line-cost snapshots by actual cost type, with cent-safe display aggregation and unavailable values kept distinct from zero. Review explicitly labels internal costs and margin, preserves the backend-finalize-before-proposal boundary, and offers retry after failed finalization. Delete failures expose a shared refresh/reconciliation action instead of silently disappearing. Existing Estimate Engine, authenticated proxy, tenant/RLS, pricing approval, supplier and proposal contracts remain unchanged. Local checks and hosted delivery evidence are recorded in `docs/design/FIGMA_IMPLEMENTATION_LEDGER.md`; browser parity and production behavior are not inferred from builds.


## ABC catalog no-refetch product disclosure — 2026-10-15 pending CI

Production's catalog route now returns ABC sandbox products, but its default 25-product page can spend seconds waiting for the upstream provider (one observed page took ~29 seconds), and some concurrent request-scoped auth sessions fail with Prisma connection pool timeout (connection limit 1, timeout 10s). This supersedes PR #745's product-card navigation: that previous approach made a second catalog request for its details screen. This could hit the same connection bottleneck and did not establish a reliable production click-through.

This bounded frontend follow-up replaces the catalog's whole-card navigation with native `<details>/<summary>` disclosure inside the **already authenticated and loaded** provider listing. Selecting a product requires **zero additional HTTP calls**, database sessions or ABC OAuth activity. It displays only provider-listed item number, manufacturer, family, ID, unit options, color, finish, available variations and provider-supplied warnings; absent attributes are explicitly "Not supplied." The UI makes it clear these are catalog listing attributes, not deeper Get Item verification, branch stock, customer-authorized prices or approved Materials. The former standalone product-detail route remains for direct URLs but is not an advertised navigation path until item-level authorization is proven.

This does **not** repair the separate Prisma pool exhaustion on page loads or grant ABC Get Item / customer-specific pricing access. Those are independently tracked follow-ups and must not be hidden by UI verification. No catalog replication/cache is introduced under ABC's terms. Required GitHub checks and real hosted signed-in browser proof are pending; keep #735 open.




## Reviewed Costbook insertion in Estimate Items — proposed 2026-10-15

The bounded branch `fix/estimate-picker-reviewed-add-20261015` changes the existing desktop/mobile Estimate Items picker, not the Estimate Engine or supplier pricing authority. Search keyboard Enter now selects a Costbook item/assembly for review instead of inserting a highlighted result. A selected tenant Cost Item uses the existing read-only `/costbook/cost-items/:id/unit-cost` endpoint for its current stored-cost preview; installed assemblies retain the existing current-unit-cost/recipe preview. Estimate Add is enabled only for an explicitly selected installed source with a finite nonnegative resolved preview, positive quantity, and no pending mutation or preview refresh. A mapped starter assembly cannot install until its read-only cost preview resolves; installation and Estimate Add remain separate explicit actions. Failed/unknown previews do not silently use zero or write Estimate lines. The backend remains the authority for cost snapshots at line creation, so after adding contractors should review the persisted line before finalizing.

Only UI source and focused regression tests are modified; no new pricing data, supplier quote trust, schema/migration, RLS, authorization, tenant scope or proposal mutation is introduced. This is source-level implementation proposed for CI and review, not an authenticated browser or production certification.
## Public portal access design parity — proposed 2026-10-14

The bounded `feat/portal-access-figma-parity-20261014` frontend branch aligns the customer magic-link confirmation and generic denial presentation with canonical Figma frames 205:34, 205:35, 651:3762, and 651:3845. A reusable customer-only public shell provides consistent branding and responsive card layout. The confirm route still reads only the HttpOnly pending cookie, denies malformed tokens, and submits only an explicit POST to the existing same-origin redemption endpoint. The access-error page remains non-enumerating and exposes no unsupported invitation/retry action.

This is frontend presentation and source-regression coverage only. No backend, portal session, customer identity, tenant/RLS, contract signing, proposal decision, payment, or token-handling behavior changes. Hosted CI, authenticated portal browser evidence, accessibility checks and production deployment remain unverified until collected. This branch is not an S059 certification or release-readiness claim.

## Entry control geometry — proposed 2026-10-13

The same Entry parity lane now restores the existing official wordmark to the canonical mobile brand slot, aligns mobile tagline/drawing placement with default frame `547:2218`, and removes an unreferenced underline. Existing static assets are reused without editing bytes. This is code-backed parity work; screenshot/asset comparison remains unverified. BrowserAct CLI's daemon failed to initialize, and the available cloud browser cannot reach this workspace's localhost server.

The canonical mobile Entry response frame `548:2780` specifies 48px credential inputs/sign-in action and a 44px recovery target. The login page now overrides shared Input/Button default heights at its own callsites and announces pending submission through `aria-busy`. Password reveal inherits the larger field's geometry. Existing auth action, navigation, assets and shared default sizes remain intact. Rendered viewport/keyboard evidence is still required; local Chromium downloads return invalid archives. This is control-geometry parity only, not full Entry/boot certification.

## Contextual Athena scope freshness — proposed 2026-10-13

The estimate context panel now binds advisory suggestions to the project, estimate and normalized scope actually sent for review. Editing the scope or changing record context marks the result stale, announces the required refresh and disables Add. A late response cannot make suggestions current for a later edit. Loading/error states disable applying previous results, and suggestion writes/reviews are serialized in the UI. The existing authenticated line-item API, source keys, reviewed quantities, pricing resolution and explicit Add contract remain unchanged. Predicate tests verify scope/record freshness; runtime browser and real API evidence remain separate. No one-question clarification capability or full Figma parity is claimed.


## ABC live sandbox evidence and safe failed-line diagnostics — 2026-10-13

The live Vercel backend confirms a successful user-present ABC OAuth
callback, followed by a successful authenticated Search Accounts request
and two selected-account pricing requests returning HTTP 200 at the HTTP
boundary. The Settings test for supplier SKU `654210` shows provider
line status `Error`, with no eligible positive-priced line/UOM.
Therefore account authorization is proven at the HTTP workflow level,
but **a valid ABC sandbox priced SKU is not yet proven**.

The next scoped feature allows the browser to show only a short,
privacy-screened `status.message` from a matching failed ABC Price Items
line, reusing the older probe's screening. Unsafe/missing text stays
unavailable, and no Material updates or account preferences are saved.
Real ABC Production entitlement remains dependent on provider approval.


## ABC aggregator unattended-pricing protection — implemented in PR #723

ABC's Third-Party Aggregator user-presence requirements are enforced in the
background supplier feed: a scheduler identity or stored Vault grant is not
user presence. Unattended ABC pricing fails closed before any provider
request. The default ABC UUID match rejects immediately, and a second
check blocks an ABC-tagged supplier from generic HTTPS transport when the
configured ABC supplier UUID is missing or stale. Other suppliers continue
through the reviewed supplier feed path. Owner/admin user-clicked sandbox
account discovery and selected-account read-only quotes remain available.
This does **not** establish a live eligible ABC price, production API
entitlement, or permission
to conduct multi-supplier price comparisons using ABC-derived prices.
The operator evidence/demo plan lives in
`docs/operations/ABC_SUPPLY_AGGREGATOR_PRODUCTION_DEMO.md`.

## ABC sandbox OAuth reauthorization — 2026-10-11

The stored ABC refresh token is gone (0 saved tokens in Vault), and ABC
requires user-present authorization for third-party customer-specific
pricing, so the connection cannot be restored by retrying the old token.
A new user-present reauthorization flow is implemented but not yet
exercised end to end: owner/admin `POST
/api/v1/supplier-integrations/abc/oauth/authorize` returns the ABC
sandbox authorize URL (PKCE S256, `pricing.read offline_access account.read`,
10-minute single-use state bound to the initiating tenant session), and
the unauthenticated `GET
/api/v1/supplier-integrations/abc/oauth/callback` consumes the state
exactly once, exchanges the code server-side, and persists the refresh
token through the existing Vault path. The env bootstrap refresh token
is now recovery-only; the durable Vault credential is authoritative and
pricing fails closed when no token exists. The callback URI must still
be registered in the ABC Developer Portal before the flow can run, and
the daily cron must not consume user-context pricing tokens until ABC
confirms unattended customer-specific pricing in writing.

Fix 2026-10-11: the authorize endpoint 500'd in production because the
TTL parameter reached Postgres as bigint while
`tradeos_private.create_abc_oauth_state` takes integer (42883); the call
site now casts it explicitly. No API or flow change.

Status 2026-10-12: the flow has now been exercised end to end three
times (user + automated browser, two clients) and fails deterministically
at the callback: ABC sandbox sign-in succeeds and redirects back, but
Settings lands on `?abc_oauth=error`. The callback now reports the
failing stage via `?abc_oauth_step=request|state|exchange|persist` so
the next attempt identifies whether the failure is in state validation,
the ABC code exchange, or token persistence.

Callback persistence repair proposed 2026-10-12: production runtime logs on
`0119f731` identified `abc_oauth_step=persist` failing with Prisma's
connection pool timeout (10 seconds, limit 1). The callback wrapped Vault
persistence in a tenant-scoped transaction while the rotation-oriented helper
opened another transaction. The focused fix gives the authorization callback
an owner/admin-guarded in-session Vault write, while retaining independent
commits for provider refresh-token rotation. This patch alone is not proof of
an authorized sandbox quote, a stored token, or a production deployment.

Provider refresh-token rotation hardening proposed 2026-10-12: the rotation
helper previously acquired a nested transaction from the request's one-
connection Prisma pool, risking the same timeout as the OAuth callback.
A lazily initialized independent Prisma client now commits provider rotations
through a separate restricted tenant-RLS session before pricing continues.
Focused tests assert Vault write argument order/SQL and a PostgreSQL test
models a held request connection with an independent rotation transaction.
Cross-instance concurrent refresh serialization and live ABC validation are
separate unverified gates, and this PR is not yet deployed.

## ABC selected-account sandbox quote — proposed 2026-10-12

The next reviewed slice adds a user-initiated, **read-only** selected-account
price probe. Its API re-fetches the ABC sandbox authorized Ship-To/branch
relationship on every request and uses the same Vault-backed user grant to
request one strictly allowlisted sample item with quantity 1. Quotes require
one matched `OK` line, a positive USD price and provider stocking unit.
It does not save account preferences, approve a Material price, insert
observations or validate the provider unit against TradeOS Material mapping.
The optional ABC documentation sample SKU is not proof that a given sandbox
account can price it. No user-authorized live account/price evidence was
available during this implementation; completion of that real-world test
requires a fresh founder browser authorization and the sandbox response.
Production API activation requires ABC Third-Party Aggregator approval (#719).

## ABC sandbox Settings account selector — proposed 2026-10-12

Following the merged read-only Ship-To discovery API, the next proposed web
slice adds owner/admin Settings account and branch selection. The screen
fetches accounts from the authenticated same-origin proxy and shows only
branches linked to the selected Ship-To. Handles empty responses, safe 409
reauthorization guidance and generic errors. Selection is **ephemeral and
read-only**, with no preference storage or pricing probe routing changes.
Actual live account discovery and priced item/UOM remain unverified; ABC
production access still requires Third-Party Aggregator approval.

## ABC sandbox Ship-To discovery API — 2026-10-12

After merging PR #718, the bounded sandbox account discovery client is ready.
The scoped next slice exposes `GET /api/v1/supplier-integrations/abc/accounts`
under an existing authenticated, tenant-RLS, owner/admin `costbook.manage`
gate. It resolves only the tenant's configured ABC Supplier, loads its durable
Vault refresh token, and performs bounded, read-only `account.read` Search
Accounts with a 15-second deadline. Unknown or old pricing-only grants get a
sanitized reauthorization status; no provider response body, token, Material
or price updates are returned/written. This is **not** evidence of a live
sandbox account discovery, a user account picker, successful priced SKU or
ABC production approval. The selector, chosen-account price request, and
aggregator production compliance are later governed steps.

## ABC sandbox connection probe — 2026-10-09

The existing cron/Price Items integration still cannot contact ABC
with zero SKU-linked active Materials. A new authenticated,
owner/admin-only `POST /api/v1/supplier-integrations/abc/price-probe`
and Settings → Costbook button permit **one server-allowlisted** reviewed supplier SKU
(`ABC-654210`) to be quoted directly, even after verified Material activation, against the sandbox **without**
creating any Material or price-update proposal. Both paths share
the existing durable Vault token-rotation helper; no production ABC
token or provider quote has been verified merely by adding this code.
The response does not certify stock UOM. The governed approval and
existing Estimate snapshots remain unchanged.

Update 2026-10-12: ABC probe provider status visibility is limited to a
matching failed line with a short, safe plain-language explanation. Bare
domains, URLs, embedded account digits, ship-to identifiers, UUID-shaped IDs,
markup and credential-like text are rejected; absent/unsafe messages result
in a generic Settings fallback. A successful quote or other raw status message
is not disclosed through `providerStatusMessage`. No Material, price,
approval, OAuth or account-selection behavior changes.

Separate production-access gate: ABC's official Third-Party Aggregator track
requires a production application request and integration review demonstration
before real customer accounts/pricing can be used. The TradeOS adapter still
hardcodes sandbox endpoints. Before enabling production API access, validate
the required user-present pricing model and ABC restrictions against
competitive price comparison; existing scheduled supplier sync is not a
certification of terms compliance. See
https://apidocs.abcsupply.com/third-party-aggregator-integration-track/ and
https://apidocs.abcsupply.com/getting-started/.


## Authenticated supplier-workflow IDs — 2026-10-09

TradeOS Settings → Costbook exposes the existing protected 47802 supplier-evidence
workflow's organization UUID and **application** user UUID to signed-in owners/admins.
The Settings API returns `currentUserId` from the verified backend authentication
context; the UI verifies that this actor belongs to exactly one active owner/admin
entry in the same tenant-scoped membership list before showing individual Copy
controls. Email, membership UUID, Supabase auth subject, and Supabase project ID
are never substituted. The panel fails closed for missing or ambiguous identities,
and the underlying GitHub workflow still requires its production confirmation,
restricted database role, and owner/admin RLS permissions. This UI does not seed
observations, grant roles, or certify live ABC pricing.


## ABC sandbox stocking UOM gate — proposed 2026-10-10

The ABC Price Items response carries `lines[].uom` for eligible priced lines.
The new adapter preserves the provider-sourced unit and shows it in Settings.
The supplier feed refuses to enqueue a proposed Material price unless the
response unit matches the tenant Material unit of measure. Unknown or
mismatched units fail closed without price conversion. This does not reauthorize
OAuth, create a Material or approve supplier price updates.

## Supplier feed serverless activation — 2026-10-07

The backend now has a Vercel-native supplier-price cron boundary at `GET /api/cron/supplier-price-sync`, scheduled daily by `app/vercel.json`. It is protected by `CRON_SECRET` plus a bounded IP rate limit, consumes only explicit `SUPPLIER_PRICE_SYNC_JOBS` targets, and reuses the existing membership-derived background database session and review-first supplier pricing flow.

ABC Supply serverless scheduling is hardened for OAuth refresh-token rotation. The environment refresh token is bootstrap/recovery configuration; the current rotated token is read from and persisted to Supabase Vault through private `tradeos_private` SQL wrappers. Those wrappers validate active owner/admin tenant context and the canonical `ABC_SUPPLY` supplier row. The restricted `tradeos_app` role receives execute-only access to those helpers, not direct Vault access. If a rotation cannot be persisted, pricing does not continue, preventing a Vercel cold start from losing the replacement token.


## Costbook legacy assembly match audit — implementation slice 2026-10-08

The checked-in `pricedAssemblies.ts` dataset remains historical generated evidence rather than a canonical pricing source. A new bounded audit registry identifies high-confidence false positives only when the assembly requirement and supplier product contradict on an identity-defining nominal dimension, product type, or material/use specification. The first pass covers more than twenty concrete rows including 2x10 joists matched to 2x4 lumber, 2x8 deck joists matched to 5/4 decking, roller sleeves matched to firebrick, helical-pile extensions matched to concrete brick, and interior finish paint matched to exterior paint.

`AUDIT_FILTERED_LEGACY_PRICED_ASSEMBLY_COMPONENTS` is a non-mutating filtered view for review/analysis. The raw legacy array is preserved for provenance, and the audit does not invent substitute products, modify Costbook records, change assembly recipes, mutate Estimate snapshots, or write production data. Existing precomputed assembly rollups remain historical and are not promoted to current governed pricing by this slice.


## Costbook cross-supplier canonicalization — implementation slice 2026-10-06

Supplier/workbook canonical-key strings are no longer treated as sufficient evidence for cross-supplier equality. The bounded Costbook slice introduces a TradeOS-owned SPF precut-stud crosswalk, normalizes recognized supplier aliases into stable identities, makes nominal size/length/species conflicts hard exclusions, and allows multi-supplier comparison only after a governed identity is established. Legacy exact-key price lookups remain compatible only when their eligible evidence belongs to one supplier; a shared ungoverned key fails closed rather than becoming an accidental cross-supplier join. Supplier-evidence imports may establish a canonical link when the product is first created, but subsequent imports never overwrite the stored link; manager review remains the explicit mutation path.

The known generated assembly mismatch that priced a 92-5/8 in. 2x4 stud component from a 104-5/8 in. Niehaus product has been removed; the component remains unpriced rather than accepting a dimensionally different substitute or inventing a unit conversion. Governed comparisons also fail closed when candidate observations use incompatible comparison units. The slice adds no schema/migration, RLS/auth/permission change, Material price mutation, or Estimate repricing path. Exact-head verification passed on `ef7e7f5345051720e975e9e974d422e6a5c00dde`, including App unit/typecheck/build/integration, Costbook provenance + supplier-seed dry run, docs/governance, dependency review, CodeQL, branch currency, and CodeRabbit review with no unresolved threads.


## S053 certification hardening — 2026-10-04

Finalized estimates keep contextual Athena review readable but no longer render the **Add to estimate** mutation control; the authoritative Estimate Engine already rejects line-item writes once an estimate leaves draft. S053 browser evidence also removes any run-created Athena lines in a best-effort `finally` cleanup when post-apply assertions or reload checks fail, preventing a failed viewport from contaminating later evidence or canonical pricing assertions. These are bounded certification repairs; they do not change estimate lifecycle, pricing, auth, tenant/RLS, or the separate TARGET clarification contract.

## Today real exception queue expansion — 2026-10-04

The canonical **Needs You** section now consumes two additional existing, persisted exception sources without turning normal progression into attention work. Organization-scoped incomplete Project Tasks are loaded through the existing `GET /api/v1/projects/tasks` contract and only persisted `status=blocked` rows enter Needs You. Manager-capable dashboard sessions also use the existing `GET /api/v1/schedule/conflicts` preview over the current organization week; each returned technician overlap links to the canonical Schedule workspace for resolution. Technician/non-manager sessions do not call the manager-only conflict preview.

These sources degrade independently. If stale Proposal, overdue Invoice, blocked-task, or schedule-conflict truth is unavailable, the Today header reports the Needs You count as unavailable rather than substituting zero. The queue still excludes ordinary draft estimates, normal sent proposals, not-yet-due invoices, and other passive workflow events.

No pricing-verification or material-unavailable row is synthesized by this slice. Current persisted Estimate lines retain source IDs and price snapshots but do not expose a company-wide persisted freshness/provenance exception contract sufficient to support those rows truthfully. That remains a separate domain/API requirement rather than a UI guess.

## Contractor lifecycle advisory-lock repair — 2026-10-04

The full synthetic contractor walkthrough exposed a real job-creation failure: PostgreSQL `pg_advisory_xact_lock()` returns `void`, and the affected Prisma `$queryRaw` calls attempted to deserialize that result. Job-number generation, technician schedule serialization, and structured AI Estimate Assist apply now execute those existing transaction-scoped locks with `$executeRaw`, matching the repository's established advisory-lock pattern. The repair changes no lifecycle, route, schema, RLS, permission, pricing, or AI review boundary.

## S067 scheduling and Site Visit continuity — implementation slice

The bounded S067 frontend slice reuses the existing conflict-aware Job schedule
and the existing optional `SiteVisit.jobId` persistence contract. Managers can
open **Capture site visit** from scheduled Job context in Dispatch or the
Project workspace. The intake route validates the requested Job against the
Project's loaded, unarchived Jobs before rendering linked context; missing,
archived, wrong-Project, or otherwise unavailable Job ids fall back truthfully
to Project-only Site Visit capture. Finishing a linked visit forwards `jobId`
through the existing Project Site Visit endpoint, preserves the Job context
after redirect, and revalidates Project, Today, Dispatch, and Field surfaces.

The Site Visit workspace continues to work without any Job query parameter.
Technicians remain read-only for CRM/Site Visit writes; the new capture links
use the existing owner/admin/dispatcher write-role boundary. Project Site Visit
history now distinguishes linked Jobs from Project-only visits without creating
another calendar or visit model.

This slice changes no Job schedule/reschedule/conflict implementation, backend
route, lifecycle state, schema/migration, role/permission, auth/RBAC/RLS policy,
GPS/route behavior, notification system, or external-calendar integration.
Repository verification and retained responsive/permission/tenant-negative/
refresh evidence remain required before S067 can be called complete, and S056
remains its separate release-certification prerequisite.

## Customer → Project canonical continuity — 2026-10-04

The Customer-originated Project creation path now matches the canonical S052 interaction without changing the underlying data model. `/projects/new?customerId=...` resolves the existing organization-scoped Customer record, presents its active saved ServiceAddress rows, and copies the selected formatted address into the existing `Project.siteAddress` string only. The form explicitly states that no Project→ServiceAddress relationship is created. Customer identity is preserved through a hidden server-owned form value after the scoped read rather than asking the contractor to reselect the same CRM record.

Customer-context creation offers **Create project** and **Create & start estimate**. Normal creation now opens the newly created `/projects/:id` workspace immediately so persisted Customer/address/scope continuity is visible after refresh; the estimate action reuses the existing `intent=estimate` path and existing Estimate create API. Context-free Project creation and the existing Job intent remain intact. No backend route, schema, migration, auth/RBAC/RLS, Customer merge, Lead model, or ServiceAddress ownership behavior changes in this slice.

# Current State

# Current State

# Current State

## Canonical entry experience parity — 2026-10-04

The authenticated-login entry surface now matches the canonical TradeOS Figma entry composition without changing authentication behavior. `web/src/app/login/page.tsx` preserves the existing `loginAction`, recovery link, account-creation link, browser autocomplete, and fail-closed error presentation while replacing the generic centered Card with the approved responsive graphite/copper identity surface and direct sign-in workspace. The canonical TradeOS identity and construction-line artwork are exported as static SVG assets under `web/public/`; mobile, tablet, and desktop use their matching Figma variants. Password visibility is an explicit accessible local control only and does not alter credential submission or persistence.

This is a presentation-only frontend slice. It adds no auth/session/Supabase/RBAC/RLS/onboarding behavior, no alternate redirect path, and no new product capability. Focused source-contract coverage pins the canonical copy, responsive artwork variants, existing auth action, recovery/account links, and the absence of a parallel client authentication path.

## S066 mobile field continuity — merged implementation

PR #634 merged as `50fe143a31e245718cb97d31f4595883a156d84a` after exact-head Web unit tests, lint, build/dependency audit, Docs consistency, Sprint governance, PR branch currency, Dependency review, Live documentation reconciliation, and Verify repository passed. The bounded S066 frontend slice connects the existing Project workspace to
the existing assignment-scoped Field workspace without creating another Job
surface. Technician Project views expose an **Open field job** action on the
Job rows already returned through the forced-RLS Project read, handing the
selected Job to `/field?job=<id>`. The Field route preserves that explicitly
requested Job instead of silently replacing it with the first Job in today's
assigned queue. The existing `getFieldJob` contract remains the authorization
boundary, so an unassigned, wrong-organization, or otherwise inaccessible Job
still fails closed. The web DTO now reflects the already-returned `archivedAt`
field: archived Project rows do not offer the Field handoff, and an old direct
link to an archived assigned Job renders a non-actionable error instead of
field transition controls. Repeated `job` query parameters are normalized
before trimming so malformed links do not crash server rendering.

An authorized assigned Job outside the current organization-day list can render
with truthful schedule context and an explicit outside-today notice. If the
daily list fails but the explicitly opened assigned Job still loads, the
workspace degrades locally and discloses that the list is unavailable rather
than discarding the usable Job context.

This changes no Job lifecycle transition, backend route, schema, permission,
RBAC/RLS policy, invoice handoff, or field persistence capability. Existing
photo/issue/change-order/offline/inventory/messaging/timekeeping exclusions
remain in force. Retained authenticated 390/768 responsive, assignment/tenant-negative, failure,
and refresh evidence remains required before S066 can be called complete or
release-certified.


## Desktop estimate visibility repair — 2026-10-02

The nightly gate reproduced a production draft estimate showing only its header
and totals at a desktop viewport. The mobile workflow hides at `lg`, while the
desktop editing container had no responsive display override. This repair makes
the existing desktop workspace visible at `lg`, preserving the staged mobile
flow below that breakpoint. A focused regression checks the matching visibility
boundary. CI and post-merge/deployment browser verification remain required;
this repair is not a release-certification or sprint-completion claim.

## Staging fixture authentication hardening — 2026-10-04

The former credential-free web/API staging bypass is being replaced by a backend-only synthetic fixture identity protected by a strong encrypted `TRADEOS_STAGING_FIXTURE_SECRET`. Web Preview authentication returns to the real local/Supabase session path; the public fixture marker no longer authenticates the API. The backend still requires the dedicated staging Supabase/data-plane checks, exact synthetic owner membership, and normal request-scoped RLS. The guarded staging-repair control provisions or reuses only its managed staging-branch secret, masks/exports it to the evidence job, rebuilds the exact staging SHA from Git, and verifies the secret-gated fixture against the synthetic estimate before readiness is accepted. Production remains denied.

This is a staging/evidence security repair, not a production auth bypass, tenant-model change, or S053 completion claim. S053 still requires a current-head authenticated browser matrix and tenant-isolation evidence after the repair lands and staging is re-synchronized.

## Contractor beta lint-only cleanup — 2026-10-04

The contractor beta walkthrough exposed one unused parameter in the Customer action test fixture. The test callback now omits that unused parameter so web lint remains clean; this is test-only maintenance and does not change Customer behavior, runtime code, auth, tenancy, API contracts, or product state.

## Current milestone

TradeOS is in RC1 hardening. The active posture is production readiness, lifecycle consistency, contractor-facing usability, tenant-boundary verification, and retained release evidence rather than MVP planning.

## Local-development authentication fallback — 2026-10-04

Local development can run the existing backend local-auth session contract without a configured Supabase project. Login goes directly to the backend local-auth endpoint when the public Supabase URL/key are absent; session reads and the protected-route proxy fail closed when neither a usable local session nor Supabase configuration exists; logout clears/revokes the local session and skips Supabase sign-out when Supabase is not configured. When Supabase is configured, the normal Supabase authentication path is unchanged. This is a local-development compatibility repair, not a production auth bypass or RBAC/RLS change.

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
- ABC Supply sandbox adapter (PR #684; **background use superseded**): mapping/token code remains, but `fetchDefaultSupplierFeed` now blocks the ABC supplier's unattended scheduled sync with a terminal `abc_user_present_required` outcome before Vault/Material/provider access. Other supplier feeds continue unchanged, and ABC does not fall back to configured generic feed URLs. ABC's user-present, owner/admin selected-account sandbox diagnostic route remains read-only with Vault token rotation, account/branch revalidation and positive USD/UOM checks; it never creates a price proposal or updates Materials. Historical 2026-10-06 sandbox HTTP 200/OAuth evidence does **not** prove an eligible priced line; live successful Ship-To/branch and unit pricing remain unverified. No ABC Production entitlement is known.
- regional supplier evidence intake (PR #531): normalized supplier workbooks are staged into tenant-scoped `SupplierProduct` and `SupplierPriceObservation` evidence through authenticated, manager-gated endpoints. Priced, unavailable, and not-listed states are preserved; the importer never changes `Material.unitCost` or creates `SupplierPriceUpdate` rows. The supplied validation bundle contains 8 workbooks, 5,189 products/observations, and 701 unavailable observations; Carter Lumber remains catalog-only because all 670 observations are unavailable. The authenticated `/costbook/supplier-evidence` review surface reads those same rows, shows stored availability/price/source facts, previews the governed pilot canonical matcher, and lets `costbook.manage` actors confirm only a suggested canonical identity through the existing reviewed-match endpoint. That review changes `SupplierProduct.canonicalMaterialKey` only; the mutation re-runs the governed matcher and rejects a different key or a relink of an already-linked product. The review surface preserves each observation's stored currency and pages through the evidence set with an organization-scoped cursor; it never promotes an observation into `Material.unitCost` or reprices an Estimate.
- authenticated `/costbook/import` batching for governed composite installed-price benchmarks; its same-origin server proxy checks mutation origin before reading the HttpOnly session, keeps the bearer token server-side, accepts 1–500 row API batches, and the browser import client sends batches of up to 100 rows and up to 80 KiB of encoded request data while preserving the same authorization, tenant scope, validation, and idempotent upsert boundary; any individual encoded row larger than 80 KiB is rejected before upload so an oversized one-row batch cannot cross the backend parser boundary
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
- Supplier feeds remain review-first and do not auto-apply prices; supplier-SKU matching beyond the ABC Supply sandbox feed's duplicate-SKU skip and further provider-specific connector depth remain future work.
- Athena Costbook writes/autonomous pricing mutation are not implemented.
- Stripe Billing sandbox runtime configuration is incomplete until an API credential, webhook-signing secret, webhook endpoint, app URL, and active Customer Portal configuration are installed and exercised. Stripe Connect/direct contractor customer payments remain a separate follow-up integration and are not provided by PR #491.
- Production environment values, Preview isolation, runtime-authenticated RC sessions, and multi-viewport browser artifacts must be verified externally rather than inferred from repository state.
- Settings brand-asset uploads use a shipped S017 orphan reconciler: stale generated, non-current objects can remain in private Storage until an authorized operator runs the dry-run-by-default cleanup after the 24-hour grace period. No automatic cleanup scheduler exists by design.
- The residential Assembly Catalog pins catalog/recipe metadata and quantities, publishes its NAHB/CSI coverage matrix, validates Cost Item unit/type compatibility on client and server, and installs within an explicit tenant/RLS transaction. The October 2026 browse-facet slice filters the reviewed starter payload by NAHB, CSI division, trade, output unit and tenant installed status; it derives installation status from all active assemblies and resets stale mappings when switching filters. Live tenant isolation coverage for the install flow already exists. An explicit 1440/390px two-role SHA-attested browser evidence workflow is implemented but has not yet run; authenticated evidence and qualified-estimator expansion beyond the 14-recipe baseline remain outstanding; see `docs/architecture/ASSEMBLY_CATALOG_IMPLEMENTATION.md`.

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
- **Needs you** is exceptions-only. It currently contains stale Proposal follow-up, overdue Invoice action, persisted blocked Project Tasks, and schedule conflicts for manager-capable sessions; ordinary draft Estimates, non-stale sent Proposals, not-yet-overdue Invoices, and normal next workflow steps do not appear there.
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

The starter assembly mapper now provides a read-only pre-install cost preview after every required slot is mapped. It resolves each selected same-organization Cost Item through the existing unit-cost endpoint, shows cost per assembly unit, accepts an output quantity for a job-cost estimate, and exposes loading/unavailable states. Preview failures now include an explicit retry action with an in-progress label; install remains gated until a finite, nonnegative preview resolves, including after a retry. The retry target is at least 44px high on mobile, retains the compact desktop size, and exposes progress through a dynamic accessible name and persistent polite status region. The preview does not create, mutate, or apply pricing; installation remains an explicit review-first action.


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

The existing Project-backed Lead and Site Visit flow (PR #582), Customer connection (PR #586), and /crm operating overview (PR #587) are already on main. S063 must extend those sources. Today /crm shows the first Project per mobile pipeline lane, up to five per desktop lane, and the first five incomplete Project Tasks. Its task DTO carries assignedTo but the overview does not show ownership. Proposal Sent and Awarded are already derived from Proposal/Project truth; CRM does not own acceptance mutations. Merged PR #631 (`b25988a11a3a4b62551f5bc3091f5fd298da6684`) implements complete bounded access/navigation, truthful existing Task ownership, and awarded-Project handoff. The branch displays all loaded follow-ups (the API read remains capped at 50), makes every loaded pipeline Project reachable on desktop/mobile, links Task rows to the Project Tasks tab, and labels Awarded links as canonical Project destinations. No new CRM persistence or lifecycle is authorized. The code is merged; authenticated browser/permission/refresh certification remains outstanding.

## S061 Today structural completion reconciliation — 2026-10-02

PR #585 already shipped the canonical Today page structure now present on current `main`: `OwnerDashboardHeader` plus one `TodayCommandBoard` with **Now / Needs you / Coming up / Money**. The old repeated task/activity/Knowledge/KPI/widget regions are absent, compact action rows remain the dominant interaction, and unavailable/partial data stays explicit. S061 is implementation-complete but remains `IN_REVIEW` until S060 supplies its separate live-data/multi-viewport release certification.


## S052 Customer → Project certification harness merged — 2026-10-03

The Customer/ServiceAddress/Project implementation needed for S052 remains the merged PR #586/#629 contract. Certification PR #637 merged as `16d297f70e8bd0d2e89b3506e06cd04cbfbd3a60` after exact-head required CI, branch currency, security/governance checks, and all review conversations passed or were resolved. The bounded harness on `main` now provides the opt-in `s052` selector, exact deployed-SHA correlation, owner Customer create/update + ServiceAddress + duplicate/validation + Customer-linked Project persistence/reload assertions, synthetic admin Customer→Project evidence at 1440/768/390, inactive-membership denial, foreign Customer/Project tenant probes, and fail-closed artifact validation.

S052 remains `IN_REVIEW`. No retained full non-production `s052` run has passed yet. At post-merge reconciliation the frontend deployment created for exact merge SHA `16d297f70e8bd0d2e89b3506e06cd04cbfbd3a60` was canceled, while the available staging frontend remained on an older SHA; dedicated synthetic admin/inactive and foreign-tenant fixture availability also cannot be established through the available secret-safe integrations. This is an external certification-evidence gap, not evidence of a product failure.


## Costbook Data Foundation — 2026-10-02

Founder-requested Costbook data-foundation work extends the existing Costbook and does not change numbered sprint status. Reconnaissance confirmed that the current Supplier, SupplierProduct, SupplierPriceObservation, LaborRate, Assembly/AssemblyItem, MaterialPriceAudit, research-candidate, and EstimateLineItem snapshot systems are the implementation base rather than targets for replacement.

Merged PR #628 (`8d37fdbe146a4b45c40c1d58a4c1e5678eee14cf`) adds the 12-item canonical pilot registry around `SupplierProduct.canonicalMaterialKey`, a precision-first deterministic supplier matcher/review flow, append-oriented supplier observation imports, a pure trust-first PriceResolver, and read-only `GET /api/v1/costbook/pricing/resolve`. The resolver returns provenance, confidence, freshness, alternatives, and a reason for selection. Current regional supplier observations are conservatively classified as retail validation rather than being upgraded to account or negotiated pricing. Explicit organization filtering remains in the service query and existing forced RLS remains the database boundary.

The BLS slice reuses the existing Costbook research-candidate review system. It records Terre Haute OEWS area `0045460` with Clay, Sullivan, Vermillion, and Vigo counties, expands the validated core-trade mean/median evidence without inventing missing percentiles, implements Terre Haute → Indiana → national benchmark fallback, and models June 2026 ECEC construction benefits only as an explicitly inferred national burden input. BLS evidence still cannot become a customer bill rate automatically.

This slice does not add QBO, ABC, 1build, retail scraping, automatic price application, a second Costbook catalog, a second assembly model, or a second Estimate snapshot system. Existing consumed Estimate pricing remains historical through persisted EstimateLineItem values.


## Costbook normalization: NAHB phases + material classification codes — 2026-10-08

Merged PR #694 (`fd1e6479968fe890db2e9ffedef0af41c11e6827`) established the founder-approved Costbook normalization and nullable material-code contract. Runtime migration deployment and tenant backfill remain separate verification boundaries:

- All 88 `TradeosAssembly` entries now carry `nahbPhase` (`"1000"`–`"6000"`, NAHB job-cost build sequence) alongside the preserved `csiDivision`; new `tradeosAssembliesByNahbPhase` helper and `NAHB_PHASE_TITLES`/`isNahbPhase` in `app/modules/costbook/tradeosAssemblies.ts`. Distribution: 13/11/10/16/38 across phases 1000–5000; 6000 intentionally empty (completion/inspection is not assembly work).
- Migration `20261008132000_add_material_classification_codes` adds nullable `omniclass_23` and `unspsc` to `materials` plus an index; no NOT NULL, no backfill, existing import/pricing paths untouched. Material create/update/bulk-import accept both codes and the DTO returns them (`unspsc` validated as 8-digit at the API boundary).
- New `app/modules/costbook/canonicalMaterialCodes.ts`: `CANONICAL_MATERIAL_CODES` keyed by static-corpus `canonicalKey` with mapped/ambiguous/unmapped statuses, provenance, deterministic backfill queue, and coverage helpers. Verified coverage is deliberately progressive: 17 roofing/exterior materials use UNSPSC Codeset v8.1201 (e.g. shingles → `30151508`, siding → `30151802`, gutters → `30151703`), plus three governed untreated SPF 2×4 framing-stud keys use `30103605` (`Wood planks`) from the published UNSPSC v17.1001 detailed list. Treated, engineered, and otherwise ambiguous lumber remains unmapped; 7 roofing/exterior entries remain explicitly ambiguous and never silently merge. OmniClass 23 codes are pending verification against the CSI publication.
- **2026-10-08 five-family backfill (merged follow-up):** the full research program landed in `CANONICAL_MATERIAL_CODES` — 397 new rows (319 mapped, 78 ambiguous), all read from UNSPSC Codeset v8.1201, zero invented: framing lumber (83 → `30103603`), engineered lumber (27 → `30103601/602/606/607`), fasteners (109 → 17 verified fastener commodities), concrete/masonry (62 → 5 verified commodities), insulation (116 → `30141503/504/506/507`). Codeset gaps (bagged concrete mix, grout, pavers, housewrap/WRB, tapes, baffles) stay ambiguous with empty code fields and documented reasons. Map now holds 425 entries; 267 map to keys in the static corpus (74 greenfield framing/engineered keys are canonical-ready but not in the corpus yet). Packages live under `docs/research/costbook-classification-backfill/`.
- **Sheathing backfill (2026-10-18 research package):** 63 more rows landed in `CANONICAL_MATERIAL_CODES` — 62 mapped to UNSPSC `30103604` "Wood sheathing or sheets" (OSB, softwood plywood, ZIP and radiant-barrier panels, subfloor and underlayment panels), all UNSPSC Codeset v8.1201, zero invented; commodity rests on the 2026-10-08 full class-30103600 codeset read. One key stays ambiguous with an empty code field: `SHEATHING-DENSGLASS-1_2-4X8` (glass-mat gypsum sheathing — not a wood product; no verified gypsum-panel commodity yet, recorded for a future gypsum/drywall pass). Map now holds 491 entries; 347 mapped / 69 ambiguous against the static corpus. Package: `sheathing-classifications.csv` + `sheathing-verification-report.md` under `docs/research/costbook-classification-backfill/`.
- Classification-assisted matching in `canonicalProductMatcher.ts`: supplier-carried UNSPSC/OmniClass codes confirm an already-strong text match, narrow weak matches to human review, and downgrade code conflicts to human review (duplicate/misattribution prevention). With no codes present, matcher behavior is byte-identical to before.


### Material classification visibility in Costbook Materials — PR #696

The bounded web UI slice adds nullable `omniclass23` and `unspsc` fields to
the web Material DTO, then renders stored codes in the existing
`MaterialsCatalog` on both desktop and mobile through
`MaterialClassification`. A Material with at least one populated code shows
"Classification codes recorded"; with both code fields explicitly absent (null) it shows "Classification
unmapped"; if either field is missing from an older API response and no
other recorded code is available, it shows "Classification unavailable".
None of these labels means the product identity, supplier price, source
publication, or unit conversion has been verified. Supplier/date evidence
continues to use the existing `PricingProvenance` component.

This is read-only. Material create/edit requests, organization permission
checks, supplier price review, pricing engine, and estimate snapshots are
unchanged. The web type accepts missing code fields during phased runtime
rollout. Live migration/backfill, authenticated responsive browser evidence,
and hosted checks require separate verification; the Figma target designs do
not establish backend capability.


## ABC Supply SKU onboarding / live-price evidence (PR #701, 2026-10-09)

Branch `feat/abc-supply-reviewed-material-pilot` proposes a single-product,
operator-reviewed ABC SupplierProduct → Material activation. The operator defaults
to read-only; any mutation requires a validated active owner/admin Costbook
membership, exact product-key/SKU/unit acknowledgements, a separate explicitly
approved baseline price, and an atomic audit/linking transaction. The existing
supplier-worker review queue, rather than automatic price mutation, remains
authoritative. ABC Price Items response lines are additionally checked for
known request ID, matching SKU, USD denomination and representable precision.

**Production database read-only evidence, 2026-10-09:** six Supplier rows,
510 SupplierProducts, 510 SupplierPriceObservations, zero Materials, zero
SupplierPriceUpdates. All 510 observations are ABC Supply **static 2026-09-14
source data**, occupying source rows 1–510; 165 ABC products carry SKUs and none
is linked to a Material. The complete checked-in dataset expects 584 ABC /
3,188 total products. The governed bulk seed is therefore incomplete. A
successful supplier cron with `proposed: 0` does not prove ABC Pricing was
contacted. No new token refresh, real ABC quote, seed, Material write, queue
approval or production deployment was performed for PR #701.

Pending after code review: finish idempotent restricted-role import and verify
3,188 records; manually select one genuinely sandbox-quotable SKU and independently
approved baseline cost; verify unit compatibility; run explicit single-product
activation; trigger protected cron; check for an attributed, tenant-scoped
**pending** proposal and provider token continuity; have a human review before
any Material update. Vercel environment listing returned HTTP 403 in this
inspection, so configuration completeness was not independently verified.
See `docs/operations/ABC_SUPPLY_LIVE_PRICING_PILOT.md`.

## Davis-Bacon SAM.gov wage-feed integration (PR #700, pending)

Implements key-free determination discovery and per-revision document parsing with org-scoped `davis_bacon_determinations` and `davis_bacon_rates`. A composite `(determination_id, org_id)` FK prevents a rate from pointing across tenants; active county coverage is reconciled on complete discovery. SAM.gov downloads execute outside the short RLS-backed persistence transactions. The protected cron reports per-document failures as failures. This feed is **not production verified** until migration and live two-tenant RLS tests pass on seeded staging; it does not approve prices or alter material costs.


## ABC Supply Product API catalog — issue #735 proposed code, not live verified (2026-10-13)

A bounded first-slice implementation is proposed on
`feat/abc-catalog-provider-backed-browse-735`: sandbox
`client_credentials`/`product.read` with bearer-token separation from
existing user-present customer pricing, read-only provider-page validation,
rate/backoff handling, and server-side paginated authenticated Costbook browse.
The route is disabled by default and writes no SupplierProduct, Material,
SupplierPriceObservation, CostItem, or Estimate records. All returned products
are labeled unpriced; the browser surfaces no false current/local pricing.
Tests are proposed but CI/runtime evidence is required before marking shipped.

The requested permanent, indexed 200k+ shared catalog replication and delta
synchronization are **not implemented**. ABC API Terms (Apr 9, 2026) prohibit
building a database or permanent copy of content without express permission
and restrict caching; obtain written ABC approval (storage, retention, search
display, image use, deletion/inactive semantics) before that persistence slice.
Existing September research-seed ABC rows must not be counted as an authenticated
Get All Items import. No verified live item count, user-authorized positive
customer quote, database import, deployed UI, or estimate-from-live-ABC test
is claimed for issue #735. Provider-backed browse is not the final acceptance
of the founder's full-catalog mission.


## ABC Supply Product API real-sandbox verification — proposed follow-up (2026-10-13)

PR #736 is merged on `main` as `e3e8a872227e7a52cad3a216e357a88f3c03f760`; its provider-backed catalog browse remains disabled until intentionally configured. The next bounded branch `feat/abc-catalog-live-sandbox-proof-735` adds a manual guarded sandbox Product API proof. It will verify `client_credentials`/`product.read` and one or two real pages, then report only provider totals and checked in-memory identity counts; it never stores catalog data, changes Materials, or requests customer-specific prices.

Until a **successful manual Actions run** using authorized credentials exists, no live sandbox item totals, imported records, checked branch availability, deployed browse URL, or verified positive customer price should be claimed. The separate ABC Terms permission for permanent replicated catalog storage remains pending. Full data ingestion and incremental sync are not complete.


## ABC Supply on-demand product detail — proposed issue #735 slice (2026-10-13)

The branch `feat/abc-catalog-product-detail-735` extends the merged read-only `AbcCatalogClient` with the provider's documented sandbox `GET /api/product/v1/items/{itemNumber}` endpoint (with variation and same-family embedding). The authenticated Costbook detail surface, linked from ABC catalog search, displays exact item identity, provider product hierarchy, UOM options, nested length variations, related family records, and Prop65 warnings without inventing missing attributes. Only Active items with exact matching item numbers may be displayed. This route shares the existing ABC catalog global rate budget, respects the disabled-by-default browse gate, and does not make Material, CostItem, SupplierPriceObservation, Estimate or customer-pricing writes. Branch/customer availability is deliberately `not-verified` until user-present account and branch authorization.

This is code proposed for CI/review, **not** proof of a successful Get Item sandbox call, complete catalog import, live price, or deployed browser. ABC permission for durable catalog replication/display and the manual product.read live proof remain independent gates.

## ABC hierarchy browser — issue #735 follow-up

Following merge of #737 and independently merged #738 (on-demand Get Item), branch `feat/abc-hierarchy-browser-735` adds the separate **Get Product Hierarchy** read path and web screen. It supplies six official ABC category code/label levels with pagination, supplier-sourced only; TradeOS Costbook will link to it from the sandbox catalog. The feature is disabled by default and uses the same sandbox TPA `product.read` read credentials, Costbook permission, rate limit, and no-persistence contract as the existing browsable product list. This does not import, index, or license the full ABC catalog, prove a live provider call, expose branch-specific availability, or complete pricing-to-estimate. CI and authorized hosted browser evidence remain pending until verified.

## ABC branch ordering eligibility — issue #735 proposed continuation

On branch `feat/abc-branch-order-availability-735`, TradeOS adds a sandbox-only, provider-backed Get Item Availability read and a contextual product detail link. The ABC response lists branches at which an item can be ordered and its provider-listed dimensional lengths. It does **not** represent on-hand inventory stock, specific customer's Ship-To approval, a Price Items quote, verified material price, or persistent catalog synchronization. The same catalog feature flag, `costbook.read` permission, global rate limiter, and server `product.read` token govern the read; no supplier responses are cached or written to the database.

Until exact-head CI, real ABC sandbox integration and authenticated hosted UI evidence run, this is unproven against genuine provider availability. ABC data-copy rights and user-present customer-specific pricing remain external blockers. Issue #735 stays open.


## Costbook picker control ergonomics — 2026-10-23

The existing embedded Costbook/assembly catalog picker now uses 44px search,
Section and Quantity inputs below 1024px (32px text inputs at larger widths),
plus 44px Add, Clear, native cost-type Select and Taxable label targets. Shared
primitives and their defaults are unchanged. Search, preview gates, mapping,
mutation payloads, explicit Estimate Add, retained errors and reset behavior
remain the existing source contract.

The isolated `tests/components/catalog-item-controls.spec.ts` mounts the actual
production picker, React Query, Base UI components and Tailwind at four widths.
It exercises focus/keyboard selection, failed stored-cost preview, Clear with
retained non-default values, quantity validation, non-default Add payload,
pending/failure/retry and confirmed-success reset using synthetic transport.
This harness does not prove authenticated persistence, tenant isolation, live
supplier pricing, or full illustrated-shell parity. Current-head test results
are recorded in the PR and Figma handoff, not inferred from source assertions.

## Assigned-job task visibility (Today follow-up, 2026-10-27)

`GET /api/v1/projects/assigned-job-tasks?limit=50` returns open shared tasks
attached to the authenticated user's actively assigned, non-archived, nonterminal
Jobs. The controller derives organization and user identity from authentication;
unknown query keys and limits outside 1–50 are rejected. The service additionally
filters Project and Job tenant ownership and active (not removed or declined)
JobAssignments, under the existing forced RLS session. This projects the same
tasks already exposed by an authorized Job detail read; it grants no writes.

Technician Today uses this endpoint rather than the organization task queue.
Shared tasks appear in Work, with blocked/overdue tasks in Needs You and due-day
counts using stored calendar dates. Free-text `assignedTo` remains display-only,
not personal authorization. Field rows open `/field?job=…`; the existing Field
workspace now displays Job DTO tasks and directs progress reports to Job notes.
Task status edits retain existing office permissions. Results at the 50-row cap
are explicitly partial; a task-source failure leaves job scheduling usable and
task counts unknown. No schema, RLS policy or mutation authority changed.

## Today routine follow-up recovery (2026-10-27)

The existing `tradeos.athena.tools.office.create-follow-up` tool now advertises
optional action-engine idempotency. Previously its `not_supported` metadata
bypassed reservation even when the Workspace supplied a stable retry key, so
an ambiguous-response retry could create a second task. Keyed calls now reuse
the existing durable receipt scoped by tenant, actor, tool and version, with
canonical validated-input binding. A changed input under the same key fails
closed. Unkeyed legacy callers retain their previous behavior.

This repairs execution recovery for an existing low-risk internal task tool;
it does not send customer messages or grant new permissions. `crm.write`,
resource/service tenant checks, RLS, audits and all approval policies remain
unchanged. High-risk confirmation/resume is still a separate contract; this
change does not turn an approval state into success or resubmit restricted
actions. Action-engine dispatch is required for receipt guarantees; calling
the service or tool handler directly does not provide deduplication.

## Personal field-task ownership and status updates (2026-10-27)

Implementation on `feat/field-task-ownership` adds nullable
`ProjectTask.assignedUserId` (user FK, no name-based backfill). Shared job tasks
remain readable. Only the authenticated technician personally assigned by user
ID, with an active non-declined JobAssignment on a nonterminal/unarchived Job,
may use `PATCH /api/v1/jobs/:jobId/tasks/:taskId/status`. The strict payload is
status plus mandatory expectedUpdatedAt. The transaction locks Job/assignment
rows, checks tenant/identity/revision, updates atomically and records activity.
Stale saves return 409; invisible/not-assigned records return 404.

The migration removes technicians from the historical broad project-task write
policy (whose generic helper includes technicians), adds a narrowly scoped RLS
update policy, and restricts technician updates to status/timestamps with an
immutable-column trigger. DB-controlled timestamps retain millisecond revision
precision. Technician task create/delete/reassignment remains denied.

Owner/admin/dispatcher may create or revise explicit assignment through the
Project Tasks forms and the existing guarded generic PATCH. The new scoped
`GET /api/v1/projects/:id/task-assignees` returns only permitted active-member
choices and a server-derived capability. Legacy estimator ordinary task writes
are preserved; this new identity-administration capability is not silently
granted. Existing office status/title/note updates do not revalidate historical
assignment eligibility unless identity or Job linkage changes.

Today and Field job details return a server-derived canUpdateStatus flag based
on the actual auth role, not the normalized settings presentation role. Only
explicit nonempty matching identity, revision and capability enable the shared
status editor; older/partial responses fail closed. UI saves use the narrow
Job endpoint and verify record/project/Job/status before showing success.
Assignment changes refresh the source and operational routes. No optimistic
queue dismissal, automatic retry, financial change or production migration.

This is a schema/RLS change requiring governed review and migration rehearsal
before activation. Unit/type/build and hosted PostgreSQL/browser results must
be recorded from the final head; authored tests alone are not certification.
## Step 9 accepted-proposal field handoff — PR #810 (unmerged)

A proposed, separate branch closes the missing accepted Proposal → tracked Job
link: a manager selects the customer's ServiceAddress; the backend creates
one unscheduled Job, preserves accepted proposal scope and price as an immutable
JSON baseline and returns the existing job on retries. The workflow remains
behind an additive DB migration, exact-head CI, authorized staging and
authenticated end-to-end evidence. **This is not shipped or production
certified**, and it does not automatically assign a crew, sign a contract,
create invoices or change accepted prices. See `docs/modules/jobs-and-scheduling.md`.

### Step 9 approved Job display (PR #810, proposed)

The unmerged accepted-proposal handoff branch also adds a manager-only Job approval-baseline detail page, linked from the successful conversion, with source proposal provenance and immutable scope/price/terms. It remains unshipped pending exact-head CI, staging migration, and authenticated browser evidence.

### Pending P0 staging migration-history reconciliation — 2026-10-28

Merged PR #812 provides a protected, staging-only reconciliation of the already-executed invoice expand migration. Direct evidence: Supabase migration history stores the exact executable SQL used by the tracked Prisma file (comments differ); staging has 46 applied Prisma migrations, 0 unfinished, and 42 invoice rows with matching old/new monetary values. The workflow has been merged but has not been executed as of the latest verified staging ledger read. The later invoice contract migration remains blocked pending proof all legacy writers are retired. No production migration or staging schema deployment is certified.

The guarded staging migration workflow now enforces a hard stop on the destructive invoice contract phase until the protected Environment holds a matching approved retired-writers SHA and a separate exact dispatch confirmation. The gate is merged; neither reconciliation nor contract deployment has executed as of the latest verified staging ledger read.
