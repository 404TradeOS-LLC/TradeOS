import { isEntitledBillingStatus } from "../modules/billing/service";

describe("TradeOS billing status entitlements", () => {
  it.each(["active", "trialing"])("grants entitlements for %s subscriptions", (status) => {
    expect(isEntitledBillingStatus(status)).toBe(true);
  });

  it.each(["none", "incomplete", "past_due", "unpaid", "paused", "canceled"])(
    "withholds entitlements for %s subscriptions",
    (status) => {
      expect(isEntitledBillingStatus(status)).toBe(false);
    },
  );
});
