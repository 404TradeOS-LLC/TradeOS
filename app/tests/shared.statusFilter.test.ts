import { expandCanonicalStatusFilter } from "../modules/shared/statusFilter";
import { legacyEstimateStatusMap, legacyProposalStatusMap, legacyInvoiceStatusMap } from "../domain";

describe("expandCanonicalStatusFilter", () => {
  it("includes the canonical value itself", () => {
    expect(expandCanonicalStatusFilter(["draft"], legacyEstimateStatusMap)).toEqual(expect.arrayContaining(["draft"]));
  });

  it("does not collapse the canonical estimate statuses", () => {
    const raw = expandCanonicalStatusFilter(["ready"], legacyEstimateStatusMap);
    expect(raw).toEqual(["ready"]);
    expect(expandCanonicalStatusFilter(["sent"], legacyEstimateStatusMap)).toEqual(["sent"]);
  });

  it("includes legacy raw 'rejected' when the requested canonical proposal status is 'declined'", () => {
    const raw = expandCanonicalStatusFilter(["declined"], legacyProposalStatusMap);
    expect(raw).toEqual(expect.arrayContaining(["declined", "rejected"]));
  });

  it("includes every legacy raw value that normalizes to canonical invoice 'voided'", () => {
    const raw = expandCanonicalStatusFilter(["voided"], legacyInvoiceStatusMap);
    expect(raw).toEqual(expect.arrayContaining(["voided", "void", "cancelled"]));
  });

  it("does not include unrelated legacy values", () => {
    const raw = expandCanonicalStatusFilter(["draft"], legacyInvoiceStatusMap);
    expect(raw).not.toContain("void");
    expect(raw).not.toContain("cancelled");
  });

  it("returns no duplicates when a canonical value maps to itself", () => {
    const raw = expandCanonicalStatusFilter(["paid"], legacyInvoiceStatusMap);
    expect(raw).toEqual(["paid"]);
  });
});
