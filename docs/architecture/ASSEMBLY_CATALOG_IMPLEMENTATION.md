---
status: current
owner: costbook
last_verified: 2026-11-23
source_of_truth: true
related_code:
  - app/modules/assemblies-database/catalog.ts
  - app/modules/assemblies-database/tradeosCatalogAdapter.ts
  - app/modules/assemblies-database/kitchenGapCatalog.ts
  - app/modules/assemblies-database/openingsApplianceGapCatalog.ts
  - app/modules/costbook/tradeosAssemblies.ts
  - app/modules/costbook/tradeosAssemblySources.ts
  - app/modules/assemblies-database/service.ts
  - app/modules/assemblies-database/measurement.ts
  - app/modules/assemblies-database/recipeHistory.json
  - app/modules/assemblies-database/recipeUpgrade.ts
  - app/backend/controllers/assembliesDatabase.controller.ts
  - app/backend/routes/costbook.routes.ts
  - web/src/components/costbook/assembly-catalog.tsx
---

# Assembly Catalog Implementation

## Outcome

TradeOS exposes a contractor-facing residential assembly catalog organized by
familiar NAHB work groups while retaining CSI MasterFormat division and section
codes. Installing a catalog recipe creates a real, tenant-scoped `Assembly` and
its `AssemblyItem` rows. It does not create a parallel assembly table or pricing
engine.

The catalog contains **107 templates** (verified 2026-11-23 at main `255bbc41`):

- **14 reviewed starter recipes** — TradeOS-authored, `review.status =
  "reviewed"`, `reviewedOn: 2026-09-17`, covering site work, concrete, framing,
  roofing, siding, openings, drywall, painting, flooring, finish carpentry,
  electrical, plumbing, HVAC, and decks.
- **88 research recipes** — the TradeOS research corpus (`TRADEOS_ASSEMBLIES`),
  `review.status = "research"`, `reviewedOn: ""`, sourced from Billy's assembly
  research (Google Drive, pulled 2026-10-06). Estimator review is required
  before install; the UI labels them "research review required."
- **2 kitchen-gap recipes** — prefabricated wall-cabinet installation and
  straight-run laminate countertop (CSI 12, NAHB phase 5000), source-backed
  (SRC-0069, SRC-0070).
- **3 openings/appliance recipes** — new-construction flanged vinyl window,
  sectional steel garage door, ready-connection built-in dishwasher (CSI 08/08/11),
  source-backed (SRC-0071–SRC-0073).

The API serves all 107 as one expanded catalog with version string
`2026.09.1+research88+kitchen2+openings3`. **105 of the 107 are installable.**
Two research recipes are install-blocked on unregistered evidence sources and
the install API rejects them with 422 (see "Source-blocked recipes" below).

In flight at this writing: PR #1037 (DEV-17 S9, bulk mapping reuse) is open
and unmerged; it changes mapping suggestions only and does not change template
counts.

## Safety and pricing contract

- The catalog contains quantities and classification, not prices.
- The estimator must map every recipe slot to an active Cost Item owned by the
  authenticated organization before installation.
- The server rejects duplicate, missing, or unknown recipe slots.
- Every component declares compatible construction units and Cost Item kinds;
  both the mapping picker and install service reject mismatches.
- The server reloads every mapped Cost Item with `orgId` and `isActive: true`;
  an inactive or cross-organization identifier fails closed.
- Installation explicitly joins an active request transaction or opens a new
  Prisma transaction, so Assembly and AssemblyItem writes are atomic in HTTP,
  background, and direct-service execution. Forced RLS remains the database
  boundary.
- Installed assemblies reuse current Costbook unit-cost resolution and Estimate
  pricing snapshots. Installation never rewrites historical estimates.
- Recipe quantities are estimating defaults. The UI requires review of waste,
  production, code, permit, access, and local-condition assumptions.
