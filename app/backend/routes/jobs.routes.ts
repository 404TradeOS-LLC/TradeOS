import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { jobsController, scheduleController } from "../controllers/jobsTransactional.controller";
import { asyncHandler } from "../middleware/asyncHandler";

const uuidPathParam = (_req: Request, _res: Response, next: NextFunction, value: string) => {
  try {
    z.string().uuid().parse(value);
    next();
  } catch (error) {
    next(error);
  }
};

export const jobsRouter = Router();
jobsRouter.param("jobId", uuidPathParam);
jobsRouter.param("assignmentId", uuidPathParam);
jobsRouter.post("/", asyncHandler(jobsController.create));
jobsRouter.get("/", asyncHandler(jobsController.list));
jobsRouter.get("/dispatch-summary", asyncHandler(jobsController.dispatchSummary));
jobsRouter.get("/:jobId", asyncHandler(jobsController.getById));
jobsRouter.patch("/:jobId", asyncHandler(jobsController.update));
jobsRouter.delete("/:jobId", asyncHandler(jobsController.remove));
jobsRouter.put("/:jobId/schedule", asyncHandler(jobsController.schedule));
jobsRouter.post("/:jobId/reschedule", asyncHandler(jobsController.reschedule));
jobsRouter.get("/:jobId/assignments", asyncHandler(jobsController.listAssignments));
jobsRouter.post("/:jobId/assignments", asyncHandler(jobsController.addAssignment));
jobsRouter.patch("/:jobId/assignments/:assignmentId", asyncHandler(jobsController.updateAssignment));
jobsRouter.delete("/:jobId/assignments/:assignmentId", asyncHandler(jobsController.removeAssignment));
jobsRouter.post("/:jobId/assignments/:assignmentId/accept", asyncHandler(jobsController.acceptAssignment));
jobsRouter.post("/:jobId/assignments/:assignmentId/decline", asyncHandler(jobsController.declineAssignment));
jobsRouter.get("/:jobId/notes", asyncHandler(jobsController.listNotes));
jobsRouter.post("/:jobId/notes", asyncHandler(jobsController.addNote));
jobsRouter.post("/:jobId/dispatch", asyncHandler(jobsController.dispatch));
jobsRouter.post("/:jobId/start-travel", asyncHandler(jobsController.startTravel));
jobsRouter.post("/:jobId/arrive", asyncHandler(jobsController.arrive));
jobsRouter.post("/:jobId/pause", asyncHandler(jobsController.pause));
jobsRouter.post("/:jobId/resume", asyncHandler(jobsController.resume));
jobsRouter.post("/:jobId/complete", asyncHandler(jobsController.complete));
jobsRouter.post("/:jobId/cancel", asyncHandler(jobsController.cancel));
jobsRouter.post("/:jobId/reopen", asyncHandler(jobsController.reopen));
jobsRouter.post("/:jobId/ready-for-invoice", asyncHandler(jobsController.readyForInvoice));

export const scheduleRouter = Router();
scheduleRouter.get("/", asyncHandler(scheduleController.list));
scheduleRouter.get("/conflicts", asyncHandler(scheduleController.conflicts));
