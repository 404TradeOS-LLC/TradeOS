<!-- coderabbit-ai-generated:v1 -->

# PR #1091 merge validation summary

[PR #1091](https://github.com/404TradeOS-LLC/TradeOS/pull/1091) merged as `05e49a517e8e6f62660a162e107ff6147cbd7ffb`.

## Changes and affected domains

The Costbook Assembly Catalog versions recipe structures and records installed recipe identity, version and time. The Costbook and estimate builder send the selected version on installation. Assembly detail supports reviewing component and Cost Item mapping changes before a tenant-scoped confirmation; the template update and actor-attributed history commit together. The migration backfills identifiable legacy installs and assigns component keys only to verified layouts. Existing Cost Item prices, estimate pricing snapshots and installation overrides remain recorded; future resolved costs can reflect the upgraded composition.

## Validation evidence

The PR reports app tests passing (380 suites, 3,909 tests), web tests (1,001), app and web lint and builds, Prisma validation, and 38 integration suites with 295 tests on disposable PostgreSQL 16. It reports migration rehearsal against the previous main schema, documentation and preflight checks, the RLS check, 44 documentation tests and 502 PR tests. The integration command emitted a delayed-exit notice but reportedly exited successfully. The PR reports no remaining environment-blocked local checks.

The PR also reports four required checks and a migration/RLS job passing on head `927072fc03e3ec9ce577d420ec8dd565999a8a75`: [repository verification](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/45526019280) and [migration and RLS safety](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/45526019547). These are author-reported pre-merge results, not independently verified final-head CI evidence. The supplied conversation identifies the later reviewed head as `5d6144438ab31ae4dcaf0ff1dbbd33f94ff7430e`; it does not establish that the earlier checks were rerun on that head. The merged diff includes fixes for CodeRabbit's three findings: empty upgrade mappings, guidance for unverified rows, and clipped picker results. [Final review summary](https://github.com/404TradeOS-LLC/TradeOS/pull/1091#issuecomment-7149590855) reports no actionable comments in the recent review.

## Outstanding checks and rollout

Staging verification after promotion remains owed: install with the current recipe version should return `201`, and a stale `expectedRecipeVersion` should return `409`. The documented rollout order is migration `20261125150000_version_installed_assembly_recipes`, backend, then web. The PR says the old backend strips the new field; the previous main controller instead uses a strict install schema, and its error handler maps Zod validation errors to `400`. This difference does not establish staging behavior. No staging deployment or live acceptance is evidenced.

Legacy rows without identifying markers cannot be linked reliably; unverified component layouts require estimator reconciliation. Issue #518 retains estimate-line recipe snapshots, catalog coverage, bulk mapping enhancements and provenance UI as follow-up work.
