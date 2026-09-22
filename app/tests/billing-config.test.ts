import { BILLING_CATALOG, getBillingPriceDefinition } from "../modules/billing/catalog";
import { getTradeOsAppUrl } from "../modules/billing/config";

describe("TradeOS billing configuration", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.TRADEOS_APP_URL;
  const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAppUrl === undefined) delete process.env.TRADEOS_APP_URL;
    else process.env.TRADEOS_APP_URL = originalAppUrl;
    if (originalPublicAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl;
  });

  it("serves the canonical four-plan catalog with expected recurring totals", () => {
    expect(BILLING_CATALOG.map((plan) => plan.id)).toEqual(["starter", "pro", "business", "scale"]);
    expect(getBillingPriceDefinition("starter", "monthly")).toMatchObject({ amountCents: 3_900, currency: "usd", stripeInterval: "month" });
    expect(getBillingPriceDefinition("scale", "annual")).toMatchObject({ amountCents: 399_000, currency: "usd", stripeInterval: "year" });
  });

  it("requires HTTPS for production redirect URLs", () => {
    process.env.NODE_ENV = "production";
    process.env.TRADEOS_APP_URL = "http://tradeos.example";
    expect(() => getTradeOsAppUrl()).toThrow("must use HTTPS in production");

    process.env.TRADEOS_APP_URL = "https://tradeos.example/";
    expect(getTradeOsAppUrl()).toBe("https://tradeos.example");
  });

  it("allows plain HTTP only for loopback development", () => {
    process.env.NODE_ENV = "test";
    process.env.TRADEOS_APP_URL = "http://localhost:3000/";
    expect(getTradeOsAppUrl()).toBe("http://localhost:3000");

    process.env.TRADEOS_APP_URL = "http://tradeos.internal";
    expect(() => getTradeOsAppUrl()).toThrow("must use HTTPS outside loopback development");
  });
});
