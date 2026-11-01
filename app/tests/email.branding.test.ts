import { renderTradeOsEmail } from "../modules/email/brand";

describe("TradeOS transactional email branding", () => {
  it("preserves escaped content and uses the platform's canonical brand", () => {
    const html = renderTradeOsEmail("<p>Secure &amp; private</p>");
    expect(html).toContain("TradeOS");
    expect(html).toContain("BUILT FOR WHAT YOU BUILD");
    expect(html).toContain("<p>Secure &amp; private</p>");
    expect(html).toContain("#202225");
  });
});
