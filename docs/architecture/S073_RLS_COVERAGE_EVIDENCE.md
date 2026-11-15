# S073 Release-Critical RLS Coverage Evidence

Status: implementation evidence on branch `test/s073-release-critical-rls`; not a release certification until the exact PR head passes required checks and review.

## Inventory and source rules

[`docs/testing/S073_RLS_COVERAGE_MATRIX.json`](../testing/S073_RLS_COVERAGE_MATRIX.json) is the machine-readable inventory for the nine S051 journeys that feed S052-S060. It records each persisted tenant-sensitive Prisma model/table, owning journey, route/service source, tenant source, migration, policy family, and live same-organization/cross-organization test name. Shared tables appear once. Derived totals and the file/vector knowledge corpus are excluded with reasons because these journeys do not persist them as independent tenant-owned rows.

Migration entries identify the source that establishes the active RLS contract for the table. Direct `ALTER TABLE` statements are checked as literal evidence. For migrations that safely generate a common tenant policy in a `FOREACH` loop, the validator requires the table to be enumerated in that loop and the loop to generate both ENABLE and FORCE statements plus its read/write policy family. This distinction is retained in the evidence rather than presenting generated SQL as literal per-table statements.

## Live PostgreSQL evidence

The existing `app/tests/rls.integration.ts` supplies direct database evidence for the previously covered resources and named actor/assignment/customer scopes. The additive `app/tests/s073.rls.integration.ts` adds disposable PostgreSQL fixtures and direct queries for the four previously untested tables:

| Resource | Same/cross organization evidence | Narrow scope evidence |
| --- | --- | --- |
| `estimate_line_items` | `proves estimate parents are visible while estimate-line RLS remains parent-scoped` | Parent estimate organization inheritance; passed |
| `invoice_line_items` | `enforces invoice-line reads through the parent invoice and project` | Parent invoice/project organization inheritance; passed |
| `customer_portal_access_tokens` | `limits portal identity reads to the exact token or session credential` | Exact lookup hash; unrelated hash returns no rows |
| `customer_portal_sessions` | `limits portal identity reads to the exact token or session credential` passes; `keeps portal session context scoped to its customer and organization` fails | Exact hash lookup passes. Request-context read returns no row because `runWithPortalDatabaseSession` sets `app.portal_session_id` but the forced lookup policy requires `app.portal_session_hash`. |

The matrix also includes S053 Costbook inputs (`CostItem`, `Assembly`, `AssemblyItem`) and the S058 `InvoiceDelivery` journal. Their same/cross tenant test names are drawn from the existing focused Costbook and core integration files, which the validator scans under `app/tests/`.

The tests use the disposable PostgreSQL integration database only. They create uniquely identified rows, run queries under the restricted application role and request context, and clean up their own fixtures. They do not access staging or production databases and do not modify schema, migrations, policy, roles, or authentication behavior.

## Blocking gap

`CustomerPortalSession` is `GAP`, owned by Platform / Customer Portal. `app/modules/customer-portal/service.ts` hashes the bearer token while resolving a session, but `CustomerPortalContext` does not carry that hash into the middleware's later request transaction. `app/db/requestSession.ts` sets the portal session ID and customer/organization context without setting `app.portal_session_hash`; the current `customer_portal_sessions_lookup_policy` requires that hash. The live test preserves this as a failing assertion. A repair changes authentication/session context, which the S073 plan explicitly forbids without a separate protected decision. Do not mark S073 complete or merge this evidence as a passing certification until that decision and repair are handled.

## Validation

`npm run s073:rls:check` checks the matrix against the current Prisma model/table mapping, mapped migration, explicit or enumerated ENABLE/FORCE evidence, policy generation, source owner, and named live integration test. `npm run s073:rls:test` covers successful validation and fails closed for an unowned GAP or missing migration. Both are included in `npm run pr:test`.

The matrix is evidence inventory, not browser acceptance for S052-S060. Those sprints retain their own authenticated non-production acceptance gates. A newly observed live policy failure must be recorded as an owned `GAP`; this branch does not authorize changing policy or migrations.
