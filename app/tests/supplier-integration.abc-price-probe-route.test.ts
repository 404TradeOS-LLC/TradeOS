jest.mock("../modules/supplier-integration/abcPricingProbe", () => ({
  probeAbcSandboxPricing: jest.fn(),
}));
jest.mock("../backend/requestContext", () => ({
  requireOrgId: jest.fn(),
  requirePermissions: jest.fn(),
}));
jest.mock("../modules/supplier-integration/service", () => ({
  SupplierIntegrationService: jest.fn().mockImplementation(() => ({})),
}));

import express from "express";
import request from "supertest";
import { createServer } from "../backend/server";
import { supplierIntegrationRouter } from "../backend/routes/supplierIntegration.routes";
import { probeAbcSandboxPricing } from "../modules/supplier-integration/abcPricingProbe";
import { requireOrgId, requirePermissions } from "../backend/requestContext";

const probe = probeAbcSandboxPricing as jest.Mock;
const permissions = requirePermissions as jest.Mock;
const org = requireOrgId as jest.Mock;
function app() {
  const server = express();
  server.use(express.json());
  server.use("/api/v1/supplier-integrations", supplierIntegrationRouter);
  server.use((error: any, _req: any, res: any, _next: any) => {
    res.status(error?.statusCode || error?.status || 400).json({ error: "rejected" });
  });
  return server;
}

describe("ABC sandbox probe permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    org.mockReturnValue("6d9fbc90-e4db-45b5-b6c7-852def03695a");
    permissions.mockReturnValue({ role: "owner", userId: "ce018fa6-2644-44ae-8c19-6899faf0221c" });
    probe.mockResolvedValue({ sku: "654210", priced: false, price: null, materialCreated: false, priceApplied: false });
  });

  it("rejects non-admin actor even with costbook.manage role permissions", async () => {
    permissions.mockReturnValue({ role: "estimator" });
    const response = await request(app()).post("/api/v1/supplier-integrations/abc/price-probe")
      .send({ productKey: "ABC-654210" });
    expect(response.status).toBe(403);
    expect(probe).not.toHaveBeenCalled();
  });

  it("rejects invalid or multiple keys before pricing", async () => {
    const response = await request(app()).post("/api/v1/supplier-integrations/abc/price-probe")
      .send({ productKey: "ABC-654210", orgId: "another-org" });
    expect(response.status).toBe(400);
    const badKey = await request(app()).post("/api/v1/supplier-integrations/abc/price-probe")
      .send({ productKey: "../../../token" });
    expect(badKey.status).toBe(400);
    expect(probe).not.toHaveBeenCalled();
  });

  it("only accepts reviewed product key via scoped route", async () => {
    const response = await request(app()).post("/api/v1/supplier-integrations/abc/price-probe")
      .send({ productKey: "ABC-654210" });
    expect(response.status).toBe(200);
    expect(permissions).toHaveBeenCalledWith(expect.anything(), ["costbook.manage"]);
    expect(probe).toHaveBeenCalledWith("6d9fbc90-e4db-45b5-b6c7-852def03695a", "ABC-654210");
  });
});
