<!-- coderabbit-ai-generated:v1 -->

# PR #1162 merge validation summary

[PR #1162](https://github.com/404TradeOS-LLC/TradeOS/pull/1162) merged as `38c7ee384a322a201b78f3e8ff5f0666294c3aca`.

## Changes and affected domains

Invoice PDF rendering measures the summary heading and totals before drawing them and starts a new page when they will not fit. The existing financial row rules and formatting remain in place. The merge also adds a PDF text-stream regression test and updates invoice module, API, lifecycle, and current-state documentation.

## Validation evidence

The PR author reports reproducing the split with a 40-line invoice and verifying that the heading and all totals render together. The author reports three document suites passing (18 tests), the API TypeScript check, PR preflight, documentation ownership check, documentation tests (44), and diff whitespace checks. The regression test checks that the last line item and summary are in separate PDF text streams and that all five expected totals occur in the summary stream.

## Checks not established

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:a324d13fa058da5469c06428311e30925bb87484570257afbe9a1b334d8ca4a5 -->

The PR reports hosted CI and staging visual review pending. The staging build predates the change. The test checks text-stream placement rather than visual layout. Inspect the long-invoice layout on staging after deployment. The supplied evidence does not establish hosted CI, deployment, or integration success.

<!-- /coderabbit-ai-generated:v1 -->
