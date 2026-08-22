import fs from "node:fs";
import path from "node:path";

describe("proposal declined-status compatibility migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260822210000_normalize_proposal_declined_status/migration.sql"),
    "utf8"
  );

  it("accepts canonical declined writes without breaking historical rejected rows", () => {
    expect(migration).toContain("drop constraint if exists proposals_status_check");
    expect(migration).toContain("'declined'");
    expect(migration).toContain("'rejected'");
  });
});
