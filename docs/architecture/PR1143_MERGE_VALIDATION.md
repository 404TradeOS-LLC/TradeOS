<!-- coderabbit-ai-generated:v1 -->

# PR #1143 merge validation summary

[PR #1143](https://github.com/404TradeOS-LLC/TradeOS/pull/1143) merged as `a62c16d7eceb024f27ff34288fb262e1ff3f0d66`.

## Changes and affected domains

The changes affect staging orchestration, beta evidence, estimate evidence polling and Preview database drift detection. Ordinary staging evidence uses live runtime SHA correlation instead of the stale configured SHA pre-check; required-correlation scenarios still check the configured SHA. The orchestrator waits for staging aliases and verifies frontend identity against the approved SHA. Evidence now has a 30-minute job timeout, estimate-total polling stops after three consecutive failed or empty fetches, and superseded drift checks are cancelled while replacement runs list recent READY Previews. Staging orchestrator and beta evidence remain serialized.

## Validation evidence

The PR reports `npm run pr:test` passing 549/549, `docs:check` passing, `docs:test` passing 44/44, app lint and build passing, and `git diff --check` clean. It reports 87/87 beta-evidence tests, 6/6 estimate-poll tests and 5/5 governance-policy tests, plus passing YAML and shell syntax checks. Stubbed-fetch tests covered stale configured SHAs and fail-closed live mismatches; stubbed-curl harnesses exercised alias propagation, timeout and frontend identity cases. These are author-reported pre-merge results; the alias harnesses were not committed as tests, as noted in the [CodeRabbit validation warning](https://github.com/404TradeOS-LLC/TradeOS/pull/1143#issuecomment-7209473957).

The author reports [preflight run 45937580780](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/45937580780) failed at live correlation with `STAGING_RUNTIME_MISMATCH`, after bypassing the stale-variable pre-check. The staging web and API aliases reported different SHAs, neither matching the staging head. This is evidence of a fail-closed mismatch, not a live pass.

## Checks not established

The app suite reported two `resend.webhook.test.ts` failures with 429 responses; that file reportedly passed 9/9 in isolation. Local integration was not run because Docker Postgres was unavailable, and the supplied evidence does not establish a passing integration run. Web test, lint and build were not run because no web files changed. No live orchestrator run was performed; a passing live correlation awaits staging re-promotion. The next three staging pushes still need verification for one orchestrator run each.

The Preview drift replacement sweep covers only the latest five READY Previews and depends on a working Vercel listing; a cancelled target can be missed outside that window or if the listing fails, as [the author noted](https://github.com/404TradeOS-LLC/TradeOS/pull/1143#issuecomment-7209605358). This record does not establish deployment or integration success.
