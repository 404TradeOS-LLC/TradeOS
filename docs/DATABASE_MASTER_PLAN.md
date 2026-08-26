# TradeOS Cost Book — Database Master Plan

**Author:** Database Architect audit
**Scope:** Read-only audit of `app/prisma/schema.prisma` and `app/prisma/migrations/*` (9 migrations, 30 models) plus the query patterns in `app/modules/` and `app/backend/` that exercise the schema. No schema, migration, or application code was changed as part of this audit.
**Not in scope / not touched:** `app/backend/`, `app/modules/`, `web/` — read for context only.

There is no top-level `database/`, `supabase/`, or `schema/` directory in this repo; the real source of truth is `app/prisma/`. This report and its companion, `docs/PRISMA_REVIEW.md`, are the deliverables.

---

## 1. Overall Database Health

**Grade: Good, for the size of the product.** This is a materially more mature schema than a typical early-stage SaaS backend: every tenant-scoped table is under **forced RLS** (not just `ENABLE`, but `FORCE`, so even the owning role can't bypass it), tenant isolation has been **proven with live cross-tenant integration tests** (not just unit tests with mocked Prisma), migrations are tracked through real `prisma migrate deploy` history rather than hand-rolled SQL, and there's a documented, tested rollback-free rollout path (`scripts/deploy-migrations.sh`) already wired into CI. That combination — forced RLS + live-tested isolation + tracked migrations — is usually the last thing a growing product gets around to, not the first. Here it's already done.

The gaps that exist are the normal ones for a product at this stage: a few searchable text columns with no matching index, a couple of DTO-boundary bugs already caught and fixed by live testing (documented in `CLAUDE.md`, not repeated here), one real N+1 pattern in cost roll-up, and zero forward-looking infrastructure for the AI-assisted estimating feature that's already scoped in `docs/frontend-platform-completion-plan.md` Section 5. None of these are urgent; all are worth planning for before they're urgent.

## 2. Schema Shape

30 Prisma models across 9 migrations (`20260623143000_init_schema` → `20260702120000_add_site_visit_intake_result`). Rough layers:

- **Identity/tenancy:** `Organization`, `AppUser`, `OrganizationMembership`, `OrganizationMembershipAudit`
- **Cost book hierarchy:** `Division → Category → Subcategory → CostItem`, referencing `LaborRate`, `Material`, `Equipment`, `Subcontractor`
- **Composition:** `Assembly` / `AssemblyItem` (self-referential, nestable)
- **Pricing governance:** `MaterialPriceAudit` (append-only), `SupplierPriceUpdate` (queued review)
- **CRM/sales pipeline:** `Customer → Project → Estimate → EstimateLineItem`, `ChangeOrder → ChangeOrderLineItem`, `Proposal`, `Invoice → InvoiceLineItem`, `Contract`
- **Intake/AI-adjacent:** `SiteVisit`, `ProjectFile`

No duplicate or dead tables were found. `db/migrations/` (the old hand-written SQL path) was already deleted in a prior session per `CLAUDE.md` item 31 — confirmed absent; `prisma/migrations/` is the single source of truth.

## 3. Normalization

Generally 3NF and appropriate for an OLTP system — this is not a case of premature denormalization.

**Deliberate, well-justified denormalization** (each is a snapshot, not a sync bug waiting to happen):
- `EstimateLineItem.unitCost` / `ChangeOrderLineItem.unitCost` / `InvoiceLineItem.unitCost` snapshot the computed cost at time of use, not a live reference to `CostItem`/`Material`. Correct: an estimate must not silently reprice when a material cost changes later.
- `MaterialPriceAudit.materialName` snapshots the name at audit time, independent of `Material.name`, so the audit trail reads correctly even after a rename.
- `OrganizationMembershipAudit.beforeState`/`afterState` (JSONB) intentionally denormalize a full row snapshot for audit-trail purposes — appropriate use of JSON here (see §7).

**One real normalization gap:** `Estimate.subtotalCost` and `Estimate.totalPrice` are stored, computed columns, derived from `EstimateLineItem.lineCost` plus `overheadPct`/`profitPct`. They are **not** kept in sync by a database trigger or constraint — they're written by application code (`modules/estimate-engine/service.ts`) whenever a line item changes. This is a correctness risk: any code path that mutates `estimate_line_items` directly (a future migration script, a manual `psql` fix, a bug in a new module) can silently desync `estimates.total_price` from its line items with nothing in the database catching it. Recommendation: either (a) accept this as an application-layer invariant and add a periodic consistency check (a read-only audit query, not a constraint) that flags estimates where `total_price` doesn't match a recomputation from line items, or (b) move the roll-up to a `BEFORE INSERT/UPDATE/DELETE` trigger on `estimate_line_items` for genuine data-integrity guarantees. Given the app already recomputes correctly in the one place line items are mutated today, (a) is the lower-risk, lower-effort choice — flag drift, don't add trigger complexity yet.

## 4. Indexes

### What's already right
Every FK column used in a hot lookup has a matching index (`materials.org_id`, `materials.supplier_id`, `cost_items.subcategory_id`, `estimates.project_id`, etc.), and the audit-trail tables have well-chosen composite indexes that match their actual query shape (`(org_id, membership_id, created_at desc)` on `organization_membership_audits`, `(org_id, created_at desc)` and `(material_id, created_at desc)` on `material_price_audits`, `(org_id, status, created_at desc)` on `supplier_price_updates`). These match the `WHERE ... ORDER BY` shape of the actual service-layer queries in `modules/admin-dashboard/service.ts` and `modules/supplier-integration/service.ts` — this wasn't guessed, it was built to the access pattern.

### Missing indexes (concrete, found in code) — APPLIED 2026-07-03

1. **`cost_items.name` and `assemblies.name` had no index at all**, and both are searched with case-insensitive substring matching:
   - `modules/cost-database/service.ts:67-70` — `OR: [{ name: { contains: query, mode: "insensitive" } }, { code: { contains: query, mode: "insensitive" } }]`
   - `modules/assemblies-database/service.ts:29` — same shape.

   `code` at least benefits partially from the existing `@@unique([orgId, code])` btree index for prefix matches, but **`contains` (substring, not prefix) never uses a plain btree index in Postgres** — both queries were sequential scans. At seed-data volumes this was invisible; it would not have stayed invisible once an org's cost book grows past a few thousand rows, and cost-item/assembly search is on the hot path of the Estimate Builder (search-as-you-type, per `CLAUDE.md` item 39).

   **Applied** in `prisma/migrations/20260703090000_add_search_trgm_indexes/migration.sql`: enabled `pg_trgm` and added `gin` trigram indexes on `cost_items.name`, `assemblies.name`, `materials.name`, and `suppliers.name` (the latter two proactively, per the original recommendation below). This turns `ILIKE '%query%'` into an index scan.

   **Live-verified**, not just written: Docker wasn't available in the environment this was applied from, so the project's own `npm run test:integration` harness couldn't be run directly — instead, a throwaway local PostgreSQL 18 cluster (Homebrew `postgresql@18`, `initdb`/`pg_ctl`, no Docker) was used to apply all 10 migrations in order from scratch, confirming the new migration applies cleanly on top of the full existing history with no errors. `pg_trgm` and all four indexes were confirmed present via `\dx`/`\di+`. To prove the index is actually usable for the exact query shape the app issues (Prisma's `contains` + `mode: "insensitive"`, which compiles to `ILIKE '%query%'`) — not just present — `cost_items` was seeded with 400,000 synthetic rows (15 matching a `%trench%` substring), and `EXPLAIN` confirmed the planner naturally chose `Bitmap Index Scan on idx_cost_items_name_trgm` over a sequential scan at that volume (at a smaller 20k-row volume the planner correctly still preferred a seq scan — expected and correct, since a full scan of a small table is cheaper than an index lookup; the index pays off precisely at the scale this was written to address). The throwaway cluster was torn down afterward. **Still outstanding:** run the project's own `npm run test:integration` (live-RLS harness) before merging/deploying, per the repo's established verification convention — this session's verification proved the migration is syntactically correct and functionally effective, but didn't exercise it through the app's own Prisma client, RLS session-variable bootstrap, or existing test suite.

   No Prisma `@@index` entry was added to `schema.prisma` for these — matching this schema's existing precedent (`idx_customers_org_deleted` from `20260624090000_add_customer_deleted_at` is also SQL-only, not modeled in `schema.prisma`), since Prisma's operator-class index syntax (`ops: raw("gin_trgm_ops")`) sits behind the still-preview `postgresqlExtensions` feature flag, which this project has not opted into.

   Do the same for `materials.name` and `suppliers.name` proactively — no `contains` search exists on those yet, but the same UI pattern (search-as-you-type) is the obvious next feature there, and it's cheap to add the index now versus as an emergency fix later. *(Now applied — see above.)*

