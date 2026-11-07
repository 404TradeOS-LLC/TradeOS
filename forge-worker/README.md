# TradeOS Forge — Vercel read-only worker

This is a **deployable** diagnostic/PR-monitoring worker for the public `404TradeOS-LLC/TradeOS` repository, not the full Eve software factory. It runs as an isolated Vercel project with rootDirectory `forge-worker`.

## Endpoints
- `/`: read-only dashboard
- `/api/health`: current deployment configuration and safe capability flags
- `/api/queue`: bounded current open-PR summary, exact-head check data and fail-closed next-gate recommendation
- `/api/cron`: **once daily only** on Vercel Hobby, secured by Vercel `CRON_SECRET`; logs audit results without modifying GitHub

## Configuration
- `GITHUB_READ_TOKEN` (optional for this public repository): a least-privilege, read-only credential with pull request and checks access. Without it, GitHub GraphQL review-thread evidence is unknown and the worker does not claim release readiness.
- `CRON_SECRET` (required to activate daily cron): configure as a strong Vercel project secret, never commit or print its value. The cron endpoint fails closed when missing.
- The worker has **no mutation path**, does not execute repository code, and never receives production database credentials.

On the Vercel Hobby plan cron is at most daily. The checked-in expression runs at 13:15 UTC; actual Hobby timing may vary within the hour.

## Verification
```bash
cd forge-worker
npm test
npm run check
```

## Remaining factory work
Eve-based isolated implementer/reviewer, durable job queue, signed GitHub webhook/Connect authorization, and authenticated staging/browser evidence are intentionally NOT represented as deployed. Vercel Connect GitHub access must be enabled in the project before agent writes are even designed; every implementation remains a draft PR governed by `AGENTS.md`, with protected operations excluded.

The canonical merge eligibility and release authority remain in `scripts/merge-queue.mjs`. This worker's recommendations are diagnostic, not a permission to merge.
