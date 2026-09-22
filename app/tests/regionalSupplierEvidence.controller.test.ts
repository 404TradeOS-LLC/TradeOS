import fs from "node:fs";
import path from "node:path";

describe("regional supplier evidence API contract", () => {
  const controller = fs.readFileSync(
    path.resolve(__dirname, "../backend/controllers/costbook.controller.ts"),
    "utf8"
  );
  const routes = fs.readFileSync(
    path.resolve(__dirname, "../backend/routes/costbook.routes.ts"),
    "utf8"
  );

  it("registers a manager-gated import endpoint", () => {
    expect(routes).toContain('costbookRouter.get("/supplier-evidence/summary"');
    expect(routes).toContain('costbookRouter.get("/supplier-evidence"');
    expect(routes).toContain('costbookRouter.post("/supplier-evidence/import"');
    const importHandler = controller.match(
      /async importRegionalSupplierEvidence\([\s\S]*?\n  },/
    )?.[0];
    expect(importHandler).toBeDefined();
    expect(importHandler).toContain('requirePermissions(req, ["costbook.manage"])');
    expect(importHandler).toContain("regionalSupplierEvidenceService.ingest");
    expect(controller).toContain("regionalSupplierEvidenceService.list");
    expect(controller).toContain("regionalSupplierEvidenceService.summary");
  });

  it("passes authenticated org scope instead of accepting orgId from the body", () => {
    expect(controller).toContain("orgId: auth.orgId");
    expect(controller).not.toContain("orgId: regionalSupplierEvidenceImportSchema");
  });
});
