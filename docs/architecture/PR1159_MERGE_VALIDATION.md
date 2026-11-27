<!-- coderabbit-ai-generated:v1 -->

# PR #1159 merge validation summary

[PR #1159](https://github.com/404TradeOS-LLC/TradeOS/pull/1159) merged as `f557154b16df0f958a9c4c21111780027871f29e`.

## Changes and affected domains

Athena's Gemini fetch is bounded by the provider deadline; provider and request timeouts are non-retryable, and the web client no longer offers “Retry safely” for HTTP 504. The auth membership lookup selects only `orgId` and `role`. API readiness probes use a 5-second database statement timeout and application-level race, with a matching transaction acquisition budget. The readiness response shape and auth decisions remain unchanged. Default Athena deadline values remain 8,000 ms for the provider and 15,000 ms for the request.

## Validation evidence

The PR author reports 390 app suites passing across interrupted full-suite runs and subsequent chunks, 1,123 web tests passing, and passing app and web lint and build, PR preflight, `docs:check`, and `git diff --check`. After review fixes, the author reports passing the health suite (10 tests), Gemini provider suite (20 tests), and app lint. The merged tests cover provider fetch and body-read timeouts, retryability, the membership selection, the readiness timeout, and web 504 classification. [Codex's acquisition-budget finding](https://github.com/404TradeOS-LLC/TradeOS/pull/1159#discussion_r4717212674) and [CodeRabbit's body-read timeout finding](https://github.com/404TradeOS-LLC/TradeOS/pull/1159#discussion_r4717258325) are addressed in the merged code.

## Checks not established

The author reports local app integration tests were blocked by unavailable Docker and PostgreSQL. The PR claims CI was green on the final head, but the supplied conversation does not provide a verifiable CI run result; integration success is unconfirmed. `pr:test` and `docs:test` are unchecked in the PR. The readiness hang test uses fake timers and a mock, not a hung PostgreSQL connection.

Post-deploy checks remain owed: 24-hour 504 versus successful-draft counts, staging draft latency on about 20 requests, staging sign-in and an authenticated read, and live `/ready` and `/health` identity checks. Lowering the deadline environment values is gated on staging p95 below 5,000 ms. The supplied evidence does not establish deployment or live verification success.
