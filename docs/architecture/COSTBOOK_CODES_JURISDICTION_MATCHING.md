# Costbook — Codes & Permits jurisdiction matching and Estimate hints

**Status:** proposed in branch `feat/codes-permits-jurisdiction-matching-946` (issue #946, TODO 4); not release-certified.
**Extends:** the read-only pilot in `docs/architecture/COSTBOOK_CODES_PERMITS_PILOT.md` (PR #945, draft) — this slice adds matching, assessments, and hints; it does not re-implement the pilot registry.
**Authoritative runtime owners:** `app/modules/costbook/codes/jurisdiction.ts`, `app/modules/costbook/codes/assessment.ts`, `app/modules/costbook/codes/hints.ts`, `app/backend/controllers/costbookCodesJurisdiction.controller.ts`, `web/src/components/estimate/estimate-codes-hints.tsx`.

## What this slice does

1. **Verified parcel/jurisdiction matching** — a pure matcher that resolves the governing jurisdictions for a Project's site from reviewed records, and fails closed to `needs_verification` whenever a required fact is missing, stale, or ambiguous.
2. **Tenant-scoped job assessment** — `codes_job_assessment` stores explicit Project/Estimate context, proposed work type, citations with rationale, unknowns, needs-review statuses, owner signoff, and audit fields under forced RLS.
3. **Read-only Estimate Scope/Review hints** — a quiet, nonblocking disclosure on the Estimate Scope and Review stages surfacing pertinent citations and unresolved permits. Hints never change estimated cost.

## Matching rules

The matcher (`resolveJurisdiction`) takes a `SiteInput` — parcel id, site address, city/county/state, coordinates, incorporated flag, zoning district, sign category, road-proximity flags, and verification flags — plus `JurisdictionRecord[]` in the TODO 2 record shape, plus a work type. It is a pure function: no database, no network, no outbound fetch.

A `verified` outcome requires **all** of:

1. an identifiable site (verified parcel id, or coordinates + address);
2. at least one reviewed, unexpired record for the state scope;
3. exactly one governing local authority (no ambiguous overlap);
4. incorporated vs unincorporated status known, with a matching municipal record when incorporated or county record when not;
5. zoning district known;
6. when the work is near or crosses a road edge, a surveyed right-of-way / easement boundary verified — the road edge is not the parcel boundary, and a fence-side run is not automatically an occupancy permit;
7. for signage work, on- vs off-premises category confirmed, plus sign height/type and structural/foundation design confirmed;
8. for electrical work, listing, wiring method, authorized installer, and authorized connection confirmed;
9. records covering every topic the work type requires (permits, signage, electrical, structural, right-of-way).

Checks accumulate: a `needs_verification` result lists **every** open question, so the contractor sees the full verification checklist instead of one failure at a time.

## Fail-closed behavior

- No match is a valid result (`needs_verification`), never an error to paper over.
- Stale, superseded, or research-only records are reported in `reasons` and never used. An expired record cannot support a match.
- An unusable record on file alongside current records does not block a verified match; it stays visible in `reasons`.
- The resolution shape intentionally carries **no numeric rule values**: there are no fields for setback, footing diameter/depth, wiring method, or permit fee, and the matcher cannot output them.
- The live API reads jurisdiction records through a `JurisdictionRecordStore`. Until TODO 2 lands, the store is the empty fail-closed store, so every project resolves to `needs_verification` rather than a guessed jurisdiction.

## TODO 2 dependency (merge order)

This slice consumes the TODO 2 contract (`codes_authority` / `codes_jurisdiction` / `codes_source`) but does not define those tables. The `codes_job_assessment` migration has **no** foreign key or executable reference to them and applies cleanly whether or not TODO 2 has landed. Live jurisdiction resolution against those tables is a follow-up: a database-backed `JurisdictionRecordStore` replaces the empty store when TODO 2 merges. **Merge TODO 2 first for the feature to resolve live records**; this PR's migration does not block on it. The matcher itself needs no change when the store lands.

The pilot registry (`app/modules/costbook/codes/registry.ts`, PR #945) is likewise not duplicated here: test fixtures mirror its reviewed references in TODO 2 record shape, and assessment citations reference source ids by string.

## Job assessments

`codes_job_assessment` (Prisma model `CodesJobAssessment`, migration `20261109220000_add_codes_job_assessment`):

- `org_id` NOT NULL (tenant scope), `project_id` NOT NULL FK `projects`, `estimate_id` NULL FK `estimates`, `work_type` text, `status` (`needs_review` | `in_review` | `owner_approved` | `needs_verification`, default `needs_review`), `citations` jsonb array of `{source_id, rationale}`, `unknowns` jsonb array, `owner_signoff` boolean, `signed_off_by`, `signed_off_at`, `created_by`, `created_at`/`updated_at`.
- RLS: `ENABLE` + `FORCE ROW LEVEL SECURITY`; select/insert/update/delete policies scoped to `(SELECT public.current_app_org_id())`, with insert additionally requiring the parent project (and estimate, when given) to belong to the same org. Role gating (who may create / sign off) is enforced in the API layer; RLS is the tenant-isolation floor.
- Owner approval is never set at creation. It requires the explicit sign-off path (`POST /codes/assessments/:id/sign-off`, owner/admin only), which stamps actor and time. A second approval is refused with 409.
- Live cross-tenant coverage is in `app/tests/rls.integration.ts` ("codes_job_assessment row-level security"); mocked Prisma tests do not prove RLS.

## API

All under `/api/v1/costbook`, behind bearer auth + org membership + forced-RLS session. Responses carry `Cache-Control: private, no-store`.

- `GET /api/v1/costbook/codes/jurisdiction?projectId=…` — requires `costbook.read`. Optional caller-supplied verified site facts: `state`, `county`, `city`, `parcelId`, `incorporated`, `zoningDistrict`, `signCategory`, `nearStateRoad`, `crossesRoadEdge`, `rightOfWayBoundaryVerified`, `signDetailsVerified`, `electricalConnectionVerified`, `workType`. Returns the resolution plus the project id and site address. Unknown keys fail validation; a foreign project is 404.
- `GET /api/v1/costbook/codes/estimates/:estimateId/hints` — requires `costbook.read`. Returns the hints payload (below). A foreign estimate is 404.
- `GET /api/v1/costbook/codes/assessments?projectId=…` or `?estimateId=…` (exactly one) — requires `costbook.read`.
- `POST /api/v1/costbook/codes/assessments` — requires `costbook.write`. Strict body: `projectId`, optional `estimateId`, `workType`, optional `status` (`needs_review` | `in_review` | `needs_verification`), `citations` (max 20), `unknowns` (max 20). Returns 201.
- `POST /api/v1/costbook/codes/assessments/:id/sign-off` — owner/admin only.

## Estimate hints (financial no-op)

`GET /codes/estimates/:estimateId/hints` returns `{ estimateId, projectId, estimateTotal, financialEffect: "none", jurisdiction, assessments, hints, openQuestions, citations, disclaimer }`. The saved estimate total is echoed verbatim; the builder never reads line items, never recomputes a total, and returns no price-changing fields. Only quoted/verified permit fees or explicitly selected labor/material Cost Items may ever affect cost — this slice adds no cost effect at all. The proof is `app/tests/costbook-codes-hints.test.ts` (total identical with and without hints, inputs unmutated, no price fields).

The web disclosure (`EstimateCodesHints`, rendered in the Estimate Scope stage and the Review stage) is a native `<details>` progressive disclosure. While loading, on error, or for roles without `costbook.read` it renders nothing — hints never block estimating. It shows the jurisdiction status, open questions, assessment statuses, cited authorities, the research-only disclaimer, and an explicit "No cost effect" line. It preserves the mobile-first Scope → Items → Price → Review flow and the approved Estimate components; no pricing surface is touched.

## Route 63 acceptance case

Encoded as an automated test (`app/tests/costbook-codes-route63.test.ts`), not a doc claim. Given the ~20 ft sign replacement request (~250 ft electrical path near fence, hand-mixed footing) at 4050 S. State Road 63, Terre Haute, IN 47802 (parcel 84-09-08-102-001.000-004, verified via Vigo Beacon GIS), the matcher returns `needs_verification` with all open questions — local sign district/zoning, height, private property/INDOT ROW, sign type, structural engineering/foundation, electrical listing, authorized connection — cites the Vigo County, IDHS, and INDOT authorities, distinguishes the verified parcel boundary from the unverified right-of-way, and requires verified survey/site approval before any firm compliant installation is quoted. It infers no setback, footing diameter/depth, wiring method, or permit fee.

## Tests and release gates

- Matcher unit tests: verified match, unincorporated county match, ambiguous authority, missing parcel, stale/superseded/expired records, ROW/easement distinction, incorporated vs unincorporated, zoning unknown, sign category, sign/electrical detail verification, missing topics, accumulated open questions, no-inferred-values invariant.
- Route 63 acceptance test, hints financial no-op test, assessment service tests (mocked Prisma), controller tests (permission gates, strict queries, fail-closed response, hints echo), migration content test, RLS integration tests.
- Required checks: `cd app && npm test && npm run test:integration && npm run lint && npm run build`; `cd web && npm test && npm run lint && npm run build`; from root `npm run docs:check`. Local integration tests hard-require `docker postgres:16-alpine` (not installed on this VM) — CI is authoritative; an unrun check is never presented as a pass.
- Until verified, this is **proposed source-backed functionality**, not deployed or release-certified. No production migration, RLS change, or staging application until reviewed staging preflight/approval and checksums.

## Future separately reviewed slices (not claimed implemented)

1. Database-backed `JurisdictionRecordStore` from TODO 2 tables (merge TODO 2 first).
2. Effective-date and amendment watch with human approval/version history.
3. Assessment status transitions beyond sign-off, and assessment edit history.
4. Permit/inspection tasks, evidence attachments, and price-neutral fee review.
5. Authenticated four-width (390/768/1024/1440) acceptance of the hints disclosure.
