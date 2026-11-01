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

