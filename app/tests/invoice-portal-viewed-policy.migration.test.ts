import fs from "node:fs";
import path from "node:path";

// DES-7 (c): the portal mark-viewed writer runs under a portal session
// (app.role = 'portal_customer'), for which current_app_can_write() is
// false — so the staff invoices / invoice_deliveries / activity write
// policies all deny it. The migration grants one narrowly scoped portal
// UPDATE policy + trigger, keyed by a transaction-local
// app.portal_invoice_id, mirroring the contract-signing precedent.

describe("invoice portal viewed policy migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20261123120100_add_invoice_portal_viewed_policy/migration.sql"),
    "utf8"
  );

  it("adds the portal invoice id setting used to key the narrow write", () => {
    expect(migration).toContain("current_app_portal_invoice_id()");
    expect(migration).toContain("app.portal_invoice_id");
  });

  it("grants a portal-only invoice update policy scoped to the verified customer and invoice", () => {
    expect(migration).toContain("create policy invoices_portal_viewed_policy on invoices");
    expect(migration).toContain("for update using");
    expect(migration).toContain("status <> 'draft'");
    expect(migration).toContain("current_app_portal_customer_id()");
  });

  it("pins portal updates to the first-view transition with a trigger", () => {
    expect(migration).toContain("create or replace function public.enforce_customer_portal_invoice_viewed()");
    expect(migration).toContain("Customer portal viewing may only record the first view of a sent invoice");
    expect(migration).toContain("create trigger invoices_customer_portal_viewed_integrity");
    expect(migration).toContain("old.viewed_at is not null");
  });

  it("lets the portal record the viewed event and activity row for that invoice only", () => {
    expect(migration).toContain("create policy invoice_deliveries_portal_viewed_policy on invoice_deliveries");
    expect(migration).toContain("event_type = 'invoice.viewed'");
    expect(migration).toContain("delivery_channel = 'portal'");
    expect(migration).toContain("create policy activity_events_portal_viewed_policy on activity_events");
  });
});
