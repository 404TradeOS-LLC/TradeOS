import { logError, logInfo, sanitizeLogMeta } from "../backend/logging";

describe("structured logging safety", () => {
  afterEach(() => jest.restoreAllMocks());

  it("redacts credential, token, cookie, body, and database fields recursively", () => {
    expect(
      sanitizeLogMeta({
        requestId: "req-1",
        authorization: "Bearer secret-token",
        nested: { refreshToken: "refresh-secret", body: { customerName: "Synthetic" } },
        safe: "Bearer visible-token",
      }),
    ).toEqual({
      requestId: "req-1",
      authorization: "[REDACTED]",
        nested: { refreshToken: "[REDACTED]", body: "[REDACTED]" },
        safe: "Bearer [REDACTED]",
      });
  });

  it("redacts sensitive query parameters in URLs and messages", () => {
    expect(sanitizeLogMeta({ url: "/invite?token=invite-secret&orgId=org-1", message: "See ?code=visible" })).toEqual({
      url: "/invite?token=[REDACTED]&orgId=org-1",
      message: "See ?code=[REDACTED]",
    });
  });

  it("does not emit sensitive values through logInfo or logError", () => {
    const info = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);

    logInfo("request.completed", { apiKey: "secret", requestId: "req-2" });
    logError("request.failed", { cookie: "session-secret", requestId: "req-2" });

    expect(info.mock.calls[0]?.[0]).not.toContain("secret");
    expect(error.mock.calls[0]?.[0]).not.toContain("session-secret");
    expect(info.mock.calls[0]?.[0]).toContain('"requestId":"req-2"');
  });
});
