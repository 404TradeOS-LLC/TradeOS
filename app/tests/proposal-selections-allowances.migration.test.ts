import fs from "node:fs";
import path from "node:path";

describe("proposal selections and allowances migration (DES-10-F8)", () => {
  const migration = fs
    .readFileSync(
      path.resolve(__dirname, "../prisma/migrations/20261123090000_add_proposal_selections_allowances/migration.sql"),
      "utf8"
    )
    .toLowerCase();

  it("creates the proposal_selections and proposal_allowances tables with RLS", () => {
    expect(migration).toContain("create table if not exists public.proposal_selections");
    expect(migration).toContain("create table if not exists public.proposal_allowances");
    expect(migration).toContain("alter table public.proposal_selections enable row level security");
    expect(migration).toContain("alter table public.proposal_selections force row level security");
    expect(migration).toContain("alter table public.proposal_allowances enable row level security");
    expect(migration).toContain("alter table public.proposal_allowances force row level security");
  });

  it("scopes both tables by organization for select and write", () => {
    expect(migration).toContain("create policy proposal_selections_select_policy on public.proposal_selections");
    expect(migration).toContain("create policy proposal_selections_write_policy on public.proposal_selections");
    expect(migration).toContain("create policy proposal_allowances_select_policy on public.proposal_allowances");
    expect(migration).toContain("create policy proposal_allowances_write_policy on public.proposal_allowances");
    expect(migration).toContain("org_id = (select public.current_app_org_id())");
    expect(migration).toContain("(select public.current_app_can_write())");
  });

  it("scopes portal customer reads through the owning proposal to the verified customer", () => {
    // A portal session carries the contractor's org_id, so the org-wide
    // SELECT policy alone would expose every customer's rows in the org.
    expect(migration).toContain("create policy proposal_selections_customer_portal_scope_policy on public.proposal_selections");
    expect(migration).toContain("create policy proposal_allowances_customer_portal_scope_policy on public.proposal_allowances");
    expect(migration).toContain("as restrictive for select using");
    expect(migration).toContain("(select public.current_app_role()) <> 'portal_customer'");
    expect(migration).toContain("project.customer_id = (select public.current_app_portal_customer_id())::uuid");
  });

  it("constrains selection statuses to the Figma badges and allowance amounts to zero or more", () => {
    expect(migration).toContain("status in ('action_required', 'confirmed')");
    expect(migration).toContain("amount >= 0");
  });

  it("cascades both tables from their proposal", () => {
    expect(migration).toContain("references public.proposals(id) on delete cascade");
  });
});