2. **`admin-dashboard/service.ts:78`** filters `materials` by `materialQuery` (also a `contains`) — now covered by the `materials.name` trigram index applied above.

3. **`Organization.email`**, used at login lookup time (`modules/auth/service.ts`, via `appUser.email` actually — worth double-checking `AppUser.email` is indexed): `AppUser.email` **is** `@unique`, which is backed by an index automatically — no action needed, confirmed correct.

### Indexes that exist but are worth revisiting for scale
- `idx_assemblies_org_template on assemblies(org_id, is_template)` is fine for the current `listTemplates` query, but as written it's a low-selectivity boolean index (most rows will have `is_template = false`). Consider a **partial index** once assembly counts grow: `create index on assemblies(org_id) where is_template = true` — smaller, and Postgres will prefer it for the exact query `listTemplates` runs.

## 5. Constraints & Relationships

**Foreign key `ON DELETE` behavior is deliberate and mostly correct** — this was clearly thought through, not defaulted:
- `MaterialPriceAudit.materialId` and `SupplierPriceUpdate.{supplierId,materialId}` use `ON DELETE RESTRICT`, correctly protecting audit/history integrity (confirmed fixed from an original `CASCADE` bug, per `CLAUDE.md` item 28 — verified still `RESTRICT` in the current migration, good).
- Org-owned catalog rows (`materials`, `cost_items`, `assemblies`, etc.) cascade on `Organization` delete — correct, since an org's entire tenant data should disappear with it.
- Line-item children (`EstimateLineItem`, `ChangeOrderLineItem`, `InvoiceLineItem`) cascade on their parent — correct.
- Optional references use `SET NULL` appropriately (`Project.customerId`, `CostItem.laborRateId`, etc.).

