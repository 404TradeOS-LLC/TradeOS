---
status: current
owner: platform
last_verified: 2026-11-27
source_of_truth: true
---

# Intentional zero-policy RLS tables — do not "fix" the dashboard warning

Supabase shows "Policies are required to query data" for every RLS-enabled
table with no policies. For the two table groups below, zero policies is the
deliberate, tested design — not a gap. Do not add policies to them. If a
table is NOT listed here and has zero policies, that is a real gap: file it
with the table name.

## The standard tenant pattern (for contrast)

Normal tenant tables get, per
`app/prisma/migrations/20260828120000_complete_tenant_rls/migration.sql`:

- SELECT: `org_id = (SELECT current_app_org_id())`
- ALL (insert/update/delete): `org_id = (SELECT current_app_org_id()) AND (SELECT current_app_can_write())`, with the same WITH CHECK.

Helpers `current_app_org_id()`, `current_app_can_write()`, and
`current_app_can_administer()` are defined in the schema. A table that the
application role (`tradeos_app`) must read or write gets this pattern. The
tables below are the exceptions: the application role must NOT touch them.

## Team & Time — Edge Function only, via service_role

Tables: `team_time_profiles`, `team_time_shifts`, `team_time_events`.

- Accessed only by the deployed Edge Function
  (`supabase/functions/team-time/index.ts`), which authenticates with
  `SUPABASE_SERVICE_ROLE_KEY`. The service role bypasses RLS; the
  function's own authorization logic enforces tenant isolation (see
  `app/tests/team-time-edge-auth.test.ts`, which drives the function with a
  fake bypass-RLS service key so every denial comes from the function's
  authorization, not from RLS).
- The foundation migration
  (`app/prisma/migrations/20261030004500_team_time_foundation/migration.sql`)
  states: "All tables start with RLS enabled and NO public/anonymous table
  grants" and "Do not grant authenticated/anon access. The Edge Function's
  bypass-role execution path is separately reviewed/tested; FORCE does not
  override it."
- The force migration
  (`app/prisma/migrations/20261030010000_force_team_time_rls/migration.sql`)
  enables + forces RLS with no policies, and
  `app/tests/team-time-force-rls.integration.ts` pins that state: it asserts
  the three tables have `policies === 0` and that non-bypass roles see zero
  rows.
- Adding tenant policies here would let the application role read/write
  Team & Time rows directly, bypassing the Edge Function's authorization —
  a tenant-isolation regression, not a fix. When the app needs Team & Time
  reads, that is a feature + authorization design change, not a policy
  addition.

## ABC OAuth authorization states — SECURITY DEFINER wrappers only

Table: `abc_oauth_authorization_states`.

- The migration header
  (`app/prisma/migrations/20261011123000_add_abc_oauth_states/migration.sql`)
  states: "The application role never touches this table directly: FORCE
  ROW LEVEL SECURITY is enabled with no policies, and all access goes
  through the SECURITY DEFINER wrappers below." The wrappers are
  `tradeos_private.create_abc_oauth_state` (binds each state to the
  initiating tenant session) and `tradeos_private.consume_abc_oauth_state`
  (validates expiry and consumes the state atomically exactly once). This
  mirrors the supplier refresh-token vault
  (`20261007031500_add_supplier_refresh_token_vault`).
- The state token is the callback credential, so only its HMAC-SHA256 is
  stored. No policy can express "only the SECURITY DEFINER wrapper may
  touch this table" — policies only grant access to non-bypass roles, which
  is exactly what must not happen.

## `_prisma_migrations`

Prisma's internal ledger. Leave alone; it is not application data.

## How this was established

A 2026-11-26 dashboard check found these tables with zero policies in
staging and in the 404TradeOScostbook project, and the ABC catalog tables
absent from staging. The zero-policy tables were verified against the
migrations and tests cited above, not assumed. The catalog tables were
absent because migration `20261127010000_add_abc_shared_catalog` had not
been applied to staging yet; that is a migration-application gap, not a
policy gap, and is handled by the staging migration workflow
(`.github/workflows/deploy-staging-migrations.yml`), which applies pending
migrations including the catalog tables with their policies.
