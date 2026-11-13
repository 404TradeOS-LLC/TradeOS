import { Router } from "express";
import rateLimit from "express-rate-limit";
import { SharedSupplierCronRateLimitStore } from "./supplierCronRateLimitStore";
import { isCatalogEnabled } from "../../modules/supplier-integration/abcCatalog";
import { costbookController as ctrl } from "../controllers/costbook.controller";
import { codesPermitTasksController as permitTasksCtrl } from "../controllers/costbookCodesPermitTasks.controller";
import { codesFeeReviewsController as feeReviewsCtrl } from "../controllers/costbookCodesFeeReviews.controller";
import { costbookPricingController as pricingCtrl } from "../controllers/costbookPricing.controller";
import { costDatabaseController as costItemCtrl } from "../controllers/costDatabase.controller";
import { assembliesDatabaseController as assemblyCtrl } from "../controllers/assembliesDatabase.controller";
import { costbookCandidatesController as candidateCtrl } from "../controllers/costbookCandidates.controller";
import { costbookCompositeBenchmarksController as compositeBenchmarkCtrl } from "../controllers/costbookCompositeBenchmarks.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { davisBaconController as davisBaconCtrl } from "../controllers/davisBacon.controller";

export const costbookRouter = Router();

costbookRouter.get("/workspace", asyncHandler(ctrl.workspace));
// Permit/inspection execution (#946 TODO 5): explicit statuses only, no
// auto-submit, no estimate mutation. Fee reviews are price-neutral by
// construction; see app/modules/costbook/codes/feeReviews.service.ts.
// (The pilot's GET /codes advisory route lands with #945; these paths
// do not collide with it.)
costbookRouter.get("/codes/permit-tasks", asyncHandler(permitTasksCtrl.list));
costbookRouter.post("/codes/permit-tasks", asyncHandler(permitTasksCtrl.create));
costbookRouter.get("/codes/permit-tasks/:taskId", asyncHandler(permitTasksCtrl.getById));
costbookRouter.patch("/codes/permit-tasks/:taskId", asyncHandler(permitTasksCtrl.update));
costbookRouter.post("/codes/permit-tasks/:taskId/submit", asyncHandler(permitTasksCtrl.submit));
costbookRouter.delete("/codes/permit-tasks/:taskId", asyncHandler(permitTasksCtrl.remove));
costbookRouter.get("/codes/fee-reviews", asyncHandler(feeReviewsCtrl.list));
costbookRouter.post("/codes/fee-reviews", asyncHandler(feeReviewsCtrl.create));
costbookRouter.get("/codes/fee-reviews/:feeReviewId", asyncHandler(feeReviewsCtrl.getById));
costbookRouter.post("/codes/fee-reviews/:feeReviewId/review", asyncHandler(feeReviewsCtrl.review));
costbookRouter.post("/codes/fee-reviews/:feeReviewId/select-cost-item", asyncHandler(feeReviewsCtrl.selectCostItem));
costbookRouter.delete("/codes/fee-reviews/:feeReviewId", asyncHandler(feeReviewsCtrl.remove));
// Product API browsing and details use one shared global rate-limit budget.
const abcCatalogLimiter = rateLimit({
  store: new SharedSupplierCronRateLimitStore("abc-catalog"),
  windowMs: 1000,
  limit: 2,
  keyGenerator: () => "abc-sandbox-product-read",
  skip: () => !isCatalogEnabled(),
  standardHeaders: true,
  legacyHeaders: false,
});
costbookRouter.get("/abc/catalog", abcCatalogLimiter, asyncHandler(ctrl.abcCatalog));
costbookRouter.get("/abc/catalog/items/:itemNumber", abcCatalogLimiter, asyncHandler(ctrl.abcCatalogItem));
costbookRouter.get("/abc/catalog/items/:itemNumber/availability", abcCatalogLimiter, asyncHandler(ctrl.abcCatalogAvailability));
costbookRouter.get("/abc/hierarchy", abcCatalogLimiter, asyncHandler(ctrl.abcCatalogHierarchy));
costbookRouter.get("/supplier-evidence/summary", asyncHandler(ctrl.regionalSupplierEvidenceSummary));
costbookRouter.get("/supplier-evidence", asyncHandler(ctrl.listRegionalSupplierEvidence));
costbookRouter.post("/supplier-evidence/import", asyncHandler(ctrl.importRegionalSupplierEvidence));
costbookRouter.get("/supplier-evidence/products/:id/canonical-match", asyncHandler(ctrl.previewRegionalSupplierCanonicalMatch));
costbookRouter.post("/supplier-evidence/products/:id/canonical-match", asyncHandler(ctrl.reviewRegionalSupplierCanonicalMatch));
costbookRouter.post("/pricing/preview", asyncHandler(pricingCtrl.preview));
costbookRouter.get("/pricing/resolve", asyncHandler(pricingCtrl.resolve));
costbookRouter.get("/price-history", asyncHandler(pricingCtrl.history));
costbookRouter.get("/davis-bacon/determinations", asyncHandler(davisBaconCtrl.listDeterminations));
costbookRouter.get("/davis-bacon/rates", asyncHandler(davisBaconCtrl.listRates));
costbookRouter.get("/davis-bacon/county-rates", asyncHandler(davisBaconCtrl.countyRates));

costbookRouter.get("/cost-items", asyncHandler(costItemCtrl.list));
costbookRouter.get("/cost-items/search", asyncHandler(costItemCtrl.search));
costbookRouter.get("/cost-items/:id/unit-cost", asyncHandler(costItemCtrl.getUnitCost));
costbookRouter.get("/cost-items/:id", asyncHandler(costItemCtrl.getById));
costbookRouter.post("/cost-items", asyncHandler(costItemCtrl.create));
costbookRouter.patch("/cost-items/:id", asyncHandler(costItemCtrl.update));
costbookRouter.delete("/cost-items/:id", asyncHandler(costItemCtrl.remove));