- Installation accepts optional per-install waste/production overrides
  (`wasteOverridePct` 0–100, `productionRateFactor` >0, ≤10; PR #1036) stored
  on the installed assembly and applied at pricing time; recipe quantities are
  never rewritten and child assemblies resolve with their own overrides.
- Research recipes fail closed on unregistered evidence sources: a recipe whose
  `evidenceRefs` do not all resolve against `TRADEOS_ASSEMBLY_SOURCES` carries
  `blockingReasons` and cannot be installed until its provenance is repaired.

## Recipe versioning and installed updates

The catalog release label groups recipes for browsing. Each recipe's integer
version is its revision count in `recipeHistory.json`. For a new recipe, add
its initial structure at version 1. For an existing recipe, append one
revision when a slot is added or removed, its quantity changes, its compatible
units or Cost Item kinds change, or the recipe measurement basis changes.
Each slot key is a stable identity. Issue a new key when a slot represents a
different component and its prior mapping should end. Preserve all published
history entries for upgrades from older installs. The catalog invariant suite
checks the current structure against the latest entry and rejects adjacent
duplicates. Editorial copy, provenance, and ordering changes leave the
version unchanged.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:bbad0b602b2e00cd059320d10620822e9db64ad303113fd7352a3a9ec5d86557 -->

The installed template detail compares versions and lets a Costbook writer
review the diff for that assembly. Existing compatible mappings carry
forward. A removed slot drops its mapping, and a new slot or an incompatible
mapping requires an explicit Cost Item selection. An unverified component
blocks confirmation. Removing it in the editor drops that component and its
installed mapping; the editor has no supported action to assign it a verified
slot. A stale review must be refreshed. Confirming locks the reviewed assembly
and components and atomically records the update and audit event. The
configured waste and production overrides carry forward. Costbook price
records and persisted estimate snapshots stay as recorded.

### Post-merge follow-up risks (PR #1091)

[PR #1091](https://github.com/404TradeOS-LLC/TradeOS/pull/1091) merged as
`05e49a517e8e6f62660a162e107ff6147cbd7ffb`. The PR reports a disposable
PostgreSQL rehearsal and passing hosted checks. Staging acceptance is still
owed after promotion; the PR discussion contains no staging result.

- **Mixed deployments can reject installs or leave a provenance gap.** Apply
  the migration before the backend, then deploy the web. The previous backend
  rejects the new version field with `400`; it can still accept an old
  request and create an unversioned install after the one-time backfill has
  finished. The release owner should verify the migration ledger and the
  deployed API and web builds on the same staging candidate. Pause catalog
  installs while old API instances can still write after the backfill, or
  reconcile installs from that window by tenant before release. Verify the
  current-version `201` and stale-version `409` with no rows written, and
  verify both web entry points forward the version. Inventory any remaining
  callers that omit it before considering a required version field.
- **Legacy and local layouts can lose components during reconciliation.**
  The migration leaves rows without install markers unlinked and only assigns
  slot keys when the complete position and quantity set matches. Ordinary
  editor additions also have no slot key. Removing an unverified row to
  unblock review is a separate write that can change future resolved unit
  cost even if the upgrade is abandoned. Inventory unlinked and unkeyed
  installs using tenant-scoped results; do not infer identity from a code
  alone. Before the first structural revision, define an estimator recovery
  path that preserves the original rows and mappings for comparison and
  checks both cancellation and the resulting unit cost.
- **Published version history can be rewritten without a test failure.**
  The invariant test compares the latest entry to the current recipe and
  rejects adjacent duplicates. It does not compare published entries to the
  base revision. Editing an older entry can change upgrade diffs for installed
  tenants; editing the recipe and its last entry together can hide drift
  without increasing the version. Before publishing version 2, add a check
  that existing histories retain the published prefix and append a new entry
  for structural changes.
- **Upgrade coverage stops short of the deployed browser path.** The live DB
  tests cover tenant isolation and competing confirms; the web upgrade test
  checks source text. Use a disposable version 1 fixture with a version 2
  target in a nonproduction candidate. Exercise picker selection, a successful
  confirmation with one actor-attributed event, and a stale review from a
  second session. Verify that refreshing lets the estimator review again,
  the rejected confirmation leaves components and history unchanged, and a
  same-tenant reader and another tenant cannot confirm or see data outside
  their permissions. Check the Costbook web proxy and both API route mounts.

<!-- /coderabbit-ai-generated:v1 -->

## Source-blocked recipes (2 of 107)

| Recipe | CSI | NAHB phase | Missing source |
|---|---|---|---|
| `tradeos:demo-roofing-shingle-tearoff-2layers` | 02 | 1000 | SRC-0049 (unregistered — no repo text names its intended source) |
| `tradeos:demo-cabinet-kitchen-base-wall` | 02 | 1000 | SRC-0050 (unregistered — same) |

History: 11 research recipes originally cited SRC-0041–SRC-0050 with none of
them registered. PR #1018 (issue #518 S1, squash `1d1e23fe`, merged
2026-11-22) registered SRC-0041–SRC-0048 from the standard named in each citing
assembly's own assumption text (publisher homepage URL only; no edition years
or document URLs asserted beyond that, because the research corpus records
none). SRC-0049/SRC-0050 remain unregistered deliberately: their intended
source is Billy's call, not a guess. The two blocked recipes render in browse
with a visible "Research evidence pending" alert and are not installable.

