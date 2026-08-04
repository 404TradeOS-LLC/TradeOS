import fs from "node:fs";
import path from "node:path";

describe("database security hardening migration", () => {
  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      "../prisma/migrations/20260804020000_harden_database_security_boundaries/migration.sql"
    ),
    "utf8"
  );
  const roleProvisioning = fs.readFileSync(
    path.resolve(__dirname, "../scripts/sql/provision-app-role.sql"),
    "utf8"
  );

  it("keeps Prisma migration history outside the runtime role boundary", () => {
    expect(migration).toContain(
      "alter table public._prisma_migrations enable row level security"
    );
    expect(migration).toContain(
      "revoke all privileges on table public._prisma_migrations from public"
    );
    expect(migration).toContain("'tradeos_app', 'anon', 'authenticated'");

    const broadGrant = roleProvisioning.indexOf(
      'grant select, insert, update, delete on all tables in schema public to :"role_name"'
    );
    const migrationHistoryRevoke = roleProvisioning.indexOf(
      'revoke all privileges on table public._prisma_migrations from :"role_name"'
    );

    expect(broadGrant).toBeGreaterThanOrEqual(0);
    expect(migrationHistoryRevoke).toBeGreaterThan(broadGrant);
  });

  it("requires updated auth rows to retain their security identity", () => {
    expect(migration).toContain("create or replace function public.enforce_auth_record_identity()");
    expect(migration).toContain("organization_invites_identity_guard");
    expect(migration).toContain("auth_refresh_tokens_identity_guard");
    expect(migration).toContain("password_reset_tokens_identity_guard");
    expect(migration).not.toContain("with check (true)");
  });

  it("pins every application RLS helper to an empty search path", () => {
    const helpers = [
      "current_app_user_id",
      "current_app_org_id",
      "current_app_auth_subject",
      "current_app_role",
      "current_app_can_write",
      "current_app_can_administer",
      "current_app_is_provisioning",
      "current_app_login_lookup",
    ];

    for (const helper of helpers) {
      expect(migration).toContain(
        `alter function public.${helper}() set search_path = ''`
      );
    }

    expect(migration).toContain("public.current_app_role()");
  });
});
