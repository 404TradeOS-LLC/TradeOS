import fs from "node:fs";
import path from "node:path";

const MIGRATION_DIR = "20261110000000_add_codes_permit_tasks_fee_reviews";

describe("codes permit tasks + fee reviews migration", () => {
  it("creates both tables with explicit-status checks, evidence/history defaults, and the TODO 4 assessment FK", () => {
    const migration = fs.readFileSync(
      path.join(__dirname, `../prisma/migrations/${MIGRATION_DIR}/migration.sql`),
      "utf8",
    );
    for (const expected of [
      "CREATE TABLE IF NOT EXISTS public.codes_permit_task",
      "CREATE TABLE IF NOT EXISTS public.codes_fee_review",
      "REFERENCES public.codes_job_assessment(id) ON DELETE SET NULL",
      "CHECK (task_kind IN ('permit', 'inspection'))",
      "CHECK (permit_status IN ('not_submitted', 'submitted', 'under_review', 'approved', 'denied', 'inspection_scheduled', 'inspection_passed', 'inspection_failed'))",
      "CHECK (fee_source IS NULL OR fee_source IN ('quoted', 'verified'))",
      "CHECK (status IN ('pending', 'approved', 'rejected'))",
      "CHECK (fee_cents IS NULL OR fee_cents >= 0)",
      "evidence jsonb NOT NULL DEFAULT '[]'::jsonb",
      "history jsonb NOT NULL DEFAULT '[]'::jsonb",
    ]) expect(migration).toContain(expected);
    expect(migration).not.toContain("DISABLE ROW LEVEL SECURITY");
    expect(migration).not.toContain("DROP TABLE");
  });

  it("forces RLS on both tables with org-scoped policies and owner/admin write gates", () => {
    const migration = fs.readFileSync(
      path.join(__dirname, `../prisma/migrations/${MIGRATION_DIR}/migration.sql`),
      "utf8",
    );
    for (const expected of [
      "ALTER TABLE public.codes_permit_task FORCE ROW LEVEL SECURITY",
      "ALTER TABLE public.codes_fee_review FORCE ROW LEVEL SECURITY",
      "CREATE POLICY codes_permit_task_select_policy",
      "CREATE POLICY codes_permit_task_insert_policy",
      "CREATE POLICY codes_permit_task_update_policy",
      "CREATE POLICY codes_permit_task_delete_policy",
      "CREATE POLICY codes_fee_review_select_policy",
      "CREATE POLICY codes_fee_review_insert_policy",
      "CREATE POLICY codes_fee_review_update_policy",
      "CREATE POLICY codes_fee_review_delete_policy",
      "org_id = (SELECT public.current_app_org_id())",
      "(SELECT public.current_app_can_administer())",
      "assignee_id = (SELECT public.current_app_user_id())",
    ]) expect(migration).toContain(expected);
  });

  it("documents the TODO 4 merge dependency in the migration itself", () => {
    const migration = fs.readFileSync(
      path.join(__dirname, `../prisma/migrations/${MIGRATION_DIR}/migration.sql`),
      "utf8",
    );
    expect(migration).toContain("codes_job_assessment");
    expect(migration).toContain("TODO 4");
    expect(migration).toContain("FAILS until");
  });

  it("keeps the Prisma schema aligned with the migration SQL", () => {
    const schema = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");
    for (const expected of [
      "model CodesPermitTask {",
      '  @@map("codes_permit_task")',
      '  permitStatus String    @default("not_submitted") @map("permit_status")',
      "model CodesFeeReview {",
      '  @@map("codes_fee_review")',
      '  status       String    @default("pending")',
      "permitTasks  CodesPermitTask[]",
      "feeReviews   CodesFeeReview[]",
    ]) expect(schema).toContain(expected);
    // assessment_id is a plain uuid in Prisma (no relation) because TODO 4's
    // model does not exist on main yet; the FK lives in migration SQL only.
    expect(schema).not.toContain("CodesJobAssessment");
  });
});
