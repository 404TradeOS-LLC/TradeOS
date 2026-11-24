---
status: ready
owner: platform
last_verified: 2026-11-24
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/TRADEOS_BIBLE.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/RBAC_MATRIX.md
  - docs/ARCHITECTURE.md
  - docs/testing/S073_RLS_COVERAGE_MATRIX.json
  - docs/architecture/S073_RLS_COVERAGE_EVIDENCE.md
related_code:
  - app/prisma/schema.prisma
  - app/modules/jobs
  - app/modules/project-tasks
  - app/modules/invoices
  - app/modules/contracts
  - app/modules/documents
  - app/modules/customer-portal
  - app/backend/routes/jobs.routes.ts
  - app/backend/routes/projects.routes.ts
  - app/backend/controllers/jobs.controller.ts
  - app/backend/controllers/projects.controller.ts
---

# S069 — Closeout and Warranty Workspace Plan

## Outcome

S069 must build the closeout and warranty workspace that does not exist on
current `main`: field completion → punch/closeout documents → customer
handoff → warranty record organization. The workspace makes required
artifacts and unresolved items explicit, tenant-scoped, auditable, and
reachable from the project — without inventing warranty promises the
contractor never made.

This sprint is build work over existing project/job/invoice/contract
foundations. It is **not** certification of an implemented contract (nothing
to certify exists yet), and it does **not** authorize a specific migration,
a new financial model, or a warranty-terms product decision.

## Readiness reconciliation

- Dependencies: none. There is no implementation dependency to satisfy.
- Current `main` at readiness start is
  `1388baae7ab4b1cd8c2798186933954f3566091d` (S068 change-order
  certification #1067 merged 2026-11-24).
- Live GitHub overlap rechecked 2026-11-24: the sole open PR is #1066
  (CodeQL memberships rate limit — owns no closeout/warranty scope). The
  #1065 post-merge Copilot repair lane owns disjoint workspace-switcher
  files. No remote branch implements S069; no live S069 lane exists.
- No punch/closeout/warranty model exists on current `main`: verified in
  `app/prisma/schema.prisma` — no `Punch`, `Closeout`, or `Warranty` model.
  The `punch`/`warranty` keyword hits elsewhere are seed data, document
  templates, costbook assemblies, and proposal drafts, not a workspace.
- What S069 builds on (all implemented on current `main`): the `Job`
  lifecycle (`jobs` module, `jobs.routes.ts` /
  `jobs.controller.ts` — field transitions Arrived → On Site → Completed,
  exercised end to end on staging `d2363802` in the 2026-11-24
  field-closeout run), `Project`, `Invoice`, `Contract`, `Estimate`,
  `ProjectTask`, and `ProjectFile` models, the projects routes/controllers,
  and the `documents` and `customer-portal` modules.
- Release certification prerequisites S057 (`PLANNED`) and S058
  (`PLANNED`) are reference-validated only: per the Bible,
  `Release certification prerequisites:` do not block `READY` and must not
  be treated as implementation dependencies. They remain
  release-certification constraints — no release or beta certification claim
  depending on S057/S058 may be made until those sprints reach `DONE`.
- What S069 still must prove: that a completed job produces an explicit
  closeout record (required artifacts present or listed as unresolved);
  that punch items are created, assigned, resolved, and auditable; that
  closeout documents are generated from real project data (not invented);
  that the customer handoff is reachable from the project and shows the
  same truth staff see; and that warranty records organize only what the
  contractor actually warranted — no invented coverage terms, dates, or
  promises.

## Authoritative scope discovery

The implementation must derive the build set from current code, not memory:

1. Start with the `Job` lifecycle (`app/modules/jobs/`,
   `app/backend/routes/jobs.routes.ts`, `jobs.controller.ts`). Trace the
   completion transition and every record it already produces. The
   closeout workspace starts where field completion ends — do not rebuild
   the field lifecycle.
2. Trace the project hub: `Project`, `ProjectTask`, `ProjectFile`,
   `Invoice`, `Contract`, `Estimate`. Every closeout artifact and
   unresolved item must be reachable from the project workspace, not from
   a parallel subsystem.
3. Trace documents (`app/modules/documents/`): which closeout documents
   already have templates or generation paths, and which must be new.
   Generated documents must be built from the project's real records.
4. Trace the customer side: the portal project page (`customer-portal`
   module). The handoff surface shows the customer the closeout truth
   staff see; it must not expose other tenants' data or invent warranty
   terms.
5. Design the new models (punch items, closeout record, warranty record)
   from the acceptance criteria: explicit required artifacts, explicit
   unresolved items, tenant scope, auditability. A warranty record
   organizes a warranty the contractor actually gave — its terms come from
   the contract/invoice record, never from invented defaults.
6. Trace audit: every punch resolution, closeout completion, and handoff
   must leave a durable, attributable record (actor, timestamp,
   before/after state). Timestamps alone are not an audit trail unless the
   actor is recorded with them.

## Required evidence fields

Each build step must record:

- journey step and owning route/service;
- actor role and organization scope;
- input (job completion, punch item, document, handoff) and resulting state;
- audit record produced by the transition;
- downstream record affected (project/invoice/contract/document) and proof
  no historical snapshot mutated;
- viewport (1440/1024/768/390 for browser steps) and tenant-negative
  result (cross-tenant read/write denied).

## Bounds

- No invented warranty promises. Warranty terms, coverage, and dates come
  from the contractor's actual contract/invoice records. If no warranty
  was given, the workspace says so explicitly — it never fills in a
  default warranty.
- No silent mutation of historical snapshots. Closeout records are new,
  attributable records; they never rewrite contracts, proposals, or
  invoices as signed.
- No parallel subsystem. The workspace extends the project hub and the
  existing job/invoice/contract flows; it does not create a second project
  system.
- New tables carry forced RLS from the start (`FORCE ROW LEVEL SECURITY`,
  organization scope through the owning project/job) with live integration
  coverage in `app/tests/rls.integration.ts`, and the S073 coverage
  matrix (`docs/testing/S073_RLS_COVERAGE_MATRIX.json`) is extended for
  the new resources in the same implementation PR.
- No new role, permission, auth/RBAC/RLS policy beyond the new tables'
  own forced-RLS coverage, or production data change is authorized by
  this promotion. The implementation PR's migration follows the normal
  queue path (reviewed migration, rehearsal where required); this
  promotion authorizes no specific migration.

## Founder-decision boundary

NO for the bounded build above. YES before any warranty-promise language
or customer-facing warranty terms (a product decision — what the
contractor warrants is Billy's call, not the implementation's), any new
financial model, any role/permission change, any auth/RBAC/RLS policy
change beyond the new tables' own forced-RLS coverage, or any production
database change. S057's and S058's separate certification decisions are
not dependencies of S069 and are not decided by this promotion.

## Required validation

- Focused service/controller tests for the new models and transitions,
  including every guard and 409 path.
- Live-PostgreSQL RLS integration coverage for the new tables
  (same-org allowed, cross-org denied) — CI-verified where local Docker
  is unavailable.
- Browser evidence at 1440/1024/768/390 with tenant-negative and
  wrong-role cases for the closeout workspace and customer handoff.
- Current-head evidence that closeout never mutates historical snapshots
  (contract/proposal/invoice records byte-stable after closeout).
- `git diff --check`; `npm run pr:preflight -- --base origin/main`;
  `npm run pr:test`; `npm run docs:test`;
  `npm run docs:check -- --base origin/main`;
  `(cd app && npm test && npm run lint && npm run build && npm run test:integration)`;
  applicable web test/lint/build lanes where touched; exact-head CI.
