import fs from "node:fs";
import path from "node:path";

describe("costbook research candidates migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260908050000_add_costbook_research_candidates/migration.sql"),
    "utf8"
  );

  it("creates an org-scoped table with a review lifecycle and promotion linkage", () => {
    expect(migration).toContain("create table costbook_research_candidates");
    expect(migration).toContain("org_id                 uuid not null references organizations(id) on delete cascade");
    expect(migration).toContain("review_status          text not null default 'candidate'");
    expect(migration).toContain("check (review_status in ('candidate', 'needs-review', 'approved', 'rejected'))");
    expect(migration).toContain("promoted_cost_item_id  uuid unique references cost_items(id) on delete set null");
  });

  it("enforces at the database layer that a reviewed row must name a human reviewer", () => {
    expect(migration).toContain("costbook_research_candidates_review_requires_reviewer");
    expect(migration).toContain("review_status not in ('approved', 'rejected')");
    expect(migration).toContain("reviewed_by_user_id is not null and reviewed_at is not null");
  });

  it("enforces at the database layer that promotion requires an approved review and a recorded promoter", () => {
    expect(migration).toContain("costbook_research_candidates_promotion_requires_approval");
    expect(migration).toContain("review_status = 'approved' and promoted_at is not null and promoted_by_user_id is not null");
  });

  it("preserves reviewer and promoter identities for the audit trail", () => {
    expect(migration).toContain("reviewed_by_user_id    uuid references users(id) on delete restrict");
    expect(migration).toContain("promoted_by_user_id    uuid references users(id) on delete restrict");
  });

  it("forces row-level security scoped to the authenticated organization", () => {
    expect(migration).toContain("alter table costbook_research_candidates enable row level security");
    expect(migration).toContain("alter table costbook_research_candidates force row level security");
    expect(migration).toContain("create policy costbook_research_candidates_select_policy on costbook_research_candidates");
    expect(migration).toContain("org_id = (select public.current_app_org_id())");
  });

  it("keeps candidate writes aligned to the Costbook owner/admin boundary, not the broader current_app_can_write()", () => {
    expect(migration).toContain("create policy costbook_research_candidates_write_policy on costbook_research_candidates");
    expect(migration).toContain("public.current_app_can_manage_costbook()");
    expect(migration).not.toContain("current_app_can_write()");
  });
});
