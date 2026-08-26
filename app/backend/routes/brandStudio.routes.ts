import { Router } from "express";
import { brandStudioController } from "../controllers/brandStudio.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const brandStudioRouter = Router();

brandStudioRouter.get("/profile", asyncHandler(brandStudioController.getProfile));
brandStudioRouter.put("/profile", asyncHandler(brandStudioController.updateProfile));
brandStudioRouter.get("/assets", asyncHandler(brandStudioController.listAssets));
brandStudioRouter.post("/assets", asyncHandler(brandStudioController.createAsset));
brandStudioRouter.delete("/assets/:assetId", asyncHandler(brandStudioController.deleteAsset));
brandStudioRouter.get("/document-settings", asyncHandler(brandStudioController.getDocumentSettings));
brandStudioRouter.put("/document-settings", asyncHandler(brandStudioController.updateDocumentSettings));
brandStudioRouter.get("/preview", asyncHandler(brandStudioController.getPreview));
