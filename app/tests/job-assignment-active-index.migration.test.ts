import fs from "node:fs";
import path from "node:path";

describe("active job-assignment lookup migration", () => {
  const migration = fs.readFileSync(
    path.join(__dirname, "../prisma/migrations/20260908120000_add_active_job_assignment_lookup/migration.sql"),
    "utf8"
  );

  it("adds an idempotent tenant/job partial index for active assignments", () => {
    expect(migration).toContain("set local lock_timeout = '5s'");
    expect(migration).toContain("create index if not exists idx_job_assignments_active_org_job");
    expect(migration).toContain("on job_assignments (org_id, job_id)");
    expect(migration).toContain("where removed_at is null and declined_at is null");
    expect(migration).not.toContain("create unique index");
  });
});
