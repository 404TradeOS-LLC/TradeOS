import { getBillingEntitlements } from "../modules/billing/entitlements";

describe("TradeOS billing entitlements", () => {
  it("keeps product permissions independent from Stripe price identifiers", () => {
    expect(getBillingEntitlements("starter")).toEqual(expect.objectContaining({ maxUsers: 1, costbook: "basic", apiAccess: false }));
    expect(getBillingEntitlements("pro")).toEqual(expect.objectContaining({ maxUsers: 3, costbook: "regional", automations: true }));
    expect(getBillingEntitlements("business")).toEqual(expect.objectContaining({ maxUsers: 8, financialIntelligence: true }));
    expect(getBillingEntitlements("scale")).toEqual(expect.objectContaining({ maxUsers: 20, apiAccess: true }));
  });

  it("returns no entitlements before a subscription plan is synchronized", () => {
    expect(getBillingEntitlements(null)).toBeNull();
  });
});
