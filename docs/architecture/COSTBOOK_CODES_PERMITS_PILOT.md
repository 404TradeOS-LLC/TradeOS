# Costbook — Codes & Permits advisory pilot

**Status:** proposed in branch `feat/costbook-codes-permits-vigo-pilot`; not release-certified.
**Geographic coverage:** Indiana state source index and Vigo County county-zoning source index only.
**Source review date:** 2026-11-08.
**Authoritative runtime owners:** `app/modules/costbook/codes/registry.ts`, `app/backend/controllers/costbookCodes.controller.ts`, `web/src/app/(app)/costbook/codes/page.tsx`.

## Why this belongs beside Costbook, not inside pricing

Codes and permits alter material selection, labor, permitting, scheduling, and structural/inspection risk, but are **not** normalized material prices, Cost Items or verified code compliance. This pilot exposes official sources and next verification actions without changing Estimate, Assembly, proposal snapshots, tenant prices, or billing.

## API and boundary

`GET /api/v1/costbook/codes?state=IN&county=Vigo&topic=signage&q=...`

- The existing Costbook router and bearer-authentication + org-membership + forced-RLS request session protect the route.
- `costbook.read` is required, as for other read-only catalog surfaces.
- `state` is required, two alphabetic letters; `county` is optional; `topic` is an allowlisted enum; `q` is bounded text. Unknown keys fail validation.
- No caller-provided org ID, writes, outbound fetch, external credential, database table or price update.
- Response shape: `{status:"advisory", disclaimer, total, items}`. Each item carries `id`, `title`, `issuer`, `citation`, `state`, `county`, `sourceUrl`, `sourceDate`, `reviewedAt`, `topics`, `summary`, `nextAction`, `applicability:"unverified"`.
- Unknown state has zero items; unspecified county has **only** state-level references. An unindexed county does not silently inherit Vigo County ordinances.
- `Cache-Control: private, no-store`. The index is read-only, shared official reference material; its tenant gate follows Costbook permissions and does not expose tenant data.
- The web route `/costbook/codes` uses the existing server-only API wrapper and session, with filtering by county, topic and free-text. The Costbook home screen links to it.

## Seeded references and provenance

All are **reference leads**, not a legally complete source corpus or certified live adopted text.

| Identifier | Published issuer and source | Citation | Applicability |
| --- | --- | --- | --- |
| `vigo-zoning-signs` | [Vigo County official ordinance](https://www.vigocounty.in.gov/egov/apps/document/center.egov?id=47&view=item) | UZO §16, source dated 1996-10-21 | Verify amendments, zoning, sign category and permit |
| `vigo-zoning-permits` | Same | UZO §5, source dated 1996-10-21 | Verify issuing office and application |
| `indiana-building-code` | [DHS current rules index](https://www.in.gov/dhs/boards-and-commissions/fpbsc-rules/) | 675 IAC 13-2.6 | Verify edition at job date and foundation design |
| `indiana-electrical-code` | Same | 675 IAC 17-1.8 | Verify accepted wiring, licensing and inspection |
| `indot-sign-permits` | [INDOT permit guidance](https://www.in.gov/indot/doing-business-with-indot/permits/) | Outdoor advertising sign permits | Verify control route, on-/off-premises status and ROW |
| `indot-occupancy` | Same | Above Ground Occupancy | Verify ROW and whether occupancy approval applies |

A published agency link does not certify its amendments are complete. State adoption changes must be rechecked; draft rules must never replace effective rules automatically. Full model-code texts may be copyrighted and are intentionally not copied. Avoid unsourced threshold, setback, footing size, conductor choice, permit fee, or guaranteed permit classification.

## Route 63 acceptance example

For an Indiana / Vigo County sign project, filtering `topic=signage` returns the county sign/permit references plus INDOT sign-permit research leads. A separate electrical filter returns statewide electrical and INDOT occupancy references. **No automatic determination is possible** from an address, zip code, highway name, alleged easement width or old zoning PDF alone. The contractor must verify the parcel's jurisdiction, surveying/ROW, sign classification, applicable code and design.

## Tests and release gates

- Backend registry tests cover jurisdiction isolation, missing county, free-text/topic filters, citation/source provenance and explicit advisory status.
- Backend controller tests cover permission gate, strict queries, required state and cache directive.
- Required checks: `cd app && npm test && npm run test:integration && npm run lint && npm run build`; `cd web && npm test && npm run lint && npm run build`; from root `npm run docs:check` and `npm run pr:preflight -- --base origin/main`.
- Required authenticated acceptance: navigation and results at 390, 768, 1024, 1440; denied users; no wrong-county rules; official links; empty/error states; no Costbook/Estimate mutation.
- Until verified, this is **proposed source-backed functionality**, not deployed or release-certified.

## Future separately reviewed slices (not claimed implemented)

1. Effective-date and amendment watch with human approval/version history.
2. Jurisdiction/parcel matching after authoritative GIS mapping, with ambiguous locations fail-closed.
3. Athena read-only code-reference tool, never auto-certifying a job.
4. Estimate-stage advisory prompts and explicit, quoted/approved permit-fee costs; no unreviewed auto-add.
5. Permit tasks, evidence attachments, inspection and approval history, audit and tenant isolation tests.

These later changes may require schema/migrations and separate founder/staging safety review. Do not label this pilot as full code-compliance automation.

## Athena integration supplement (proposed)

A single read-only Athena SDK tool is registered in `app/modules/athena-tools/registry.ts`: `tradeos.athena.tools.costbook.code.references`. It uses the Costbook reference function without direct database access, scoped by the caller-supplied state/county and the existing `costbook.read` permission. The tool emits only `advisory` items and warnings for missing local jurisdiction sources; it never supplies a legal determination or fee. `app/tests/athena-tools.costbook.code-references.contracts.test.ts` verifies registration contract, source content, strict inputs and warning behavior. This is not an automatically injected estimator-stage advice provider.
