import assert from "node:assert/strict";
import test from "node:test";
import { renderTradeOsEmail } from "../modules/email/brand";

test("email brand shell preserves escaped content and uses canonical branding", () => {
  const html = renderTradeOsEmail("<p>Secure &amp; private</p>");
  assert.match(html, /TradeOS/);
  assert.match(html, /BUILT FOR WHAT YOU BUILD/);
  assert.match(html, /<p>Secure &amp; private<\/p>/);
  assert.match(html, /#202225/);
});
