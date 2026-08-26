import { Router } from "express";
import { settingsController } from "../controllers/settings.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const settingsRouter = Router();

settingsRouter.get("/", asyncHandler(settingsController.get));
settingsRouter.patch("/", asyncHandler(settingsController.update));
settingsRouter.get("/assets/:assetKey", asyncHandler(settingsController.getAsset));
settingsRouter.post("/assets", asyncHandler(settingsController.recordAsset));
settingsRouter.delete("/assets/:assetKey", asyncHandler(settingsController.clearAsset));