costbookRouter.get("/assemblies", asyncHandler(assemblyCtrl.list));
costbookRouter.get("/assemblies/search", asyncHandler(assemblyCtrl.search));
costbookRouter.get("/assemblies/templates", asyncHandler(assemblyCtrl.templates));
costbookRouter.get("/assemblies/starter-catalog", asyncHandler(assemblyCtrl.starterCatalog));
costbookRouter.post("/assemblies/starter-catalog/install", asyncHandler(assemblyCtrl.installStarterCatalog));
costbookRouter.get("/assemblies/:id/unit-cost", asyncHandler(assemblyCtrl.getUnitCost));
costbookRouter.get("/assemblies/:id/items", asyncHandler(assemblyCtrl.listItems));
costbookRouter.get("/assemblies/:id", asyncHandler(assemblyCtrl.getById));
costbookRouter.post("/assemblies", asyncHandler(assemblyCtrl.create));
costbookRouter.patch("/assemblies/:id", asyncHandler(assemblyCtrl.update));
costbookRouter.delete("/assemblies/:id", asyncHandler(assemblyCtrl.remove));
costbookRouter.post("/assemblies/:id/items", asyncHandler(assemblyCtrl.addItem));
costbookRouter.delete("/assemblies/:id/items/:itemId", asyncHandler(assemblyCtrl.removeItem));

costbookRouter.get("/equipment", asyncHandler(ctrl.listEquipment));
costbookRouter.get("/equipment/:id", asyncHandler(ctrl.getEquipment));
costbookRouter.post("/equipment", asyncHandler(ctrl.createEquipment));
costbookRouter.patch("/equipment/:id", asyncHandler(ctrl.updateEquipment));
costbookRouter.delete("/equipment/:id", asyncHandler(ctrl.removeEquipment));
costbookRouter.get("/labor-rates", asyncHandler(ctrl.listLaborRates));
costbookRouter.get("/labor-rates/:id", asyncHandler(ctrl.getLaborRate));
costbookRouter.post("/labor-rates", asyncHandler(ctrl.createLaborRate));
costbookRouter.patch("/labor-rates/:id", asyncHandler(ctrl.updateLaborRate));
costbookRouter.delete("/labor-rates/:id", asyncHandler(ctrl.removeLaborRate));
costbookRouter.get("/materials", asyncHandler(ctrl.listMaterials));
costbookRouter.get("/materials/:id", asyncHandler(ctrl.getMaterial));
costbookRouter.post("/materials", asyncHandler(ctrl.createMaterial));
costbookRouter.patch("/materials/:id", asyncHandler(ctrl.updateMaterial));
costbookRouter.delete("/materials/:id", asyncHandler(ctrl.removeMaterial));
costbookRouter.get("/divisions", asyncHandler(ctrl.listDivisions));
costbookRouter.get("/divisions/:id", asyncHandler(ctrl.getDivision));
costbookRouter.post("/divisions", asyncHandler(ctrl.createDivision));
costbookRouter.patch("/divisions/:id", asyncHandler(ctrl.updateDivision));
costbookRouter.delete("/divisions/:id", asyncHandler(ctrl.removeDivision));
costbookRouter.get("/categories", asyncHandler(ctrl.listCategories));
costbookRouter.get("/categories/:id", asyncHandler(ctrl.getCategory));
costbookRouter.post("/categories", asyncHandler(ctrl.createCategory));
costbookRouter.patch("/categories/:id", asyncHandler(ctrl.updateCategory));
costbookRouter.delete("/categories/:id", asyncHandler(ctrl.removeCategory));
costbookRouter.get("/subcategories", asyncHandler(ctrl.listSubcategories));
costbookRouter.get("/subcategories/:id", asyncHandler(ctrl.getSubcategory));
costbookRouter.post("/subcategories", asyncHandler(ctrl.createSubcategory));
costbookRouter.patch("/subcategories/:id", asyncHandler(ctrl.updateSubcategory));
costbookRouter.delete("/subcategories/:id", asyncHandler(ctrl.removeSubcategory));

// Composite installed-price benchmark/history ingestion. These records are
// reference evidence only and are intentionally isolated from material,
// labor, equipment, and customer bill-rate tables.
costbookRouter.post("/benchmarks/composite/import", asyncHandler(compositeBenchmarkCtrl.importRows));

// Stage 6 research-candidate review queue (see
// docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md). A candidate is
// never a production Costbook record; only /promote writes one, and only
// for a candidate a named human reviewer already approved.
costbookRouter.get("/candidates", asyncHandler(candidateCtrl.list));
costbookRouter.post("/candidates", asyncHandler(candidateCtrl.create));
// Static segments must precede "/:id" so they are not parsed as a candidate id.
costbookRouter.get("/candidates/summary", asyncHandler(candidateCtrl.summary));
costbookRouter.get("/candidates/corpus-report", asyncHandler(candidateCtrl.corpusReport));
// Stage 2/3 ingestion: normalizes one Knowledge Engine corpus item into an
// unreviewed candidate, or fails closed listing the missing source evidence.
costbookRouter.post("/candidates/from-knowledge", asyncHandler(candidateCtrl.ingestFromKnowledge));
costbookRouter.get("/candidates/:id", asyncHandler(candidateCtrl.getById));
// Read-only duplicate/price-delta analysis against this organization's catalog.
costbookRouter.get("/candidates/:id/match", asyncHandler(candidateCtrl.match));
costbookRouter.post("/candidates/:id/review", asyncHandler(candidateCtrl.review));
costbookRouter.post("/candidates/:id/promote", asyncHandler(candidateCtrl.promote));
