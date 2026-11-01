Warning: truncated output (original token count: 45080)
Total output lines: 1622

---
status: current
owner: platform
last_verified: 2026-10-29
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

## Frozen Apply recovery — 2026-10-31

Full review now retains one Apply payload across an unconfirmed response, blocks concurrent edits/generation and ignores obsolete-record callbacks. A first-attempt known server refusal permits correction; a later refusal cannot erase uncertainty from an earlier lost response. See [AI Estimate Assist](modules/ai-estimate-assist.md#frozen-apply-recovery--2026-10-31) for the owning contract and verification boundaries. Saved-line identity, authenticated acceptance and financial fixture continuity remain separate gates; no full-workflow or deployment certification is claimed.


## Estimate full-review scope continuity — 2026-10-31

The builder's header and contextual Athena review entry now share one guarded navigation path. Dirty draft scope is saved through the existing Project PATCH before navigation; failed saves retain the editor and never navigate, duplicate entry is blocked, and leaving the record suppresses late navigation. Unchanged scope and finalized estimates do not gain a new write. The builder is keyed by Project/Estimate so record changes start fresh local draft state.

Full review reads the authorized Project response, verifies that it owns the requested Estimate, and seeds the editor with saved `simpleScope`. Missing or mismatched pairs fail closed. It still starts without suggestions or a structured draft; generation and Add remain explicit. No scope is placed in URLs/browser storage, and no auth/RLS, schema, pricing, or backend contract changes.

This implements the intent of the Figma full-review continuity targets (390 `1098:30215`, 768 `1098:30274`, 1024 `1098:30333`, 1440 `1098:30399`), not full visual parity or end-to-end readiness. Local focused validation: 9 behavioral navigation/record-pair tests plus 15 existing Estimate mobile contracts passed (24 total). Full web tests, lint, TypeScript/build, component/browser and authenticated persistence/tenant evidence remain required; this environment contains only fetched source snapshots and has no web dependencies. Initial head 73702f3 passed 561 web tests, 47 existing component cases, lint/build, docs and 189 PostgreSQL integration tests. Code head `6c8056e` then passed [Verify repository 41218673255](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/41218673255): 561 web tests, all 51 component cases (including four new real-Builder cases at 390/768/1024/1440), web lint/build/type checking and 189 PostgreSQL integration tests. The four retained failure screenshots were inspected. A subsequent cleanup only removes the unused fixture variable found by code-quality review; final-head checks remain a merge gate. Synthetic router/transport do not establish authenticated durable reload or tenant denial. No merge, deployment or completed numbered sprint is claimed.


## Estimate quick-create partial-failure recovery — implementation branch, 2026-10-29

The Today and Universal Create estimate path saves a Project before posting a
draft Estimate. On `fix/estimate-create-saved-project-recovery`, a failed or
ambiguous Estimate POST redirects to the saved Project with an explicit notice
to inspect its Estimates before starting another. The form is not submitted a
second time, so the recovery does not create another Project automatically.
Successful Estimate creation still opens the existing Estimate Workspace.
This bounded frontend change does not add backend idempotency, infer whether an
ambiguous POST committed, or certify an authenticated browser journey. Merge
and deployment remain subject to current-head checks and repository review.

## Cinematic sign-in entry — implementation branch, 2026-10-24

Founder-approved entry presentation is implemented on `feat/cinematic-entry`
from main `7013cdcaab8faabcb9c0dd8e7a045ac776c9c748`. `/login` now uses the
approved full-screen copper mark/wordmark introduction and centered sign-in
scene. Initial visits use four seconds; returning visits use 2.5 seconds.
Reduced motion bypasses the introduction; Skip/Escape and a metallic vector
fallback keep entry usable without WebGL, storage, or a loaded renderer chunk.

The existing `loginAction`, session/bootstrap logic, dashboard destination,
password recovery and account creation remain authoritative. No simulated
success state, inspection controls, auth policy, backend, database or workspace
theme changes ship. Route-local tokens and self-hosted fonts live in
`web/src/components/entry/entry.module.css`; the canonical brand exception and
component owners are recorded in `.stitch/DESIGN.md` and `docs/ui-guide.md`.

Local validation: 513 frontend unit tests, lint, TypeScript and the production
build pass; production dependency audit reports zero vulnerabilities. The real
entry component was visually inspected in an isolated browser harness with
synthetic transport. This does not certify successful authentication, deployed
behavior, Lighthouse scores, or actual GPU rendering. Six new component-browser
specimens cover responsive forms, timed/keyboard entry and GPU/storage failure;
local execution is blocked before launch by a missing Chromium binary after
the official download returned an invalid archive. Hosted checks passed on this PR head; review and deployment verification remain separate gates.
## Field authorization evidence — PR #702

The Field page now has executable denied-role tests, alongside its static
UI/action contract checks. Missing authentication and non-technician roles
return before job requests, including direct job links. JobsService tests
assert unassigned technician reads/transitions fail without status or activity
writes. A disposable-PostgreSQL test covers both an unassigned job and a same-org job assigned to another technician against raw reads and updates, with service denial for the unassigned case. Hosted integration and repository checks passed at the merged PR head; local Docker was unavailable. No RLS, authorization policy,
storage implementation or field capture capability is changed or certified.
## Proposal draft status-check recovery — 2026-10-29

The finalized Estimate Review links to the existing Proposal Review form with its `estimateId`. That form creates a draft through the existing proposal action; customer send remains a separate explicit action, and returned errors preserve edited fields.

The form's API-error state provides a direct link to the same authenticated Project's Proposals tab (`?tab=proposals`) so staff can inspect the list before manually retrying. Local payment-schedule validation stays inline. This is a navigation aid, not a server status lookup or idempotency guarantee: it does not auto-retry or infer the POST result. Authenticated runtime behavior and tenant-denial evidence remain separate verification gates.

## Web performance telemetry — PR #744

The Next.js root layout includes Vercel Speed Insights for browser performance
measurements. The dependency is scoped to `web/`; the JSON-only Express API
does not load a browser telemetry SDK. This does not certify production metrics
collection or enable the optional service in the Vercel project dashboard.


## API validation security prerequisite — 2026-10-27

Existing PR #795 is extended to repair the dependency audit blocking Today 2.0 PR #798. The isolated runtime branch retains dotenv/Vercel patch updates, adds patched Zod 4.6.7 including Vercel's transitive validator, and includes body-parser 1.20.9 from #799. The previous identifier syntax contract is preserved using `z.guid()`; record and enum pipeline compatibility repairs do not alter JWT/membership, permissions, RLS, financial or supplier policy. No production change or merge is claimed. Full verification and PR-only major-upgrade review remain required; the independent moderate ip-address patch is tracked by #786. See [runtime upgrade evidence](architecture/API_VALIDATION_RUNTIME_UPGRADE.md).

## Today AttentionItem component proposal — 2026-11-01

PR #841 (`feat/today-attention-item-figma-align`) extracts the existing Today Needs You row into a reusable, responsive `AttentionItem` component, mapping persisted priority to Info, Action, and Urgent presentation while preserving the existing source data and open-item action. Figma source: master file `xImUa9CYUjx3Cb3zTrkfnY`, node `16:42`. This is proposed code only; it has not been merged or deployed. Figma Code Connect metadata inspection is blocked by the connected seat's access level. See [Figma traceability](design/CORE_WORKFLOW_FIGMA_CODE_TRACEABILITY.md).



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


## Estimate mapping keyboard repair — on main

The Figma mapping handoff keyboard work is on main (branch
`fix/estimate-mapping-keyboard` no longer exists in remotes; the picker
carries the contract and the component suite covers it). PR #781 is merged as
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
Authenticated full-app workflow evidence remains pending.

## Estimate mapping resolve screen — dedicated install-time gate

Selecting a starter recipe in the estimate builder now opens a dedicated
"Resolve required assembly mapping" screen instead of an embedded panel. All
recipe components map on one screen through the existing
`StarterComponentMappingPicker` and compatibility assessment, with
incompatibility reasons inline. A "Before you continue" checklist surfaces
the four already-enforced checks — mapped identity, unit/kind
compatibility, active organization access, and price-snapshot persistence
on the separate Add — and the explicit actions are "Resolve Cost item
mappings" (Install, then the existing separate Add) and "Keep draft
unchanged" (close with zero mutation; Install never fires). No backend,
auth/RLS, pricing, snapshot or mutation contract changes; the install gate
conditions are unchanged, only surfaced. This is the install-time gate only;
no re-resolve flow for saved estimates is added. The handoff step/state
matrix is covered by extended component evidence (checklist states,
resolve gating, install pending/failure, keep-draft zero mutation) and a
new intercepted Playwright matrix spec for the authenticated journey,
which still needs a signed-in session and draft route to run.

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

The canonical mobile Entry response frame `548:2780` specifies 48px credential inputs/sign-in action and a 44px recovery target. The login page now overrides shared Input/Button default heights at its own callsites and announces …25080 tokens truncated…to one column. Scope is now editable in place and persists through the existing partial Project PATCH using `simpleScope`; the same current draft is passed to contextual Athena. Items remain the single production list and now expose only the source identity the persisted estimate line actually carries: Assembly source, Costbook source, or Custom item. Price keeps the existing authoritative pricing controls. Review remains customer-facing while preserving the real lifecycle: draft estimates finalize first, then create a proposal; the UI does not pretend a draft estimate can directly send a proposal.

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
### Pending P0 staging migration-history reconciliation — 2026-10-28

PR for issue #811 proposes a protected, staging-only reconciliation of the already-executed invoice expand migration. Direct evidence: Supabase migration history stores the exact executable SQL used by the tracked Prisma file (comments differ); staging has 46 applied Prisma migrations, 0 unfinished, and 42 invoice rows with matching old/new monetary values. The workflow is **not merged or executed** by this documentation change. The later invoice contract migration remains blocked pending proof all legacy writers are retired. No production migration or staging schema deployment is certified.

The follow-up staging migration workflow now proposes a hard stop on the destructive invoice contract phase until the protected Environment holds a matching approved retired-writers SHA and a separate exact dispatch confirmation. Neither this gate nor the history reconciliation has been merged or executed at this point.

### Proposal draft create idempotency — merged PR #819 (2026-10-29)

PR #819 merged to `main` as `bc85a503025be60c6ff472a03a17fa34c0565ec8` from reviewed head `895115789a80934aad75201889ea3c22845df77b`. Proposal Review sends a per-attempt UUID in `Idempotency-Key`; the authenticated API derives the organization-scoped Project, stores a canonical SHA-256 request fingerprint, and enforces one row per `(project_id, idempotency_key)`. A new draft returns `201`; the same key and canonical payload replay the original proposal with `200` and `Idempotency-Replayed: true`; changed payload under the same key returns `409`. Keyless legacy clients remain compatible without deduplication. The additive migration adds nullable key/hash fields, a paired-null constraint and project-scoped unique index; auth, tenant context, RLS, permissions, price derivation and separate proposal-send behavior are unchanged.

The client retains its UUID across server-action errors. A full reload seeds a new key, so the existing authenticated Project proposals list remains the recovery path. There is no status lookup endpoint or automatic retry. Exact PR-head verification passed: App/Web unit and integration tests, typecheck/build/lint, PostgreSQL migration/RLS rehearsal, Docs consistency (#4755, #4758–#4760), live docs reconciliation, governance, branch currency and dependency review. PostgreSQL concurrency coverage verified four same-key requests under request-scoped RLS: one insert, three replays, one persisted proposal. The merge is verified on `main`; this is **Implemented**, not evidence of production deployment. The protected production migration has not been executed, and authenticated production/browser behavior is not certified.

## P0 Team & Time schema and RLS remediation — 2026-10-30 (PR #827, draft)

The staging-only Supabase Team & Time table migrations were formerly missing from repository migration history. This branch adds tracked Prisma equivalents `20261030004500_team_time_foundation` and `20261030005500_team_time_integrity` before `20261030010000_force_team_time_rls`; missing tables now FAIL the FORCE migration instead of marking a no-op applied. Existing tables are preserved and no anon/authenticated access grants or tenant policies are added. Deployed staging Edge Function v6 is the source baseline for a not-yet-deployed paginated candidate at `supabase/functions/team-time/index.ts`, tested with synthetic authenticated caller/membership/job/shift requests and 201-shift/oversized-workspace regressions.

Crucial boundary: the live Edge Function uses a server-side Supabase **service-role** key (BYPASSRLS). FORCE does not change that and is not sufficient for service-role tenant isolation. Explicit organization, membership, assignment and shift checks are the actual function authorization gates; new tests verify denial paths. Staging currently has ENABLED but not FORCED RLS and zero policies. All migrations and function snapshot are source-only pending exact-head CI, review and protected staging approval. Production Team & Time remains disabled; no runtime deployment is claimed.
