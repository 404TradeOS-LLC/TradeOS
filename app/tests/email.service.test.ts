import { EmailService } from "../modules/email/service";

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  APP_BASE_URL: process.env.APP_BASE_URL,
};

describe("EmailService", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "TradeOS <notifications@example.com>";
    process.env.APP_BASE_URL = "https://app.example.com";
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  });

  it("sends password reset emails through Resend with an opaque-token link", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_reset_123" }),
    });

    const token = "reset-token";
    const result = await new EmailService().sendPasswordReset({
      to: "owner@example.com",
      token,
      expiresAt: new Date("2026-08-26T12:00:00.000Z"),
    });

    expect(result).toEqual({ sent: true, providerMessageId: "re_reset_123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(request.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer re_test_key",
        "Idempotency-Key": expect.stringMatching(/^password-reset-/),
      })
    );

    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body.from).toBe("TradeOS <notifications@example.com>");
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.subject).toBe("Reset your TradeOS password");
    expect(body.text).toContain("https://app.example.com/reset-password?token=reset-token");
  });

  it("sends team invitations with the assigned role", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_invite_123" }),
    });

    await new EmailService().sendTeamInvite({
      to: "tech@example.com",
      role: "technician",
      token: "invite-token",
      expiresAt: new Date("2026-08-26T12:00:00.000Z"),
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body.subject).toBe("You have been invited to TradeOS");
    expect(body.text).toContain("Technician");
    expect(body.text).toContain("https://app.example.com/invite/accept?token=invite-token");
  });

  it("skips delivery outside production when email configuration is absent", async () => {
    delete process.env.RESEND_API_KEY;

    const result = await new EmailService().sendPasswordReset({
      to: "owner@example.com",
      token: "reset-token",
      expiresAt: new Date("2026-08-26T12:00:00.000Z"),
    });

    expect(result).toEqual({ sent: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose the provider response body when Resend rejects a request", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: "provider details" }),
    });

    await expect(
      new EmailService().sendPasswordReset({
        to: "owner@example.com",
        token: "reset-token",
        expiresAt: new Date("2026-08-26T12:00:00.000Z"),
      })
    ).rejects.toThrow("Resend email request failed (422)");
  });
});

function restoreEnvironment(): void {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
