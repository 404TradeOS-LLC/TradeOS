# Preview isolation verification

This file exists only to give this PR a change under `web/**` so Vercel's
`ignoreCommand` (`web/vercel.json`) produces a real Preview build to
verify against — a docs-only change under `docs/**` would be skipped by
that check. It is deleted before this branch is closed; the PR backing it
is not merged. See `docs/QA_PREVIEW_DEPLOYMENT_CHECKLIST.md` for the
actual repeatable verification process this run exercised.