**One inconsistency worth a decision, not necessarily a fix:** `Contract.proposalId` is `ON DELETE CASCADE` (deleting a `Proposal` deletes its signed `Contract`), while everywhere else in the document trail (`Invoice.proposalId` is `SET NULL`) treats a proposal as detachable-but-preservable. A **signed contract** is a legal record; silently deleting it because someone deleted the proposal it was generated from is a real risk if a "delete proposal" UI action is ever added (none exists today — proposals currently have no delete endpoint, only status transitions, so this is latent, not live). **Recommendation:** change `Contract.proposalId` to `ON DELETE RESTRICT` in a future migration — a signed contract should block proposal deletion outright, the same way `MaterialPriceAudit` blocks material deletion, rather than silently cascading away a legal document.

**Check constraints are used well** where they express real domain invariants (`assembly_items` XOR check between `cost_item_id`/`child_assembly_id`, `estimate_line_items` XOR check between `cost_item_id`/`assembly_id`, status enums via `check (status in (...))` on `supplier_price_updates`, `proposals`, `invoices`, `contracts`). One gap: **`change_orders.status`, `estimates.status`, and `projects.status` have no `check` constraint** — they're plain `text` with an application-level default, and validity is enforced only in TypeScript (zod, presumably, at the controller layer). This is inconsistent with the pattern already used elsewhere in the same schema. Low urgency (RLS-forced app-only writes mean only this codebase can write these columns today), but worth aligning the next time any of these tables gets a migration anyway — free correctness for near-zero cost.

