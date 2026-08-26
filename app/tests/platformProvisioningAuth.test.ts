import { Request, Response } from "express";
import { requirePlatformProvisioningSecret } from "../backend/middleware/platformProvisioningAuth";

describe("platform provisioning authentication", () => {
  const secret = "a-secure-platform-provisioning-key-123456";

  afterEach(() => {
    delete process.env.PLATFORM_PROVISIONING_SECRET;
  });

  it("accepts the configured high-entropy provisioning key", () => {
    process.env.PLATFORM_PROVISIONING_SECRET = secret;
    const next = jest.fn();
    const req = { header: () => secret } as unknown as Request;

    requirePlatformProvisioningSecret(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an invalid provisioning key", () => {
    process.env.PLATFORM_PROVISIONING_SECRET = secret;
    const next = jest.fn();
    const req = { header: () => "not-the-secret" } as unknown as Request;

    requirePlatformProvisioningSecret(req, {} as Response, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it("fails closed when provisioning is not configured", () => {
    const next = jest.fn();
    const req = { header: () => undefined } as unknown as Request;

    requirePlatformProvisioningSecret(req, {} as Response, next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 503 });
  });
});
