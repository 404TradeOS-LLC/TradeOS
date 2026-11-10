# Costbook — Codes & Permits governed source ingestion

**Status:** proposed in branch `feat/codes-permits-ingestion-946` (issue #946, TODO 3); not release-certified.
**Depends on:** TODO 2's tables (`codes_source`, `codes_source_history`) — merge TODO 2 first. This slice's migration fails hard if either table is missing, by design.
**Authoritative runtime owners:** `app/modules/costbook/codes/sourceAllowlist.ts`, `app/modules/costbook/codes/store.ts`, `app/modules/costbook/codes/ingestion.ts`, `app/backend/controllers/costbookCodesIngestion.controller.ts`.
**Migration:** `app/prisma/migrations/20261109220000_add_codes_source_ingestion_rls/migration.sql`.

## What this is

The governed pipeline that turns an official published source (Vigo County ordinance, IDHS adopted-code index, INDOT permit guidance) into a versioned, human-reviewed reference row. It extends the read-only pilot in #945 (`docs/architecture/COSTBOOK_CODES_PERMITS_PILOT.md`): the pilot lists a static reviewed index; this slice fetches, hashes, versions, and reviews live official sources.

It is **not** permit certification, legal advice, or a code-text mirror. It never changes Estimate, Assembly, proposal snapshots, tenant prices, or billing.

## Rules (all mandatory, all tested)

- **Constrained fetch (SSRF policy).** Only allowlisted official hosts, enforced before any network call and re-enforced on every redirect hop: `vigocounty.in.gov` and `in.gov`, each including subdomains. That covers Vigo County (`www.vigocounty.in.gov`), IDHS (`www.in.gov/dhs/...`), INDOT (`www.in.gov/indot/...`, plus INDOT-owned `*.indot.in.gov` hosts such as `erms.indot.in.gov`), and any other `*.in.gov` issuer. Everything else is refused with no fetch attempted — including `in.gov.evil.com`, IP literals, localhost, `http:`, URLs with credentials, and non-443 ports. Redirects are followed manually (max 3 hops, each re-validated). 15 s timeout, 5 MiB cap. Known limitation: the allowlist is DNS-name based; it does not pin DNS resolutions (no defense against a compromised official-host DNS record).
- **Hash + compare.** The fetched bytes are hashed (sha256 `source_hash`) and discarded. Unchanged content is an idempotent no-op: re-running ingestion writes nothing — no new row, no history entry, no audit event.
- **Change detection.** On a hash change, a NEW version row is inserted with status `research`, plus a `codes_source_history` entry. The old head is superseded, never mutated.
- **No auto-publish.** A new version always starts as `research`. Only an explicit human approval flips `research` → `reviewed`. There is no code path that publishes automatically.
- **Supersede, don't mutate.** A reviewed row's content is never edited in place. A new version supersedes it (old status → `superseded`, `supersedes_id` linkage) and the supersede is itself recorded as a history entry.
- **Stale/superseded warnings.** Every read attaches `warnings`: `expired` (reviewed source past `expiry_date`), `superseded` (row status), `superseded_by_newer_version` (defensive: a newer version exists but the row was not flipped — the pipeline always flips the old head, so this guards against rows written by another path). The review queue lists only current heads.
- **No unsourced text.** Only citation + URL + hash + metadata are stored. Fetched bytes are never persisted, parsed, or logged — copyrighted model-code text must not be copied.
- **No guessed dates.** `published/amended/effective/expiry` dates are NULL unless the caller supplies source-stated dates. The service never invents a date from a fetch timestamp or filename.
- **Explicit human trigger only.** There is no background fetch, scraper, or cron in this slice. Ingestion runs only when an authenticated owner/admin calls `POST /codes/sources/ingest`. A scheduled fetcher is a separate, separately-approved slice.

## API

All routes live under `/api/v1/costbook` on the existing Costbook router, behind the existing bearer-auth + org-membership + forced-RLS request session. Reads return `Cache-Control: private, no-store`.

| Route | Permission | Behavior |
| --- | --- | --- |
| `POST /codes/sources/ingest` | `costbook.manage` | Fetch one allowlisted URL, hash, version. Returns `{outcome: "created" \| "unchanged", source, sourceHash, fetchedBytes}`. |
| `GET /codes/sources?status=&limit=` | `costbook.read` | All versions, with `warnings` and `hasNewerVersion` per row. |
| `GET /codes/sources/review-queue` | `costbook.read` | Pending `research` heads awaiting a human decision. |
| `GET /codes/sources/:id` | `costbook.read` | One version, with warnings. |
| `POST /codes/sources/:id/approve` | `costbook.manage` | `research` → `reviewed`. `reviewedBy` is always the caller's real user id, never a free-text name. Optional `reviewNotes` go to the audit event only. |
| `POST /codes/sources/:id/reject` | `costbook.manage` | `research` → `superseded`. `reason` is required and recorded in the audit event. |

Approve/reject act only on the current head of a `research` row; anything else is 409. Both decisions are claimed with a status predicate (mutually exclusive under concurrent review) and recorded twice in the same transaction: a `codes_source_history` entry and an org-scoped `ActivityEvent` (`entityType: "codes_source"`, `eventType: costbook.codes_source.approved | .rejected | .ingested`).

## RLS model

Both tables are **global-read, ingestion-only-write** reference tables: they carry no `org_id` (official sources are shared reference material, not tenant data).

- `SELECT`: any authenticated tenant session (`app.org_id` set) may read. The API additionally enforces `costbook.read`. The global SELECT policies are owned by TODO 2's migration (`20261109220000_add_codes_authority_jurisdiction_source`, PR #960); this slice's migration deliberately does NOT re-create them — it adds only the flag-scoped SELECT policies (so the ingestion transaction can read the head without tenant context) and the flag-gated INSERT/UPDATE policies.
- `INSERT` / `UPDATE`: only inside a transaction that sets the transaction-local `app.codes_ingestion` flag. Only the governed store (`app/modules/costbook/codes/store.ts`) ever sets it, for its own transaction only — mirroring the `app.resend_webhook` flag pattern. No tenant session or direct caller can write.
- No `DELETE` policy on either table: versions are never deleted. No `UPDATE` policy on `codes_source_history`: append-only.
- `FORCE ROW LEVEL SECURITY` is on for both tables (TODO 2 enables + forces it; this migration re-asserts it idempotently).

Cross-tenant isolation therefore means something different here than for org-scoped tables: reads are deliberately shared (a tenant cannot be denied another tenant's *reference* row, because there is no tenant ownership), while writes are denied to every tenant and allowed only to the governed service. The integration tests in `app/tests/rls.integration.ts` prove both halves live: global reads from two orgs, direct writes denied, service writes under the flag succeed, non-admin service calls refused.

## Versioning mechanics

- One version chain per cited source — keyed by `(authority_id, code_family, citation)`, which is TODO 2's unique key (#960). It is deliberately NOT the URL: one official URL can host several citations (the INDOT permits page serves both the sign-permit and the occupancy guidance), and those are separate chains. The head is the row no other row supersedes. Concurrent ingests of the same cited source are serialized by a per-citation Postgres advisory lock (`codes-source-ingest:<authorityId>:<codeFamily>:<citation>`).
- `version_label` is auto-generated `v<n>` (count of existing versions in the chain + 1, inside the lock). Head lookups sort `version_label` with `NULLS LAST`: TODO 2's seed rows carry `version_label = NULL`, and without it the seed row would sort ahead of real versions under `DESC`.
- Ingesting identical bytes is a no-op. Ingesting changed bytes creates `v<n+1>` as `research` and flips the old head to `superseded` — even if the old head was `reviewed`. A reviewed source is therefore never silently replaced by unreviewed content: the new content waits in the queue until a human approves it.
- The store uses raw SQL against the exact TODO 2 column contract as verified in PR #960 (head `9cdea60d`): no Prisma models for these tables exist on this branch yet. It keeps compiling and working unchanged once TODO 2's models land.

## Contract verified against TODO 2 (#960)

The TODO 2 contract handed to this slice was abbreviated; this slice verified the real contract against PR #960 (`feat/codes-permits-registry-946`, head `9cdea60d`, stacked on the #945 pilot branch) and reconciled the implementation to it. Verified facts:

- `codes_source_history` is an **event log, not a full-row snapshot**: `(id, source_id FK → codes_source(id), version_label TEXT NOT NULL, source_hash NULLABLE, status, change_summary NULLABLE, recorded_at DEFAULT now(), recorded_by TEXT)`. There is no `snapshot` jsonb column and no `codes_source_id` column. History entries here record a short `change_summary` ("Governed ingest created v<n>[; supersedes …]", "Superseded by v<n>", "Approved by <user>", "Rejected by <user>: <reason>"); a `version_label` of `'unversioned'` is used only for superseded seed rows, whose label is NULL (history `version_label` is NOT NULL).
- `codes_source.reviewed_by` is **TEXT** (a user id), not uuid — no `::uuid` cast.
- `codes_source.source_hash` and `version_label` are **NULLABLE**: TODO 2's seed rows carry `source_hash = NULL`, `version_label = NULL` until a governed fetch versions them. A NULL stored hash never equals a fetched hash.
- `codes_source` carries extra columns `topics text[] NOT NULL DEFAULT '{}'`, `summary`, `next_action` (TODO 2's own minimal corrections); ingestion leaves them at defaults.
- The version chain key is `(authority_id, code_family, citation)` — see Versioning mechanics above.
- The rejection reason has no column in the TODO 2 contract, so it lives only in the `ActivityEvent` audit metadata, never on the row.
- This slice's migration shares the timestamp `20261109220000` with TODO 2's migration. The directory names differ (no filesystem collision) and Prisma applies them in lexicographic order — TODO 2's directory (`..._add_codes_authority_jurisdiction_source`) sorts first, so the tables exist before this migration runs. Merge chain: #945 → #960 (TODO 2) → this PR.

## Tests and release gates

- Unit: `app/tests/costbook-codes-source-allowlist.test.ts` (allowlist refusal with no fetch attempted, redirect re-validation, timeout, size cap), `app/tests/costbook-codes-ingestion.service.test.ts` (hash compare, idempotency, change detection, no-auto-publish, no unsourced text, no guessed dates, stale/superseded warnings, role refusals, approve/reject/audit), `app/tests/costbook-codes-ingestion.controller.test.ts` (permission gates, strict bodies, cache directive).
- Live RLS: `app/tests/rls.integration.ts`, nested describe "codes_source governed ingestion RLS". It uses TODO 2's fixed seed UUIDs (INDOT authority `94600001-0000-4000-8000-000000000003`, Indiana/INDOT jurisdiction `94600002-0000-4000-8000-000000000003`) and a distinct citation per fixture, because #960's UNIQUE `(authority_id, code_family, citation, version_label)` forbids repeats. These tests need the TODO 2 tables and therefore cannot pass until TODO 2 merges — see Known Limitations in the PR.
- Required checks: `cd app && npm test && npm run test:integration && npm run lint && npm run build`; from root `npm run docs:check`. Local `test:integration` hard-requires docker `postgres:16-alpine`; CI is authoritative for it.
- Until verified, this is **proposed source-backed functionality**, not deployed or release-certified. No production migration, staging migration apply, or deployment is part of this PR.

## Future separately reviewed slices (not claimed implemented)

1. Scheduled amendment watch (the no-background-scraper boundary above is explicit: a cron fetcher needs its own approval, allowlist review, and rate-limit design).
2. Jurisdiction/parcel matching and Estimate Scope/Review hints (TODO 4).
3. Permit/inspection tasks and price-neutral fee-review workflow (TODO 5).
4. DNS-pinning hardening for the fetch allowlist, if a threat review requires it.
5. A web review-queue UI (this slice is API-only; reviewers use the API until a reviewed UI lands).
