import fs from "node:fs";
import path from "node:path";

describe("job expenses migration", () => {
  it("adds payer responsibility without rewriting existing expense rows or weakening RLS", () => {
    const migration = fs.readFileSync(
      path.join(__dirname, "../prisma/migrations/20261102074000_add_job_expense_payment_responsibility/migration.sql"),
      "utf8",
    );
    const schema = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS payment_responsibility");
    expect(migration).toContain("DEFAULT 'contractor'");
    expect(migration).toContain("CHECK (payment_responsibility IN ('contractor', 'customer'))");
    // Constraint validation must be scheduled separately to avoid a full scan
    // while the additive migration holds the write-blocking table lock.
    expect(migration).toContain("CHECK (payment_responsibility IN ('contractor', 'customer')) NOT VALID;");
    const executableSql = migration.replace(/^--.*$/gm, "");
    expect(executableSql).not.toMatch(/\bVALIDATE\s+CONSTRAINT\b/);
    expect(migration).not.toContain("DISABLE ROW LEVEL SECURITY");
    expect(migration).not.toContain("DROP TABLE");
    expect(schema).toContain('paymentResponsibility String   @default("contractor") @map("payment_responsibility")');
  });

  it("adds immutable audit, receipt reference, idempotency, and void constraints", () => {
    const migration = fs.readFileSync(path.join(__dirname,
      "../prisma/migrations/20261102081500_complete_job_expenses/migration.sql"), "utf8");
    for (const expected of [
      "ADD COLUMN receipt_storage_path", "ADD COLUMN idempotency_key",
      "ADD COLUMN voided_at", "ADD COLUMN currency", "ADD COLUMN description",
      "CREATE UNIQUE INDEX job_expenses_org_job_idempotency_key_idx",
      "CREATE TABLE public.job_expense_events",
      "ALTER TABLE public.job_expense_events FORCE ROW LEVEL SECURITY",
      "CREATE POLICY job_expense_events_insert_policy",
      "CREATE POLICY job_expense_events_select_policy",
    ]) expect(migration).toContain(expected);
    expect(migration).not.toContain("DISABLE ROW LEVEL SECURITY");
    expect(migration).not.toContain("DROP TABLE");
  });

  it("keeps Prisma index names and audit foreign-key relations aligned with migration SQL", () => {
    const schema = fs.readFileSync(path.join(__dirname, "../prisma/schema.prisma"), "utf8");
    const expenses = schema.slice(schema.indexOf("model JobExpense {"), schema.indexOf("model JobAssignment {"));
    const jobModel = schema.slice(schema.indexOf("model Job {"), schema.indexOf("model JobEquipment {"));
    const orgModel = schema.slice(schema.indexOf("model Organization {"), schema.indexOf("model OrganizationMembership {"));
    const userModel = schema.slice(schema.indexOf("model AppUser {"), schema.indexOf("model Organization {"));
    for (const value of [
      '@@unique([orgId, jobId, idempotencyKey], map: "job_expenses_org_job_idempotency_key_idx")',
      '@@index([orgId, jobId], map: "job_expenses_org_job_idx")',
      '@@index([orgId, jobId, voidedAt], map: "job_expenses_org_job_voided_idx")',
      '@@index([jobId, incurredOn(sort: Desc)], map: "job_expenses_job_incurred_idx")',
      '@@index([orgId, jobId, expenseId, createdAt], map: "job_expense_events_org_job_expense_created_idx")',
      'voidedBy AppUser? @relation("JobExpenseVoidedBy", fields: [voidedById], references: [id], onDelete: Restrict)',
      'organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)',
      'job Job @relation(fields: [jobId], references: [id], onDelete: Cascade)',
      'actorUser AppUser @relation("JobExpenseEventActor", fields: [actorUserId], references: [id], onDelete: Restrict)',
    ]) expect(expenses).toContain(value);
    expect(jobModel).toContain("expenseEvents JobExpenseEvent[]");
    expect(orgModel).toContain("jobExpenseEvents JobExpenseEvent[]");
    expect(userModel).toContain("voidedJobExpenses JobExpense[]");
    expect(userModel).toContain("createdJobExpenseEvents JobExpenseEvent[]");
  });

  it("adds the job_expenses table, cents-exact constraint, indexes, and forced job-join RLS", () => {
    const migration = fs.readFileSync(
      path.join(__dirname, "../prisma/migrations/20261102020000_add_job_expenses/migration.sql"),
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.job_expenses");
    expect(migration).toContain("amount_cents integer NOT NULL CONSTRAINT job_expenses_amount_cents_check CHECK (amount_cents > 0)");
    expect(migration).toContain("job_expenses_category_check CHECK (category IN ('labor', 'material', 'equipment', 'disposal', 'subcontractor', 'other'))");
    expect(migration).toContain("job_expenses_org_job_idx");
    expect(migration).toContain("job_expenses_job_incurred_idx");
    expect(migration).toContain("ALTER TABLE public.job_expenses ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.job_expenses FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("CREATE POLICY job_expenses_select_policy ON public.job_expenses");
    expect(migration).toContain("CREATE POLICY job_expenses_insert_policy ON public.job_expenses");
    expect(migration).toContain("CREATE POLICY job_expenses_update_policy ON public.job_expenses");
    expect(migration).toContain("CREATE POLICY job_expenses_delete_policy ON public.job_expenses");
    expect(migration).toContain("j.org_id = (SELECT current_app_org_id())");
    expect(migration).not.toContain("ALTER TABLE jobs");
    expect(migration).not.toContain("DROP TABLE");
  });
});
