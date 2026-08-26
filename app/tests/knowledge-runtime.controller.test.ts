import express from "express";
import request from "supertest";
import { errorHandler } from "../backend/middleware/errorHandler";
import { knowledgeRuntimeRouter } from "../backend/routes/knowledgeRuntime.routes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { orgId?: string }).orgId = "test-org";
    next();
  });
  app.use("/api/v1/knowledge", knowledgeRuntimeRouter);
  app.use(errorHandler);
  return app;
}

describe("knowledge runtime routes", () => {
  it("serves stats from the knowledge runtime endpoint", async () => {
    const response = await request(buildApp()).get("/api/v1/knowledge/stats");

    expect(response.status).toBe(200);
    expect(response.body.readOnly).toBe(true);
    expect(response.body.costItemsCount).toBeGreaterThan(0);
  });

  it("serves unified search results", async () => {
    const response = await request(buildApp()).get("/api/v1/knowledge/search").query({ q: "driveway", type: "costItem", limit: 3 });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.every((result: { type: string }) => result.type === "costItem")).toBe(true);
  });

  it("serves scope-match results from the normalized endpoint", async () => {
    const response = await request(buildApp())
      .post("/api/v1/knowledge/match")
      .send({ scopeText: "Remove a 60 foot oak tree, grind the stump, and haul away debris." });

    expect(response.status).toBe(200);
    expect(response.body.detectedTrade).toBe("Tree Service");
    expect(Array.isArray(response.body.matchedCostItems)).toBe(true);
    expect(Array.isArray(response.body.assumptions)).toBe(true);
  });

  it("returns validation errors for an empty match request", async () => {
    const response = await request(buildApp()).post("/api/v1/knowledge/match").send({ scopeText: " " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
  });
});
