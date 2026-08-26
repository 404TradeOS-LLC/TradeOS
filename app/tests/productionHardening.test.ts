import type { Request, Response } from "express";
import {
  assignRequestId,
  buildCorsOriginHandler,
  isAllowedCorsOrigin,
  parseTrustProxy,
  securityHeaders,
} from "../backend/middleware/productionHardening";

function mockResponse() {
  const res = {
    locals: {},
    setHeader: jest.fn(),
  } as unknown as Response;
  return res;
}

describe("parseTrustProxy", () => {
  it("parses booleans, integers, and passthrough values", () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy("true")).toBe(true);
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy("2")).toBe(2);
    expect(parseTrustProxy("loopback")).toBe("loopback");
  });
});

describe("assignRequestId", () => {
  it("reuses a caller-provided request id", () => {
    const req = { header: jest.fn().mockReturnValue("incoming-id") } as unknown as Request;
    const res = mockResponse();
    const next = jest.fn();

    assignRequestId(req, res, next);

    expect(res.locals).toMatchObject({ requestId: "incoming-id" });
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "incoming-id");
    expect(next).toHaveBeenCalled();
  });
});

describe("isAllowedCorsOrigin", () => {
  it("allows requests with no Origin header (non-browser / same-origin)", () => {
    expect(isAllowedCorsOrigin(undefined)).toBe(true);
  });

  it("allows the production frontend origin", () => {
    expect(isAllowedCorsOrigin("https://app.404tradeos.com")).toBe(true);
  });

  it("allows tradeos-costbook-web Vercel Preview deployments", () => {
    expect(isAllowedCorsOrigin("https://tradeos-costbook-web-abc123.vercel.app")).toBe(true);
    expect(isAllowedCorsOrigin("https://tradeos-costbook-web-git-feature-x-404tradeos.vercel.app")).toBe(true);
  });

  it("allows localhost at any port", () => {
    expect(isAllowedCorsOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedCorsOrigin("http://localhost")).toBe(true);
  });

  it("rejects an unrelated origin by default", () => {
    expect(isAllowedCorsOrigin("https://evil.example.com")).toBe(false);
  });

  it("rejects a different Vercel project's preview URL", () => {
    expect(isAllowedCorsOrigin("https://some-other-project-abc123.vercel.app")).toBe(false);
  });

  it("allows origins from CORS_ADDITIONAL_ORIGINS", () => {
    expect(isAllowedCorsOrigin("https://staging.404tradeos.com", "https://staging.404tradeos.com,https://demo.example.com")).toBe(
      true,
    );
    expect(isAllowedCorsOrigin("https://not-listed.example.com", "https://staging.404tradeos.com")).toBe(false);
  });
});

describe("buildCorsOriginHandler", () => {
  it("calls back with allow=true for an allowed origin", () => {
    const callback = jest.fn();
    buildCorsOriginHandler()("https://app.404tradeos.com", callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it("calls back with an error for a disallowed origin", () => {
    const callback = jest.fn();
    buildCorsOriginHandler()("https://evil.example.com", callback);
    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });

  it("honors an explicit additional-origins override", () => {
    const callback = jest.fn();
    buildCorsOriginHandler("https://staging.404tradeos.com")("https://staging.404tradeos.com", callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });
});

describe("securityHeaders", () => {
  const originalHsts = process.env.ENABLE_STRICT_TRANSPORT_SECURITY;

  afterEach(() => {
    process.env.ENABLE_STRICT_TRANSPORT_SECURITY = originalHsts;
  });

  it("applies api-safe headers and no-store cache policy", () => {
    process.env.ENABLE_STRICT_TRANSPORT_SECURITY = "true";

    const req = { path: "/api/v1/projects" } as Request;
    const res = mockResponse();
    const next = jest.fn();

    securityHeaders(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(res.setHeader).toHaveBeenCalledWith("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(next).toHaveBeenCalled();
  });
});
