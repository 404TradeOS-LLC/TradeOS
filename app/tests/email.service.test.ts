import { EmailService } from "../modules/email/service";

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  APP_BASE_URL: process.env.APP_BASE_URL,
  RESEND_TEMPLATE_MODE: process.env.RESEND_TEMPLATE_MODE,
};

describe("EmailService", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "TradeOS <notifications@example.com>";
    process.env.APP_BASE_URL = "https://app.example.com";
    delete process.env.RESEND_TEMPLATE_MODE;
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
    expect(body.html).toContain("BUILT FOR WHAT YOU BUILD.");
    expect(body.html).toContain("Reset your password");
    expect(body.text).not.toContain("<html");
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

  it("sends customer portal access with a single-use token link", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_portal_123" }),
    });

    const result = await new EmailService().sendCustomerPortalAccess({
      to: "customer@example.com",
      token: "portal-token",
      expiresAt: new Date("2026-09-20T12:00:00.000Z"),
    });

    expect(result).toEqual({ sent: true, providerMessageId: "re_portal_123" });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toEqual(expect.objectContaining({
      "Idempotency-Key": expect.stringMatching(/^customer-portal-access-/),
    }));
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body.to).toEqual(["customer@example.com"]);
    expect(body.subject).toBe("Your TradeOS customer portal is ready");
    expect(body.text).toContain("https://app.example.com/customer-portal/access?token=portal-token");
    expect(body.text).toContain("2026-09-20T12:00:00.000Z");
  });

  it("uses the published password-reset template only when explicitly opted in", async () => {
    process.env.RESEND_TEMPLATE_MODE = "dashboard";
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_template_reset_123" }),
    });

    const result = await new EmailService().sendPasswordReset({
      to: "owner@example.com",
      token: "secret-reset-token",
      expiresAt: new Date("2026-11-05T18:00:00.000Z"),
    });

    expect(result).toEqual({ sent: true, providerMessageId: "re_template_reset_123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toEqual({
      from: "TradeOS <notifications@example.com>",
      to: ["owner@example.com"],
      template: {
        id: "tradeos-password-reset",
        variables: {
          RESET_URL: "https://app.example.com/reset-password?token=secret-reset-token",
          EXPIRES_AT: "2026-11-05T18:00:00.000Z",
        },
      },
    });
    expect(body).not.toHaveProperty("html");
    expect(body).not.toHaveProperty("text");
    expect(body).not.toHaveProperty("subject");
    expect(request.headers).toEqual(expect.objectContaining({
      "Idempotency-Key": expect.stringMatching(/^password-reset-/),
    }));
  });

  it("sends the published team invitation with the exact role and action link variables", async () => {
    process.env.RESEND_TEMPLATE_MODE = "dashboard";
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_template_invite_123" }),
    });
    await new EmailService().sendTeamInvite({
      to: "technician@example.com",
      role: "technician",
      token: "secret-invite-token",
      expiresAt: new Date("2026-11-06T18:00:00.000Z"),
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body.template).toEqual({
      id: "tradeos-team-invitation",
      variables: {
        INVITE_URL: "https://app.example.com/invite/accept?token=secret-invite-token",
        ROLE: "Technician",
        EXPIRES_AT: "2026-11-06T18:00:00.000Z",
      },
    });
    expect(body).not.toHaveProperty("html");
    expect(body).not.toHaveProperty("text");
  });

  it("sends the published customer portal template with the single-use URL", async () => {
    process.env.RESEND_TEMPLATE_MODE = "dashboard";
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_template_portal_123" }),
    });
    await new EmailService().sendCustomerPortalAccess({
      to: "customer@example.com",
      token: "secret-portal-token",
      expiresAt: new Date("2026-11-07T18:00:00.000Z"),
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body.template).toEqual({
      id: "tradeos-customer-portal-access",
      variables: {
        PORTAL_URL: "https://app.example.com/customer-portal/access?token=secret-portal-token",
        EXPIRES_AT: "2026-11-07T18:00:00.000Z",
      },
    });
    expect(body).not.toHaveProperty("html");
    expect(body).not.toHaveProperty("text");
  });

  it("preserves inline sending if the template-mode value is not exactly dashboard", async () => {
    process.env.RESEND_TEMPLATE_MODE = "Dashboard";
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "re_inline_123" }),
    });
    await new EmailService().sendPasswordReset({
      to: "owner@example.com",
      token: "secret-inline-token",
      expiresAt: new Date("2026-11-05T18:00:00.000Z"),
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("template");
    expect(body.html).toContain("BUILT FOR WHAT YOU BUILD.");
    expect(body.text).toContain("secret-inline-token");
  });

  it("fails closed without a second inline send when a configured template fails", async () => {
    process.env.RESEND_TEMPLATE_MODE = "dashboard";
    fetchMock.mockResolvedValue({ ok: false, status: 422 });
    await expect(new EmailService().sendPasswordReset({
      to: "owner@example.com",
      token: "failed-template-token",
      expiresAt: new Date("2026-11-05T18:00:00.000Z"),
    })).rejects.toThrow("Resend email request failed (422)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
