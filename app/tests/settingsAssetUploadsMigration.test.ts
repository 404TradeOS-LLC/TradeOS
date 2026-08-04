import fs from "node:fs";
import path from "node:path";

describe("settings asset uploads migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260728120000_add_settings_asset_uploads/migration.sql"),
    "utf8"
  );

  it("forces RLS on settings_asset_uploads", () => {
    expect(migration).toContain("alter table settings_asset_uploads enable row level security");
    expect(migration).toContain("alter table settings_asset_uploads force row level security");
  });

  it("restricts select to the current org", () => {
    expect(migration).toContain("org_id = (select current_app_org_id())");
  });

  it("restricts writes to admin-equivalent roles, matching organization_settings/brand_profiles", () => {
    expect(migration).toContain("current_app_can_administer()");
  });

  it("constrains asset_key to the four real settings asset fields", () => {
    expect(migration).toMatch(/asset_key in \('logoUrl', 'darkLogoUrl', 'iconUrl', 'watermarkUrl'\)/);
  });

  it("enforces exactly one current upload per (org, asset_key)", () => {
    expect(migration).toMatch(/unique\s*\(org_id, asset_key\)/);
  });
});
