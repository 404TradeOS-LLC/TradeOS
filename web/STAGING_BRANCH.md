# `staging` branch

This branch's frontend Preview deployment exists only to verify the
frontend's staging environment variables (`BACKEND_API_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) correctly point at TradeOS Staging rather
than Production. Every PR-branch frontend Preview deployment already
inherits the same staging-scoped `Preview` environment values — this
branch is not special-cased for the frontend, only for the backend's
stable branch-alias URL. Do not develop features on this branch.
