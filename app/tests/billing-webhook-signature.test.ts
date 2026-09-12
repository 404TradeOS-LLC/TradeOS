import crypto from "node:crypto";
import { verifyStripeWebhook } from "../modules/billing/stripeRest";

describe("Stripe webhook verification", () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_tradeos_test_secret";
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  it("accepts a valid v1 signature over the exact raw request body", () => {
    const body = Buffer.from(JSON.stringify({ id: "evt_tradeos_1", type: "customer.subscription.updated", data: { object: {} } }));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET!)
      .update(`${timestamp}.${body.toString("utf8")}`)
      .digest("hex");

    expect(verifyStripeWebhook(body, `t=${timestamp},v1=${signature}`)).toEqual(expect.objectContaining({ id: "evt_tradeos_1" }));
  });

  it("rejects a signature that was computed for different bytes", () => {
    const body = Buffer.from(JSON.stringify({ id: "evt_tradeos_2", type: "invoice.paid", data: { object: {} } }));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET!)
      .update(`${timestamp}.different-body`)
      .digest("hex");

    expect(() => verifyStripeWebhook(body, `t=${timestamp},v1=${signature}`)).toThrow("Invalid Stripe webhook signature");
  });
});
