---
status: current
owner: platform
last_verified: 2026-10-30
source_of_truth: false
related_docs:
  - docs/CURRENT_STATE.md
  - docs/RBAC_MATRIX.md
  - docs/REPOSITORY_GOVERNANCE.md
related_code:
  - web/src/app/(app)/team-time
  - web/src/components/team-time
  - web/src/lib/team-time-api.ts
  - web/src/lib/team-time-route.ts
  - web/src/lib/team-time-model.ts
  - web/src/components/team-time/use-team-time-workspace.ts
  - web/src/app/api/team-time/route.ts
  - web/src/proxy.ts
---

# Team & Time staging integration

Team & Time records job-based work hours for W-2 employees and subcontractors. The current interface is an early staging slice. It remains hidden unless the server-side `TEAM_TIME_ENABLED` flag is enabled, `TEAM_TIME_SUPABASE_PROJECT_REF` is set to the designated staging project ref, and that ref matches the project reference in the hostname of `NEXT_PUBLIC_SUPABASE_URL`. The code pins that ref to the verified TradeOS Staging project, so a Preview cannot enable the feature by pointing both values at Production. It is also denied on Vercel Production.

## Sign-in and data boundary

- The web client sends same-origin requests to `/api/team-time`. The server route requires an exact same-origin `Origin`, validates the existing Supabase Auth session, forwards the user's access token and the project's publishable key to the `team-time` Edge Function, and does not expose the token to page JavaScript.
- The Edge Function requires a valid JWT and verifies the user against TradeOS's active user and organization-membership records.
- The Edge Function uses server-side Supabase credentials for its reads and writes. Team & Time table access is not granted directly to browser roles; authorization is enforced by the function for the active organization and job assignment.
- Worker role is derived from active organization membership. A supervisor can set a worker profile as `employee` or `subcontractor`; the time entry snapshots that type at clock-in so later profile changes do not relabel historical hours.
- Workers can clock in only to active jobs assigned to them. Break and clock-out actions are limited to their own open shift. Supervisors review, correct, approve, or reopen completed shifts. Corrections require a reason and return the entry to review.

## Workflow

1. A worker selects an assigned job and clocks in.
2. The worker can start or end a break, add an optional clock-out note, and clock out.
3. A completed entry waits for supervisor review. Managers can correct it with a reason or approve it; an approved entry can be reopened for review.
4. Approved hours can be downloaded as separate employee and subcontractor CSV files.

## Current limits

- CSV export is a manual handoff. TradeOS does not submit payroll or subcontractor payments to QuickBooks or another provider.
- The interface displays server-recorded timestamps; it does not prove the worker was physically at a job site.
- Worker identity requires an existing active Supabase Auth account linked to a TradeOS user and organization membership. Local-only application sessions cannot authenticate directly to this Edge Function.
- The live signed-in workflow still needs a dedicated staging worker, assigned staging job, configured staging deployment, and phone-to-office verification. Isolated request tests do not count as that live verification.
- Staging verification on 2026-10-30 confirms deployed `team-time` Edge Function **version 6** with JWT verification enabled. The original Supabase migrations `20260924145928` (`team_time_foundation`) and `20260924150458` (`team_time_integrity`) are recorded as applied. Repository source at `supabase/functions/team-time/index.ts` is a staging v6-derived candidate with bounded, complete shift pagination; new tracked Prisma equivalents are `20261030004500_team_time_foundation` and `20261030005500_team_time_integrity`, followed by `20261030010000_force_team_time_rls`.
- **Authorization boundary:** the Edge Function authenticates the requester and explicitly checks organization membership and job assignment; its server-side PostgREST client uses a secret service-role key and therefore bypasses RLS even when FORCE is set. Source-level adversarial tests in `app/tests/team-time-edge-auth.test.ts` exercise the deployed-equivalent access path. FORCE hardens table-owner posture, not service-role tenant isolation.
- Staging's three Team & Time tables were RLS-enabled but not FORCED on 2026-10-30. The three Prisma migration equivalents and enhanced tests are **proposed source changes**, not evidence that protected staging or production migration deployment occurred. Production activation remains forbidden until separate function, database, role, identity and environment acceptance.
