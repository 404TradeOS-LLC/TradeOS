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


  it("exposes tenant-scoped canonical match preview and manager review routes", () => {
    expect(routes).toContain('costbookRouter.get("/supplier-evidence/products/:id/canonical-match"');
    expect(routes).toContain('costbookRouter.post("/supplier-evidence/products/:id/canonical-match"');

    const previewHandler = controller.match(
      /async previewRegionalSupplierCanonicalMatch\([\s\S]*?\n  },/
    )?.[0];
    expect(previewHandler).toBeDefined();
    expect(previewHandler).toContain('requirePermissions(req, ["costbook.read"])');
    expect(previewHandler).toContain("regionalSupplierEvidenceService.previewCanonicalMatch");
    expect(previewHandler).toContain("auth.orgId");

    const reviewHandler = controller.match(
      /async reviewRegionalSupplierCanonicalMatch\([\s\S]*?\n  },/
    )?.[0];
    expect(reviewHandler).toBeDefined();
    expect(reviewHandler).toContain('requirePermissions(req, ["costbook.manage"])');
    expect(reviewHandler).toContain("regionalSupplierEvidenceService.reviewCanonicalMatch");
    expect(reviewHandler).toContain("auth.orgId");
    expect(reviewHandler).toContain("auth.userId");
  });

  it("passes authenticated org scope instead of accepting orgId from the body", () => {
    expect(controller).toContain("orgId: auth.orgId");
    expect(controller).not.toContain("orgId: regionalSupplierEvidenceImportSchema");
  });
});
