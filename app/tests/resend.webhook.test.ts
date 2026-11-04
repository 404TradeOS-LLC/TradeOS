import { createHmac } from "node:crypto";
import request from "supertest";
import { createServer } from "../backend/server";
import { verifyResendWebhook } from "../modules/email/webhook";

const secret = "whsec_" + Buffer.from("a-32-byte-test-secret-for-resend-123").toString("base64");
const oldSecret = process.env.RESEND_WEBHOOK_SECRET;

function signedHeaders(body: string, timestamp = Math.floor(Date.now() / 1000), id = "msg_tradeos_test") {
  const value = createHmac("sha256", Buffer.from(secret.slice(6), "base64"))
    .update(`${id}.${timestamp}.`)
    .update(body)
    .digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": String(timestamp),
    "svix-signature": `v1,${value}`,
  };
}

const body = JSON.stringify({
  type: "email.delivered",
  created_at: "2026-11-04T15:00:00.000Z",
  data: { email_id: "email_demo" },
});

afterEach(() => {
  if (oldSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
  else process.env.RESEND_WEBHOOK_SECRET = oldSecret;
});

describe("Resend signed webhook ingress", () => {
  it("rejects traffic when the webhook signing secret is not configured", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const response = await request(createServer())
      .post("/api/v1/webhooks/resend")
      .set(signedHeaders(body))
      .set("Content-Type", "application/json")
      .send(body);
    expect(response.status).toBe(503);
  });

  it("acknowledges a valid signed event before authenticated API middleware", async () => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const response = await request(createServer())
      .post("/api/v1/webhooks/resend")
      .set(signedHeaders(body))
      .set("Content-Type", "application/json")
      .send(body);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
  });

  it("rejects a changed raw body rather than trusting parsed JSON", async () => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const changedBody = body.replace('"email_demo"', '"tampered"');
    const response = await request(createServer())
      .post("/api/v1/webhooks/resend")
      .set(signedHeaders(body))
      .set("Content-Type", "application/json")
      .send(changedBody);
    expect(response.status).toBe(400);
  });

  it("rejects expired signatures to prevent replay", async () => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const response = await request(createServer())
      .post("/api/v1/webhooks/resend")
      .set(signedHeaders(body, Math.floor(Date.now() / 1000) - 601))
      .set("Content-Type", "application/json")
      .send(body);
    expect(response.status).toBe(400);
  });

  it("rejects missing signatures", async () => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const response = await request(createServer())
      .post("/api/v1/webhooks/resend")
      .set("Content-Type", "application/json")
      .send(body);
    expect(response.status).toBe(400);
  });

  it("rate-limits repeated unauthenticated webhook posts", async () => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const app = createServer();
    let lastStatus = 200;
    for (let attempt = 0; attempt < 125; attempt += 1) {
      const response = await request(app)
        .post("/api/v1/webhooks/resend")
        .set("Content-Type", "application/json")
        .send(body);
      lastStatus = response.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("verifies a signed body and rejects malformed event envelopes", () => {
    const valid = verifyResendWebhook(Buffer.from(body), signedHeaders(body), secret);
    expect(valid.type).toBe("email.delivered");
    expect(valid.data.email_id).toBe("email_demo");

    const invalid = JSON.stringify({ event: "email.delivered", data: {} });
    expect(() => verifyResendWebhook(Buffer.from(invalid), signedHeaders(invalid), secret)).toThrow();
  });
});
