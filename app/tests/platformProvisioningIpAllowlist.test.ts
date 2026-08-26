import { Request, Response } from "express";
import { requirePlatformProvisioningAllowedIp } from "../backend/middleware/platformProvisioningIpAllowlist";

describe("platform provisioning IP allowlist", () => {
  afterEach(() => {
    delete process.env.PLATFORM_PROVISIONING_ALLOWED_IPS;
  });

  it("is a no-op when no allowlist is configured", () => {
    const next = jest.fn();
    const req = { ip: "203.0.113.99" } as unknown as Request;

    requirePlatformProvisioningAllowedIp(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("allows an IP present in the configured allowlist", () => {
    process.env.PLATFORM_PROVISIONING_ALLOWED_IPS = "203.0.113.10, 203.0.113.11";
    const next = jest.fn();
    const req = { ip: "203.0.113.11" } as unknown as Request;

    requirePlatformProvisioningAllowedIp(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an IP not present in the configured allowlist", () => {
    process.env.PLATFORM_PROVISIONING_ALLOWED_IPS = "203.0.113.10";
    const next = jest.fn();
    const req = { ip: "198.51.100.5" } as unknown as Request;

    requirePlatformProvisioningAllowedIp(req, {} as Response, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it("normalizes IPv4-mapped IPv6 addresses before matching", () => {
    process.env.PLATFORM_PROVISIONING_ALLOWED_IPS = "127.0.0.1";
    const next = jest.fn();
    const req = { ip: "::ffff:127.0.0.1" } as unknown as Request;

    requirePlatformProvisioningAllowedIp(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });
});
