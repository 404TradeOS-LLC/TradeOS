# Costbook — Codes & Permits advisory pilot

**Status:** proposed in branch `feat/costbook-codes-permits-vigo-pilot`; not release-certified.
**Geographic coverage:** Indiana state source index and Vigo County county-zoning source index only.
**Source review date:** 2026-11-08.
**Authoritative runtime owners:** `app/modules/costbook/codes/service.ts` (DB-backed reads), `app/modules/costbook/codes/registry.ts` (seed source only), `app/backend/controllers/costbookCodes.controller.ts`, `web/src/app/(app)/costbook/codes/page.tsx`.
**DB registry (issue #946 TODO 2, draft branch `feat/codes-permits-registry-946`, stacked on this pilot branch):** migration `20261109220000_add_codes_authority_jurisdiction_source` adds `codes_authority`, `codes_jurisdiction`, `codes_source`, `codes_source_history`, seeds the six references below as `reviewed` rows, and moves `GET /api/v1/costbook/codes` to read the DB. Response shape, validation, cache directive, permission gate and advisory status are unchanged.

## Why this belongs beside Costbook, not inside pricing

Codes and permits alter material selection, labor, permitting, scheduling, and structural/inspection risk, but are **not** normalized material prices, Cost Items or verified code compliance. This pilot exposes official sources and next verification actions without changing Estimate, Assembly, proposal snapshots, tenant prices, or billing.

## API and boundary

`GET /api/v1/costbook/codes?state=IN&county=Vigo&topic=signage&q=...`

- The existing Costbook router and bearer-authentication + org-membership + forced-RLS request session protect the route.
- `costbook.read` is required, as for other read-only catalog surfaces.
- `state` is required, two alphabetic letters; `county` is optional; `topic` is an allowlisted enum; `q` is bounded text. Unknown keys fail validation.
- No caller-provided org ID, writes, outbound fetch, external credential, database table or price update.
- Response shape: `{status:"advisory", disclaimer, total, items}`. Each item carries `id`, `title`, `issuer`, `citation`, `state`, `county`, `sourceUrl`, `sourceDate`, `reviewedAt`, `topics`, `summary`, `nextAction`, `applicability:"unverified"`. Since #946 TODO 2 the `id` is the seeded row's stable UUID (previously the pilot slug); all other values are identical to the pilot registry.
- Since #946 TODO 2 the endpoint reads `codes_source` (joined to `codes_authority` / `codes_jurisdiction`) through `app/modules/costbook/codes/service.ts` inside the request-scoped RLS session, and serves only `status='reviewed'` rows: `research` rows await explicit human publication approval and `superseded` rows are replaced. Rows are ordered by source id; seed UUIDs are assigned in pilot-registry order, so the seeded response order is unchanged.
- Unknown state has zero items; unspecified county has **only** state-level references. An unindexed county does not silently inherit Vigo County ordinances.
- `Cache-Control: private, no-store`. The index is read-only, shared official reference material; its tenant gate follows Costbook permissions and does not expose tenant data.
- The web route `/costbook/codes` uses the existing server-only API wrapper and session, with filtering by county, topic and free-text. First visit defaults the county field to Vigo for this pilot, but explicitly clearing the county shows **statewide-only** references; an unspecified county never inherits local Vigo requirements. Duplicate/untrusted query values are ignored. The Costbook home screen links to it.

## Seeded references and provenance

All are **reference leads**, not a legally complete source corpus or certified live adopted text.

| Identifier | Published issuer and source | Citation | Applicability |
| --- | --- | --- | --- |
| `vigo-zoning-signs` | [Vigo County official ordinance](https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf) | UZO §16, source dated 1996-10-21 | Verify amendments, zoning, sign category and permit |
| `vigo-zoning-permits` | Same | UZO §5, source dated 1996-10-21 | Verify issuing office and application |
| `indiana-building-code` | [DHS current rules index](https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/) | 675 IAC 13-2.6 | Verify edition at job date and foundation design |
| `indiana-electrical-code` | Same | 675 IAC 17-1.8 | Verify accepted wiring, licensing and inspection |
| `indot-sign-permits` | [INDOT permit guidance](https://www.in.gov/indot/doing-business-with-indot/permits/) | Outdoor advertising sign permits | Verify control route, on-/off-premises status and ROW |
| `indot-occupancy` | Same | Above Ground Occupancy | Verify ROW and whether occupancy approval applies |

A published agency link does not certify its amendments are complete. State adoption changes must be rechecked; draft rules must never replace effective rules automatically. Full model-code texts may be copyrighted and are intentionally not copied. Avoid unsourced threshold, setback, footing size, conductor choice, permit fee, or guaranteed permit classification.

## DB registry — issue #946 TODO 2 (draft, stacked on this pilot branch)

Branch `feat/codes-permits-registry-946` (PR base: this pilot branch; rebase onto `main` after #945 merges) implements the first implementation checkbox of #946.

### Tables (migration `20261109220000_add_codes_authority_jurisdiction_source`)

| Table | Contents |
| --- | --- |
| `codes_authority` | Governing authority: name, kind (`county`/`state`/`federal`/`municipality`/`utility`), state, county, source URL, contact. Unique `(name, state, county)`. |
| `codes_jurisdiction` | Geographic/legal scope: authority FK, kind (`county`/`municipality`/`unincorporated`/`state`/`federal`/`overlay`), state, county, opaque `gis_ref` (no geometry yet), self-parent, notes. Unique `(authority_id, name, jurisdiction_kind)`. |
| `codes_source` | One cited official source version: jurisdiction/authority FKs, `code_family` (e.g. `UZO`, `IBC`, `NEC`, `INDOT-PERMITS`), section, citation, title, source URL, `source_hash` (sha256 hex), license note, published/amended/effective/expiry dates, `status` (`research`/`reviewed`/`superseded`), review timestamp/by, `version_label`, self-`supersedes_id`. Unique `(authority_id, code_family, citation, version_label)`. |
| `codes_source_history` | Append-only version history for `codes_source` (version label, hash, status, change summary, recorded at/by). |

### RLS

All four tables: `FORCE ROW LEVEL SECURITY` with a single `SELECT` policy each — readable by any authenticated session (`current_app_org_id() IS NOT NULL`). These tables carry no tenant data, so cross-tenant isolation holds by construction; `costbook.read` is enforced at the API layer. There is **no** `INSERT`/`UPDATE`/`DELETE` policy for tenant roles: writes go only through the governed ingestion path (TODO 3), which adds its own flag-gated write policy. History has no `UPDATE`/`DELETE` policy for any role. Live coverage: `app/tests/costbook-codes-registry.rls.integration.ts` (same-tenant/global reads, county isolation, no-session empty reads, refused writes, append-only history, no-duplication proof). Mocked Prisma tests do not prove RLS.

### Seed

The six pilot references are seeded as `reviewed` rows (`reviewed_at` 2026-11-08, fixed UUIDs) with `published_date` copied from the pilot's `sourceDate` (NULL where the pilot has null). `source_hash` is NULL for all six, with the documented note that the hash is set on first governed fetch (TODO 3) — no fetched bytes exist yet to hash. `effective_date` is NULL for all six: no effective date is guessed. The in-code registry (`app/modules/costbook/codes/registry.ts`) remains the seed source; the HTTP API no longer reads it at runtime.

### No-duplication proof (TODO 2)

The `codes_*` tables do not duplicate any Costbook evidence model:

- `app/modules/costbook/provenance.ts` is a trust-state vocabulary for **cost data** (`documented` / `unverified-legacy` / `placeholder`) — it stores no authority, jurisdiction or source records.
- `supplierPrices47802.ts` / assemblies / Cost Items store retail pricing and material groupings — no authority, jurisdiction, citation or version history.
- The pilot registry itself is the only prior source index, and it is in-code data, not a table; TODO 2 moves it into the DB and leaves the file as the seed source.

Proof is executable, not just asserted: `app/tests/costbook-codes-registry.migration.test.ts` asserts the migration's column lists contain no pricing / CostItem / estimate / invoice / payment / `org_id` columns, and `app/tests/costbook-codes-registry.rls.integration.ts` asserts the same live against `information_schema` and asserts the API response carries exactly the pilot field set (no price-like keys).

### Contract corrections (minimal, vs the #946 TODO 2 text)

1. `codes_source` gains `topics` (`text[]`), `summary`, `next_action` (all nullable). The pilot API returns those three fields per item and the web page renders `summary`/`nextAction`; without columns the DB-backed API could not reproduce the pilot response. Nullable so governed ingestion (TODO 3) is not forced to supply presentation text for every new source.
2. A partial unique index enforces the `(authority_id, code_family, citation)` singleton when `version_label IS NULL`. PostgreSQL treats NULLs as distinct in the specified `UNIQUE (authority_id, code_family, citation, version_label)`, so without it two unversioned rows for the same citation could coexist.
3. `CodeReference.state` / `county` were widened from the pilot literals (`"IN"` / `"Vigo"`) to `string` / `string | null`: the DB registry serves any state/county the seed holds.
4. The API `id` is now the seeded row's stable UUID instead of the pilot slug. Shape is identical; values are stable across environments.
5. Known remaining parallel read: the Athena tool `tradeos.athena.tools.costbook.code.references` still reads the in-code registry directly. No Athena tool touches the database today, and moving it needs session/contract design owned by TODO 7. Its rows are the seed verbatim — never a second source of truth — and this exception is recorded here rather than claimed away.

### Sibling TODOs

TODOs 3/4/5 build against this same table contract (`codes_source` / `codes_source_history` writes, `codes_job_assessment`, `codes_permit_task` + `codes_fee_review`). Added columns above are backward-compatible with that contract (nullable, defaulted); the contract itself is otherwise unchanged.

## Route 63 acceptance example

For an Indiana / Vigo County sign project, filtering `topic=signage` returns the county sign/permit references plus INDOT sign-permit research leads. A separate electrical filter returns statewide electrical and INDOT occupancy references. **No automatic determination is possible** from an address, zip code, highway name, alleged easement width or old zoning PDF alone. The contractor must verify the parcel's jurisdiction, surveying/ROW, sign classification, applicable code and design.

## Tests and release gates

- Backend registry tests cover jurisdiction isolation, missing county, free-text/topic filters, citation/source provenance and explicit advisory status.
- Backend controller tests cover permission gate, strict queries, required state and cache directive.
- Since #946 TODO 2: `app/tests/costbook-codes-registry.service.test.ts` (query construction, row mapping, advisory envelope), `app/tests/costbook-codes-registry.migration.test.ts` (tables, forced RLS, select-only policies, seed provenance, no pricing columns) and `app/tests/costbook-codes-registry.rls.integration.ts` (live: global reads, county isolation, refused writes, append-only history, no-duplication proof). The RLS integration test requires the docker `postgres:16-alpine` provisioned DB (`npm run test:integration`); it is CI-authoritative and is never presented as a pass when unrun.
- Required checks: `cd app && npm test && npm run test:integration && npm run lint && npm run build`; `cd web && npm test && npm run lint && npm run build`; from root `npm run docs:check` and `npm run pr:preflight -- --base origin/main`.
- Required authenticated acceptance: navigation and results at 390, 768, 1024, 1440; denied users; no wrong-county rules; official links; empty/error states; no Costbook/Estimate mutation.
- Until verified, this is **proposed source-backed functionality**, not deployed or release-certified.

## Future separately reviewed slices (not claimed implemented)

1. Effective-date and amendment watch with human approval/version history. (Schema + append-only history landed in #946 TODO 2; governed ingestion/change detection is TODO 3.)
2. Jurisdiction/parcel matching after authoritative GIS mapping, with ambiguous locations fail-closed.
3. Estimator-stage automatic surfacing of existing Athena source references, after reviewed project-context design; never auto-certifying a job.
4. Estimate-stage advisory prompts and explicit, quoted/approved permit-fee costs; no unreviewed auto-add.
5. Permit tasks, evidence attachments, inspection and approval history, audit and tenant isolation tests.

These later changes may require schema/migrations and separate founder/staging safety review. Do not label this pilot as full code-compliance automation.

## Athena integration supplement (proposed)

A single read-only Athena SDK tool is registered in `app/modules/athena-tools/registry.ts`: `tradeos.athena.tools.costbook.code.references`. It uses the Costbook reference function without direct database access, scoped by the caller-supplied state/county and the existing `costbook.read` permission. Since #946 TODO 2 this is the one remaining read path on the in-code registry (the HTTP API is DB-backed); migrating it to the DB service is TODO 7 work, because no Athena tool touches the database today. The tool emits only `advisory` items, warns when county is omitted, and separately warns when **unfiltered** county coverage is absent; topic-specific statewide-only results do not falsely imply the county has no indexed zoning references. It never supplies a legal determination or fee. `app/tests/athena-tools.costbook.code-references.contracts.test.ts` verifies registration contract, source content, strict inputs and warning behavior. This is not an automatically injected estimator-stage advice provider.

## Hosted repository verification — 2026-11-08

GitHub Actions completed all required repository checks successfully at the exact code commit `2f888d7e87d93fae6e36cc098543f1a99b318529`, run [Verify repository #42462868320](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/42462868320):
- App unit tests, PostgreSQL integration, typecheck, build/dependency audit, Costbook provenance/seed checks and Athena contract/smoke checks: **PASS**.
- Web unit tests, lint, build/dependency audit: **PASS**.
- Docs consistency, live docs reconciliation, sprint governance, dependency review and branch currency: **PASS**.
- GitHub review-thread query: **zero threads**. Branch compare: **0 behind main**, 19 changed files at this checkpoint.

This confirms hosted source verification only, not independent review, source-law currentness, a protected staging deployment, matching runtime SHA, authenticated responsive browser evidence, permit issuance or legal compliance. Docs-only updates after this checkpoint must pass their own current-head CI; the executable code is unchanged.
