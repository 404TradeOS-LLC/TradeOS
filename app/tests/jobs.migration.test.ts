import fs from "node:fs";
import path from "node:path";

describe("job scheduling migration", () => {
  it("adds the expected job tables, constraints, and RLS policies", () => {
    const migration = fs.readFileSync(
      path.join(__dirname, "../prisma/migrations/20260714120000_add_job_scheduling_engine/migration.sql"),
      "utf8"
    );

    expect(migration).toContain("create table jobs");
    expect(migration).toContain("create table job_assignments");
    expect(migration).toContain("create table job_equipment");
    expect(migration).toContain("idx_job_assignments_active_user");
    expect(migration).toContain("idx_job_assignments_active_lead");
    expect(migration).toContain("create policy jobs_select_policy on jobs");
    expect(migration).toContain("create policy job_assignments_select_policy on job_assignments");
    expect(migration).toContain("create policy job_equipment_select_policy on job_equipment");
    expect(migration).toContain("alter table project_tasks add column if not exists job_id");
    expect(migration).toContain("alter table site_visits add column if not exists job_id");
  });

  it("adds the accepted-proposal provenance columns with a UNIQUE index on source_proposal_id", () => {
    const migration = fs.readFileSync(
      path.join(__dirname, "../prisma/migrations/20261028151000_accepted_proposal_job_handoff/migration.sql"),
      "utf8"
    );

    expect(migration).toContain('ALTER TABLE "jobs" ADD COLUMN "source_proposal_id" TEXT');
    expect(migration).toContain('ALTER TABLE "jobs" ADD COLUMN "accepted_baseline_json" JSONB');
    expect(migration).toContain('CREATE UNIQUE INDEX "jobs_source_proposal_id_key" ON "jobs"("source_proposal_id")');
  });
});