## API

- `GET /api/v1/costbook/assemblies/starter-catalog` requires `costbook.read`.
  Returns `{ catalogVersion, coverage, items }` where `coverage` is the derived
  NAHB × CSI matrix (`EXPANDED_ASSEMBLY_CATALOG_COVERAGE`) and `items` is the
  full 107-template expanded catalog.
- `POST /api/v1/costbook/assemblies/starter-catalog/install` requires
  `costbook.write` and accepts `templateId` plus one Cost Item mapping per
  required component key. Rejects source-blocked recipes with 422.
- Compatibility aliases exist under `/api/v1/assemblies`.

## Implementation checklist

- [x] Reconcile the existing Assembly model, Costbook pricing path, permissions,
  tenant isolation, and Estimate snapshot behavior.
- [x] Define the NAHB residential work-group navigation and CSI-coded recipes.
- [x] Add transparent measurement bases, component quantities, waste guidance,
  and review language.
- [x] Add authenticated read and install endpoints without a schema migration.
- [x] Require complete component mapping to existing organization Cost Items.
- [x] Reject duplicate codes and inactive/cross-organization component IDs.
- [x] Create real reusable Assembly and AssemblyItem records.
- [x] Add responsive browse, search, filter, mapping, installed-state, and error
  handling to `/costbook/assemblies`.
- [x] Preserve manual assembly creation, editing, nesting, costing, lifecycle,
  permissions, and current Estimate consumption.
- [x] Add catalog-integrity and service-level installation regression tests.
- [x] Pin catalog and recipe versions, review metadata, component quantities,
  compatible units, and compatible Cost Item kinds in regression snapshots.
- [x] Publish a machine-readable NAHB/CSI coverage matrix from the catalog.
- [x] Make installation explicitly transactional and cover the active tenant
  session with live RLS integration tests.
- [x] Replace bounded dropdown-only mapping with server-backed Cost Item search
  and prevent duplicate or incompatible selections in the UI.
- [x] Add price-neutral browse facets for NAHB group, CSI division, trade,
  assembly output unit, and installed status with combined text search.
  Installation status is derived from all paginated active assemblies in the
  authenticated tenant, not guessed from the current page or source recipe.
  Filtering clears stale recipe mapping/preview state and disables installation
  for read-only actors or already-installed recipe codes.
