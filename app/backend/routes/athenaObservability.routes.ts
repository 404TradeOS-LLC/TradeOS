import { Router } from "express";
import { athenaObservabilityController } from "../controllers/athenaObservability.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const athenaObservabilityRouter = Router();
athenaObservabilityRouter.get("/overview", asyncHandler(athenaObservabilityController.overview));
athenaObservabilityRouter.get("/traces", asyncHandler(athenaObservabilityController.searchTraces));
athenaObservabilityRouter.get("/traces/by-trace/:traceId", asyncHandler(athenaObservabilityController.getTrace));
athenaObservabilityRouter.get("/traces/by-request/:requestId", asyncHandler(athenaObservabilityController.getTraceByRequest));
athenaObservabilityRouter.get("/tools", asyncHandler(athenaObservabilityController.toolMetrics));
athenaObservabilityRouter.get("/models", asyncHandler(athenaObservabilityController.modelMetrics));
athenaObservabilityRouter.get("/cost", asyncHandler(athenaObservabilityController.costSummary));
athenaObservabilityRouter.get("/events", asyncHandler(athenaObservabilityController.eventHealth));
athenaObservabilityRouter.get("/alerts", asyncHandler(athenaObservabilityController.alerts));
athenaObservabilityRouter.get("/security-events", asyncHandler(athenaObservabilityController.securityEvents));
