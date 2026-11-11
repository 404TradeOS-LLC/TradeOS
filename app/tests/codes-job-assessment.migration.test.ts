import fs from "node:fs";
import path from "node:path";

describe("codes job assessment migration", () => {
  it("adds the tenant-scoped assessment table with forced RLS and org-scoped policies", () => {
    const migration = fs.readFileSync(
      path.join(__dirname, "../prisma/migrations/20261109220000_add_codes_job_assessment/migration.sql"),
      "utf8",
    );
    const schema = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");
    for (const expected of [
      "CREATE TABLE IF NOT EXISTS public.codes_job_assessment",
      "org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE",
      "project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE",
      "estimate_id uuid REFERENCES public.estimates(id) ON DELETE CASCADE",
      "CHECK (status IN ('needs_review', 'in_review', 'owner_approved', 'needs_verification'))",
      "citations jsonb NOT NULL DEFAULT '[]'::jsonb",
      "unknowns jsonb NOT NULL DEFAULT '[]'::jsonb",
      "owner_signoff boolean NOT NULL DEFAULT false",
      "signed_off_by text",
      "signed_off_at timestamptz",
      "ALTER TABLE public.codes_job_assessment ENABLE ROW LEVEL SECURITY",
      "ALTER TABLE public.codes_job_assessment FORCE ROW LEVEL SECURITY",
      "CREATE POLICY codes_job_assessment_select_policy",
      "CREATE POLICY codes_job_assessment_insert_policy",
      "CREATE POLICY codes_job_assessment_update_policy",
      "CREATE POLICY codes_job_assessment_delete_policy",
      "org_id = (SELECT public.current_app_org_id())",
    ]) {
      expect(migration).toContain(expected);
    }
    expect(migration).not.toContain("DISABLE ROW LEVEL SECURITY");
    expect(migration).not.toContain("DROP TABLE");
    // No dependency on TODO 2 tables: no foreign key or executable reference
    // to them (the header comment names them only to document the boundary).
    const executableSql = migration.replace(/^--.*$/gm, "");
    expect(executableSql).not.toContain("codes_authority");
    expect(executableSql).not.toContain("codes_jurisdiction");
    expect(executableSql).not.toContain("codes_source");
    expect(migration).not.toContain("REFERENCES public.codes_authority");
    expect(migration).not.toContain("REFERENCES public.codes_jurisdiction");
    expect(migration).not.toContain("REFERENCES public.codes_source");

    const model = schema.slice(schema.indexOf("model CodesJobAssessment {"));
    for (const expected of [
      'orgId        String   @map("org_id")',
      'projectId    String   @map("project_id")',
      'estimateId   String?  @map("estimate_id")',
      'status       String   @default("needs_review")',
      'ownerSignoff Boolean  @default(false) @map("owner_signoff")',
      '@@index([orgId, projectId], map: "codes_job_assessment_org_project_idx")',
      '@@index([orgId, estimateId], map: "codes_job_assessment_org_estimate_idx")',
      '@@map("codes_job_assessment")',
    ]) {
      expect(model).toContain(expected);
    }
    const orgModel = schema.slice(schema.indexOf("model Organization {"), schema.indexOf("model OrganizationSettings {"));
    expect(orgModel).toContain("codesJobAssessments CodesJobAssessment[]");
    const projectModel = schema.slice(schema.indexOf("model Project {"), schema.indexOf("model Estimate {"));
    expect(projectModel).toContain("codesJobAssessments CodesJobAssessment[]");
  });
});