- [x] Expand the catalog trade by trade beyond the initial 14: 88 research
  recipes activated (#771), 2 kitchen-gap recipes (#773), 3 openings/appliance
  recipes (#774). All 93 carry evidence refs and install through the same
  tenant-mapping pipeline; 2 remain install-blocked on SRC-0049/SRC-0050 (see
  above). "Reviewed" still applies only to the 14 starters — the 93 research
  recipes are explicitly unreviewed.
- [x] Add formal measurement contracts and takeoff derivation for assemblies
  (issue #518 S8, PR #1035, squash `efdc5364`, merged 2026-11-23): five
  takeoff families (area, linear, count, volume, allowance) plus mass/time
  component families; exact area-only conversion; contract failures fail
  closed at install (422).
- [x] Support waste/production overrides at assembly install (issue #518 S10,
  PR #1036, squash `255bbc41`, merged 2026-11-23): optional `wasteOverridePct`
  (0–100) and `productionRateFactor` (>0, ≤10) stored per installed assembly
  and applied at pricing time through the existing `getUnitCost` path; recipe
  quantities are never rewritten.
- [ ] Add authenticated rendered browser evidence for owner/admin and read-only
  roles against a disposable tenant. A manual SHA-attested, two-identity,
  1440/390px Playwright evidence workflow has been added but **has not yet
  produced authenticated runtime screenshots**; keep this item open until a
  sanitized, non-production, exact-deployment run has passed and artifacts
  have been reviewed. (Issue #518 S5; 7/7 workflow runs failed as of the
  2026-11-21 triage, latest 2026-10-11. Diagnosed 2026-11-22, DEV-17 S5: the
  failures were a workflow-file parse error, already fixed on main via #853;
  a green run is still blocked on Billy-only read-only smoke secrets.)
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:2fc3888b2ad0e552ab3456a85abd8d070fd804cdf8851ceca6117c15791e4d50 -->

- [ ] Add a mapping-quality review queue before supporting organization-wide
  recipe upgrades. PR #1091 added installed template origin fields and
  per-template history and review. Organization-wide upgrades are outside
  that flow.

<!-- /coderabbit-ai-generated:v1 -->
- [ ] Connect derived takeoff quantities to takeoff records (S8b): the S8
  measurement contracts and derivation are merged (PR #1035), but the
  takeoff-record connection remains a named follow-up gated on S065 + S4; the
  installed-assembly workflow still needs production evidence first.
- [ ] Surface `reviewedOn` / `regionalBasis` in the catalog UI. The API serves
  both fields, but the browse/detail UI does not render them (verified
  2026-11-23); it shows evidence-ref count, measurement basis, waste guidance,
  and blocking reasons only.
- [ ] Fix the CSI division 04 gap in `CSI_DIVISIONS`: two research recipes use
  division 04 (Masonry) but the constant omits it, so division-04 recipes are
  invisible to any facet/validation built on that list. (Found 2026-11-22,
  S11 review; still open at main `255bbc41`.)
- [ ] Normalize trade-family strings: "Finish carpentry" vs "Finish Carpentry"
  and "Sitework" vs "Site Work" are near-duplicate facet values. (Found
  2026-11-22, S11 review.)

## Browse-facet contract (October 2026)

The starter catalog endpoint is unchanged: it returns one bounded,
price-neutral catalog containing NAHB and CSI classification. The
web UI derives four classification/unit dropdowns from returned recipes and
adds an **Installed / Not installed** facet using the complete active
Assembly-code list loaded in the authenticated workspace. Combined searches
are case-insensitive; empty sets, clear filters, and matching-result counts are
explicit. Changing any facet deselects the prior recipe and clears Cost Item
mappings and unit-cost preview so no hidden recipe inherits stale mappings.
Selecting a new template restores the existing review and mapping workflow.
These are **client-side catalog facets**, not a server query over a
bounded tenant catalog or a second pricing system. The existing Assembly list
above/below the catalog browser remains keyset-paginated and tenant-scoped.
No backend write path, schema migration, source recipe, cost or Estimate
snapshot was altered. Authenticated owner/admin and read-only browser captures
at desktop and 390px remain required before release certification.

## Authenticated Assembly Catalog evidence lane (October 2026)

`.github/workflows/assembly-catalog-browser-evidence.yml` is a manual-only
Preview evidence runner for the implementation merged in PR #709. It requires
an immutable Vercel Preview URL, exact deployed commit SHA, expected isolated
Supabase project ref, and canonical sanitized smoke tenant ID. It authenticates
**distinct owner/admin and read-only identities** through the real login form,
using separate short-lived runner-temp storage states, then exercises the
reviewed Assembly Catalog browse facets at 1440px and 390px using read-only
navigation and filter interactions. The test requires installation enabled for
owner/admin when an uninstalled recipe is selected and disabled for read-only
staff. It verifies no Assembly API writes and checks for responsive overflow,
empty-filter recovery, mapping reset, and available-recipe visibility.

Both credential sets are required; absent identities, wrong tenant, stale
Vercel SHA, wrong/production Supabase project, absent Vercel metadata, role
mismatch, horizontal overflow, failed UI assertions, or a changed deployment
fail the run. Authenticated Playwright traces and videos are disabled; only
sanitized screenshots, diagnostic HTML, test outputs and attestation summaries
are eligible for upload after runtime session deletion and credential scanning.
The Assembly evidence login now uses an opt-in **GET /api/proxy/costbook/workspace** identity check so the Settings route cannot seed legacy branding records. It compares the authenticated organization UUID with the expected smoke tenant and explicitly confirms Costbook read/write/manage permissions for each role; existing Beta auth behavior is unchanged in other modes. The workflow does **not** perform mutations, certify production, or satisfy
issue #518 until an actual passing host run and its screenshots are reviewed.
Two additional CI secrets must be provisioned for the reader identity:
`BETA_RC_READONLY_SMOKE_EMAIL` and `BETA_RC_READONLY_SMOKE_PASSWORD`. The
existing owner smoke identity and Vercel/RC Supabase secrets are reused.

## Current catalog coverage (verified 2026-11-23 at main `255bbc41`)

The API derives this matrix from the recipes rather than maintaining a second
hand-counted registry. Two NAHB vocabularies are overlaid: the 14 starters use
10 browse groups; the 93 research/gap recipes use 6 build phases (1000–6000).
Rows below are the 15 non-empty labels the API serves.

| NAHB label | Recipes | CSI divisions | Output units |
|---|---:|---|---|
| Site work (starter group) | 1 | 31 | CY |
| Foundation (starter group) | 1 | 03 | SF |
| Framing (starter group) | 1 | 06 | SF |
| Exterior shell (starter group) | 2 | 07 | SF, SQ |
| Interior finishes (starter group) | 4 | 08, 09 | EA, SF |
| Cabinets and trim (starter group) | 1 | 06 | LF |
| Electrical (starter group) | 1 | 26 | EA |
| Plumbing (starter group) | 1 | 22 | EA |
| Mechanical (starter group) | 1 | 23 | EA |
| Outdoor living (starter group) | 1 | 06 | SF |
| 1000 Preparation Preliminaries | 13 | 02, 32 | LF, SF, SQ |
| 2000 Excavation and Foundation | 11 | 03, 04, 07, 31 | CY, EA, LF, SF |
| 3000 Rough Structure | 10 | 06 | LF, SF |
| 4000 Full Enclosure (Dry-in) | 18 | 04, 07, 08 | EA, LF, SF, SQ |
| 5000 Finishing Trades | 41 | 06, 07, 08, 09, 11, 12, 22, 23, 26 | EA, LF, SF |

CSI division totals across all 107: 02: 9, 03: 6, 04: 2, 06: 21, 07: 21,
08: 5, 09: 16, 11: 1, 12: 3, 22: 5, 23: 4, 26: 5, 31: 4, 32: 4.
Fourteen CSI divisions are represented. NAHB phase 6000 (Completion and
Inspection) has **zero** recipes — the only structurally empty phase; whether
it is in scope is an open question for the founder (see the S11 coverage-gap
assessment, issue #518).

This is a working residential catalog, not a claim of comprehensive residential
scope. Catalog expansion remains qualified-estimator work with versioned recipe
review. A reviewed gap statement distinguishing intentionally-empty from
genuinely-missing NAHB × CSI cells is recorded in the S11 assessment
(`hidden_files/dev-17-s11-coverage-gap-assessment.md` in the PR-queue goal
workspace, 2026-11-22); its headline is that intent is undetermined for every
empty cell except phase 6000, which is provisionally genuinely missing.

## Classification note

NAHB is used as a residential browsing/workflow vocabulary, not as a claim that
these recipes are an official NAHB publication. CSI labels organize the catalog
by MasterFormat division/section. TradeOS-authored recipe codes carry the
`-TOS-###` suffix so they cannot be mistaken for a licensed cost database or an
official pricing source.


Because Vercel's current web project emits `tradeos-costbook-<deployment>-<scope>.vercel.app` for both preview and production, the workflow only sets `TRADEOS_AGENT_DEPLOYMENT_ATTESTED=true` after the independent S027 inspection has verified Preview target, exact SHA, branch-scoped non-production Supabase identity, and runner authorization. Bare production/main aliases remain refused.