**Uniqueness is well modeled:** `(orgId, code)` on all catalog tables, `(projectId, coNumber)` / `(projectId, invoiceNumber)` for sequential numbering, `(orgId, userId)` on memberships. No missing uniqueness constraints found.

## 6. Duplicate / Redundant Tables

None found. `db/migrations/` (the old parallel hand-written-SQL mechanism) was already retired and deleted in a prior session — verified absent in this audit. `prisma/migrations/` is the single tracked history. No two tables in the current schema serve overlapping purposes.

## 7. JSON Columns

Four JSONB columns exist, all on `SiteVisit` and `Proposal`/`OrganizationMembershipAudit`:

| Column | Purpose | Verdict |
|---|---|---|
| `organization_membership_audits.before_state` / `after_state` | Full row snapshot for audit trail | **Correct use of JSON.** Shape genuinely varies by audit action; never queried by field, only displayed. Don't normalize. |
| `proposals.payment_schedule_json` | Freeform payment milestone schedule | **Correct use of JSON.** No evidence any code filters/sorts by schedule contents — it's read whole and rendered into a PDF. Appropriate. |
| `site_visits.measurements_json` | Freeform measurement capture | **Correct use of JSON**, same reasoning — display-only, shape varies per trade/job type. |
| `site_visits.ai_questions_json`, `missing_info_json`, `intake_result_json` | Structured output of `modules/project-intake/service.ts#buildProjectIntake()` | **Watch this one.** `intake_result_json` was added in the most recent migration (`20260702120000`) specifically to persist the *full* deterministic `IntakeResult` object (trade, projectType, category, missingInformation, followUpQuestions, confidenceScore, proposalDraft), while `ai_questions_json`/`missing_info_json`/`confidence_score` remain as separate, narrower, redundant projections of the same underlying result (kept "so any existing consumer keeps working unchanged," per the migration's own comment). This is reasonable short-term compatibility, but it is quietly building up **three overlapping representations of the same computed object** on one row. Not urgent to fix — nothing is broken — but flag it now so a future session doesn't have to rediscover it: once nothing reads the three narrower columns directly, drop them in favor of `intake_result_json` alone, or the reverse (keep the narrow columns as real typed columns and drop the broad JSON blob) once the AI-assisted-estimating rework touches this table anyway. |

No JSON column currently needs a `jsonb_path_ops` GIN index — none of them are filtered by content in any query found in `modules/` or `backend/`. If `intake_result_json.missingInformation` or similar ever needs to be queried/filtered across site visits (e.g. "find all site visits still missing square footage"), that would be the trigger to add one, not before.

## 8. Future Scaling — Architectural Risks Worth Planning For

These are the findings most specific to this codebase's actual architecture, not generic advice:

1. **Every HTTP request runs its entire handler inside one long-lived database transaction.** `db/requestSession.ts#runWithDatabaseSession` wraps the *whole request* — not just the RLS bootstrap — in a single `client.$transaction(...)` with a 60-second default timeout (`RLS_TRANSACTION_TIMEOUT_MS`). This is what makes forced RLS with session-local `app.org_id`/`app.user_id` work correctly, and it's a deliberate, well-reasoned choice — but it means **connection pool exhaustion risk scales directly with concurrent request count**, not query count. A slow downstream step inside a request handler (PDF generation, an external supplier-feed HTTP call once `SupplierFeedFetcher` is implemented for real) holds a database connection and an open transaction for its entire duration. At current traffic (dev/pre-launch) this is invisible. **Before real production load:** (a) set an explicit `connection_limit` on `DATABASE_URL` sized to the actual Postgres/Supabase pooler capacity rather than relying on Prisma's default, (b) confirm the Supabase pooler mode in use — the deployment notes in `CLAUDE.md` item 35 mention Session-mode Supavisor was required for migrations (IPv4/prepared-statement reasons), but Session mode allocates one persistent backend connection per pooled client, which caps concurrency far lower than Transaction mode. Migrations need Session mode; **runtime API traffic does not**, and should very likely use Transaction-mode pooling instead once real load exists — confirm this hasn't been left on Session mode by default, and (c) never move a genuinely slow operation (large PDF render, third-party API call) inside a request's DB transaction — push it to a `runWithBackgroundDatabaseSession` job instead of inline.

2. **Sequential-numbering race condition (`coNumber`, `invoiceNumber`) is real but self-healing, not silent corruption.** `modules/change-orders/service.ts:38-41` and `modules/invoices/service.ts:25-26` both compute `nextNumber` via `aggregate({ _max: ... })` and then `create` with `nextNumber + 1`, as two separate statements rather than one atomic step. Because each request holds its own serializable-by-RLS-convention transaction at Postgres's default READ COMMITTED isolation, two concurrent change-order creations on the *same project* can both read the same max and then both attempt the same `coNumber` — the `@@unique([projectId, coNumber])` constraint (now mapped to a clean 409 by the Prisma error handler, per `CLAUDE.md` item 30) prevents duplicate numbers, but the loser gets a spurious 409 instead of succeeding with the next number. Low likelihood today (single-editor-per-project in practice, per the front-end plan's own real-time assessment), but worth a low-effort fix before multi-estimator concurrent editing is a real scenario: either `select ... for update` the parent `project` row before the aggregate, or catch the P2002/unique-violation 409 in the service and retry once with a freshly recomputed `nextNumber`.

