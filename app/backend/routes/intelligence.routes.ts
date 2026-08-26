import { Router } from "express";
import { intelligenceController } from "../controllers/intelligence.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const intelligenceRouter = Router();

intelligenceRouter.get("/search", asyncHandler(intelligenceController.search));
intelligenceRouter.get("/activity", asyncHandler(intelligenceController.listActivity));
intelligenceRouter.post("/activity", asyncHandler(intelligenceController.createActivity));

intelligenceRouter.get("/notifications", asyncHandler(intelligenceController.listNotifications));
intelligenceRouter.post("/notifications", asyncHandler(intelligenceController.createNotification));
intelligenceRouter.patch("/notifications/:id", asyncHandler(intelligenceController.updateNotification));

intelligenceRouter.get("/attachments", asyncHandler(intelligenceController.listAttachments));
intelligenceRouter.post("/attachments", asyncHandler(intelligenceController.createAttachment));
intelligenceRouter.delete("/attachments/:id", asyncHandler(intelligenceController.removeAttachment));

intelligenceRouter.get("/comments", asyncHandler(intelligenceController.listComments));
intelligenceRouter.post("/comments", asyncHandler(intelligenceController.createComment));
intelligenceRouter.patch("/comments/:id", asyncHandler(intelligenceController.updateComment));

intelligenceRouter.get("/tags", asyncHandler(intelligenceController.listTags));
intelligenceRouter.post("/tags", asyncHandler(intelligenceController.createTag));
intelligenceRouter.get("/tag-assignments", asyncHandler(intelligenceController.listTagAssignments));
intelligenceRouter.post("/tag-assignments", asyncHandler(intelligenceController.assignTag));
intelligenceRouter.delete("/tag-assignments/:id", asyncHandler(intelligenceController.removeTagAssignment));

intelligenceRouter.get("/saved-views", asyncHandler(intelligenceController.listSavedViews));
intelligenceRouter.post("/saved-views", asyncHandler(intelligenceController.createSavedView));
intelligenceRouter.patch("/saved-views/:id", asyncHandler(intelligenceController.updateSavedView));
intelligenceRouter.delete("/saved-views/:id", asyncHandler(intelligenceController.removeSavedView));

intelligenceRouter.get("/recent-items", asyncHandler(intelligenceController.listRecentItems));
intelligenceRouter.post("/recent-items", asyncHandler(intelligenceController.recordRecentItem));

intelligenceRouter.get("/feature-flags", asyncHandler(intelligenceController.listFeatureFlags));
intelligenceRouter.post("/feature-flags", asyncHandler(intelligenceController.upsertFeatureFlag));
intelligenceRouter.post("/feature-flags/evaluate", asyncHandler(intelligenceController.evaluateFeatureFlag));
