---
status: current
owner: platform
last_verified: 2026-09-24
source_of_truth: false
related_docs:
  - docs/CURRENT_STATE.md
  - docs/RBAC_MATRIX.md
  - docs/REPOSITORY_GOVERNANCE.md
related_code:
  - web/src/app/(app)/team-time
  - web/src/components/team-time
  - web/src/lib/team-time-api.ts
  - web/src/app/api/team-time/route.ts
  - web/src/proxy.ts
  - supabase/functions/team-time
  - supabase/migrations/20260924220000_team_time.sql
  - supabase/migrations/20260924223000_team_time_integrity.sql
---

# Team & Time staging integration

Team & Time records job-based work hours for W-2 employees and subcontractors. The current interface is an early staging slice. It remains hidden unless the server-side `TEAM_TIME_ENABLED` flag is enabled for a deployment configured to use the matching non-production Supabase project.

## Sign-in and data boundary

- The web client sends same-origin requests to `/api/team-time`. The server route validates the existing Supabase Auth session, forwards the user's access token and the project's publishable key to the `team-time` Edge Function, and does not expose the token to page JavaScript.
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
- Do not enable the page against production until the function and tables are deployed and verified in the matching production Supabase project.
