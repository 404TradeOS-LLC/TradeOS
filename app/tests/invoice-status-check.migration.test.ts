import fs from "node:fs";
import path from "node:path";
import { invoiceStatuses } from "../domain/contracts";

// DES-7 (c): InvoicesService.markViewed writes status 'viewed' for a sent
// invoice and InvoicesService.void writes the legacy literal 'void', but the
// original invoices CHECK (20260624100000) only allowed ('draft', 'sent',
// 'paid', 'overdue', 'void') — so PostgreSQL rejected 'viewed' (23514) and
// the portal mark-viewed integration test failed. The 20261123120200
// migration widens the CHECK to the canonical domain set plus the legacy
// 'void' literal (proposal-declined precedent: drop + add NOT VALID, then a
// separate migration validates it).

const widen = fs.readFileSync(
  path.resolve(__dirname, "../prisma/migrations/20261123120200_widen_invoice_status_check/migration.sql"),
  "utf8"
);
const validate = fs.readFileSync(
  path.resolve(__dirname, "../prisma/migrations/20261123120300_validate_invoice_status_check/migration.sql"),
  "utf8"
);

describe("invoice status check migration", () => {
  it("replaces invoices_status_check with the canonical status set plus legacy void", () => {
    expect(widen).toContain("alter table invoices drop constraint if exists invoices_status_check");
    expect(widen).toContain("alter table invoices add constraint invoices_status_check");
    for (const status of invoiceStatuses) {
      expect(widen).toContain(`'${status}'`);
    }
    // The void() writer still persists the legacy literal, and historical
    // rows may carry it — dropping it would break VALIDATE.
    expect(widen).toContain("'void'");
  });

  it("installs the replacement NOT VALID so the table is not scanned under lock", () => {
    expect(widen).toMatch(/check \(status in \([^)]+\)\) not valid;/);
  });

  it("validates the replacement constraint in a separate migration", () => {
    expect(validate).toContain("alter table invoices validate constraint invoices_status_check");
  });
});
