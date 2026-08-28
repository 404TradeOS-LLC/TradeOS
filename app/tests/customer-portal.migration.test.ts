import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.resolve(__dirname, "../prisma/migrations/20260828150000_add_customer_portal_identity/migration.sql"),
  "utf8",
);

describe("customer portal identity migration", () => {
  it("stores only hashed access/session secrets and enables forced RLS", () => {
    expect(migration).toContain("create table customer_portal_access_tokens");
    expect(migration).toContain("token_hash         text not null unique");
    expect(migration).toContain("create table customer_portal_sessions");
    expect(migration).toContain("session_hash     text not null unique");
    expect(migration).toContain("alter table customer_portal_access_tokens force row level security");
    expect(migration).toContain("alter table customer_portal_sessions force row level security");
    expect(migration).toContain("customer_portal_access_tokens_redeem_policy");
    expect(migration).toContain("customer_portal_access_tokens_revoke_policy");
    expect(migration).toContain("customer_portal_sessions_revoke_policy");
    expect(migration).toContain("redeemed_at is null");
    expect(migration).toContain("expires_at > now()");
  });

  it("keeps customer signing narrower than the staff write policy", () => {
    expect(migration).toContain("create policy contracts_portal_sign_policy on contracts");
    expect(migration).toContain("for update using");
    expect(migration).toContain("status = 'pending_signature'");
    expect(migration).toContain("status = 'signed'");
    expect(migration).toContain("current_app_portal_customer_id");
    expect(migration).toContain("create policy contract_events_portal_sign_policy on contract_events");
    expect(migration).toContain("create policy activity_events_portal_sign_policy on activity_events");
    expect(migration).toContain("actor_user_id is null");
    expect(migration).toContain("enforce_customer_portal_contract_sign");
    expect(migration).toContain("projects_customer_portal_scope_policy");
  });

  it("allows every staff role with documents.manage to issue links", () => {
    expect(migration).toContain("customer_portal_access_tokens_write_policy");
    expect(migration).toContain("current_app_role()) in ('owner', 'admin', 'dispatcher', 'estimator')");
  });
});