3. **Assembly cost roll-up is N+1, and depth-recursive.** `modules/assemblies-database/service.ts#getAssemblyUnitCost` (line 125) issues one `assemblyItem.findMany` per assembly level, then loops its items and calls `costDatabase.getUnitCost()` **once per line item** (line 140), which itself issues 1–2 more queries (`costItem.findFirst` with three joins, plus an optional `region.findFirst`). For an assembly with N cost-item lines and nesting depth D, resolving one assembly's cost is on the order of `O(N × D)` round-trips, not `O(1)` or `O(D)`. Cycle protection exists and is correct (`visited: Set<string>`, throws 409 on revisit). This is invisible at seed-data scale (a handful of components) and becomes a real latency problem once assemblies model realistic multi-trade jobs (dozens of line items, 2-3 levels deep) or once "Estimate Builder quick-add an assembly" (already live per `CLAUDE.md` item 39) is used at scale. **Recommendation, not urgent:** batch-fetch all `CostItem`s referenced by an assembly's items in one `findMany({ where: { id: { in: [...] } } })` plus one `Region` fetch, instead of resolving one at a time — the recursion depth (assemblies rarely nest more than 2-3 levels by design) is fine to leave as-is; it's the per-line-item cost lookup that should batch.

4. **No connection-level or query-level slow-query observability exists yet.** There's no `$queryRaw`/`$executeRaw` usage anywhere in the codebase (confirmed — Prisma's query builder is used exclusively, which is good for consistency and RLS-transaction routing), but there's also no `pg_stat_statements`-based monitoring, slow-query logging, or Prisma query-duration middleware wired up. Worth adding before production traffic, not as part of this audit's schema scope, but flagged since it directly informs which of the recommendations above actually matter first — right now these are all reasoned from reading the code, not measured.

5. **Decimal → JS `Number` conversion happens uniformly at the DTO boundary** (`Number(row.totalPrice)`, etc., consistently across every `toDTO` function in every module). This is a deliberate, consistent convention, not scattered ad-hoc conversion — and it's low risk given currency values with 2-4 decimal places stay well within `Number`'s safe precision range. The one place to watch: `modules/estimate-engine/service.ts:128` sums many `Number(li.lineCost)` values in a JS `reduce` before rounding — for an estimate with a very large number of line items this can accumulate floating-point drift before the final `round2()`. Not a bug today (`round2` masks small drift at typical estimate sizes), but if this codebase ever needs financial-grade exactness (e.g., an accounting export), summing `Prisma.Decimal` objects directly (rather than converting to `Number` first) would be the more rigorous approach. This same DTO-boundary pattern was also the root cause of two real bugs already found and fixed via live testing this cycle (`CLAUDE.md` item 40: `InvoicesService.getById` missing line items, and a project's nested estimates returning un-normalized Decimal strings) — worth treating "does this new endpoint route every Decimal field through the same `toXDTO()` mapper as its sibling endpoints" as a standing review question for every new controller, since it's now a proven recurring bug class in this codebase specifically.

## 9. Risks Summary (ranked)

| # | Risk | Likelihood today | Impact | When to act |
|---|---|---|---|---|
| 1 | ~~`contains` search on `cost_items`/`assemblies` name/code has no supporting index~~ — **RESOLVED 2026-07-03**, trigram indexes applied in `20260703090000_add_search_trgm_indexes` | — | — | Verify via `npm run test:integration` before next deploy |
| 2 | Whole-request DB transactions + default pool sizing | Low now | Connection exhaustion under real concurrent load | Before production traffic / load testing |
| 3 | Sequential numbering race (`coNumber`/`invoiceNumber`) | Low (single-editor pattern) | Spurious 409, not data corruption | Before multi-estimator concurrent editing ships |
| 4 | Assembly cost roll-up N+1 | Low now | Estimate Builder latency at realistic assembly complexity | Before assemblies commonly exceed ~10-15 components |
| 5 | `Contract.proposalId` cascades instead of restricting | None today (no delete-proposal endpoint exists) | Legal-document loss if a delete path is ever added | Before a "delete proposal" feature ships |
| 6 | `site_visits` triple-redundant JSON projections | None today | Confusing to maintain, not a bug | Next time this table is touched for the AI-assist rework |
| 7 | No enforced check constraint on `status` columns for `projects`/`estimates`/`change_orders` | None today (RLS + app-only writes) | Free correctness left on the table | Next migration that touches any of these tables |

## 10. Migration Plan (recommendation, not applied)

None of the above requires urgent action; the recommended sequencing, next time schema work happens on this codebase, is:

1. ~~**`enable pg_trgm` + trigram indexes** on `cost_items.name`, `assemblies.name`, `materials.name`, `suppliers.name`~~ — **Applied 2026-07-03** in `prisma/migrations/20260703090000_add_search_trgm_indexes/migration.sql`. No application code change was required or made. Verified via a throwaway local Postgres cluster (full 10-migration apply, index presence, and an `EXPLAIN`-confirmed planner index pickup at 400k rows — see §4 for detail). Still needs the project's own `npm run test:integration` run against the app's real Prisma client/RLS harness (and, before production, `npm run db:deploy` against the real Supabase project) before this is considered fully shipped.
2. **`Contract.proposalId` → `ON DELETE RESTRICT`** — one-line migration, closes the latent legal-document-loss gap before any delete-proposal feature is built, not after.
3. **Add `check` constraints on `projects.status`, `estimates.status`, `change_orders.status`** matching the enum values the application already enforces in TypeScript — pure hardening, zero behavior change if the app is already only ever writing valid values (confirm via a one-off `select distinct status from ...` against the live Supabase project before applying, as a sanity check that no historical row already violates the constraint).
4. **pgvector integration** — see §11, its own larger effort, sequence independently of 1-3.
5. **Address the roll-up N+1 and numbering race** as application-code changes once genuinely needed (§8.2, §8.3) — these are `modules/` changes, out of this audit's file scope, but worth a linked follow-up ticket.

Every migration above should go through the same path already proven in this repo: hand-write the SQL (per `CLAUDE.md` item 34's lesson that `prisma migrate diff` produces noisy cosmetic rewrites against this schema's original hand-written-SQL lineage), verify via the existing `npm run test:integration` live-RLS harness, and deploy via the existing `scripts/deploy-migrations.sh` / `.github/workflows/deploy-migrations.yml` path — no new tooling is needed, the rollout mechanism is already solid.

## 11. pgvector Integration Plan (forward-looking, for AI-Assisted Estimating)

`docs/frontend-platform-completion-plan.md` §5 already scopes an "AI Estimate Assist" feature: a contractor pastes plain-English scope text, the system suggests matching cost items/assemblies from **the org's own cost book**, and the estimator accepts/edits/rejects each suggestion before it's committed. That plan currently describes the matching step only at the product level ("Use the Vercel AI SDK... tool-calling/structured-output schema") without a concrete retrieval mechanism. Keyword/substring matching (extending the existing `contains` search from §4) will not scale to "match freeform scope prose against a cost item catalog" — that's a semantic retrieval problem, which is exactly what pgvector is for. This section is a concrete DB-side plan to close that gap; no application code changes are proposed here, only the schema/infra shape a future implementation would need.

### Recommended shape

1. **Enable the extension** (Supabase supports `pgvector` natively; no infra change needed beyond the extension itself):
   ```sql
   create extension if not exists vector;
   ```

2. **Add an embedding column to `cost_items` and `assemblies`**, not a separate table — the embedding is a 1:1 derived property of the row's searchable text (`name` + `code` + `notes`/`description`), not an independent entity:
   ```sql
   alter table cost_items add column name_embedding vector(1536);
   alter table assemblies add column name_embedding vector(1536);
   ```
   (1536 dimensions matches OpenAI `text-embedding-3-small`; pick the actual dimension to match whichever embedding model the Vercel AI SDK integration standardizes on — this is the one number in this plan that depends on an implementation choice not yet made.)

3. **Index with HNSW, not IVFFlat**, given this table's write pattern (occasional cost-item edits, not bulk streaming inserts) and read pattern (low-latency single-query similarity search on every AI-assist request):
   ```sql
   create index idx_cost_items_embedding_hnsw on cost_items
     using hnsw (name_embedding vector_cosine_ops);
   create index idx_assemblies_embedding_hnsw on assemblies
     using hnsw (name_embedding vector_cosine_ops);
   ```

4. **RLS composes for free.** Because the embedding column lives directly on the already-forced-RLS `cost_items`/`assemblies` tables (rather than a new side table), a similarity search naturally stays org-scoped with zero new policy work — `org_id = current_app_org_id()` already applies to any query against these tables, vector or not. This is the strongest argument for embedding-on-the-row over a separate `cost_item_embeddings` table: a separate table would need its own RLS policy re-deriving the same org-scope-via-join pattern already used for `estimate_line_items` etc., for no benefit.

5. **Backfill/refresh strategy:** compute the embedding at `create`/`update` time in `modules/cost-database/service.ts` and `modules/assemblies-database/service.ts` (an application-code change, out of this audit's scope) rather than a batch job — cost items are edited rarely relative to how often they're searched, so keeping the embedding fresh synchronously on write is simpler and cheaper than a reconciliation job, and avoids a staleness window where new cost items are invisible to AI-assist search.

6. **New logging table**, already named in the front-end plan (`ai_estimate_suggestions`): store `estimate_id`, the raw scope text queried, the suggested `cost_item_id`/`assembly_id`, the similarity score, and the estimator's accept/edit/reject decision. This is a plain relational table (project/estimate-joined RLS, same pattern as `proposals`/`invoices`/`contracts` — no `org_id` column needed, inherit via the `estimates` join), not something that itself needs a vector column. It's the training-data / prompt-iteration dataset the front-end plan already calls for, and doesn't require a migration until the AI-assist feature is actually built.

7. **Sequencing relative to the rest of this plan:** do this only when AI-assisted estimating (Phase 3 of the front-end plan) is actually staffed — there is no reason to add an unused `vector` column and index maintenance overhead before the retrieval code that would consume it exists. This section exists so that when that phase starts, the DB-side shape is already decided rather than re-derived from scratch.

---

## Appendix: Verification Method

This audit was performed by reading `app/prisma/schema.prisma`, all 9 files under `app/prisma/migrations/`, and the query call sites in `app/modules/*/service.ts` that exercise the schema (assemblies, cost-database, change-orders, invoices, admin-dashboard, project-intake), plus `app/db/client.ts` and `app/db/requestSession.ts` for the transaction/connection architecture. No database was queried live and no `EXPLAIN` plans were run — all findings are static-analysis-derived from schema + code, not measured from a running system with real data volume. Recommendation #4 in §8 (add query observability) exists specifically to make the next audit measurement-based rather than reading-based.
