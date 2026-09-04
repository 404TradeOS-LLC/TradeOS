import { Router } from "express";
import { customersController, projectFilesController, projectsController, siteVisitsController } from "../controllers/projects.controller";
import { projectTasksController } from "../controllers/projectTasks.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireProjectCustomerScope } from "../middleware/projectCustomerScope";

// Deprecated compatibility surface only.
// The mounted customer CRM API lives in crm.routes.ts and is the canonical
// backend surface for /api/v1/customers. Keep this router unmounted until the
// legacy controller code is removed in a dedicated cleanup sprint.
export const customersRouter = Router();
customersRouter.get("/", asyncHandler(customersController.list));
customersRouter.post("/", asyncHandler(customersController.create));
customersRouter.get("/:id", asyncHandler(customersController.getById));
customersRouter.patch("/:id", asyncHandler(customersController.update));
customersRouter.delete("/:id", asyncHandler(customersController.remove));

export const projectsRouter = Router();
projectsRouter.get("/tasks", asyncHandler(projectTasksController.listByOrganization));
projectsRouter.get("/", asyncHandler(projectsController.list));
projectsRouter.post("/", asyncHandler(requireProjectCustomerScope), asyncHandler(projectsController.create));
projectsRouter.get("/:id", asyncHandler(projectsController.getById));
projectsRouter.patch("/:id", asyncHandler(requireProjectCustomerScope), asyncHandler(projectsController.update));
projectsRouter.patch("/:id/status", asyncHandler(projectsController.updateStatus));
projectsRouter.get("/:id/site-visits", asyncHandler(siteVisitsController.listByProject));
projectsRouter.post("/:id/site-visits", asyncHandler(siteVisitsController.create));
projectsRouter.patch("/:id/site-visits/:siteVisitId", asyncHandler(siteVisitsController.update));
projectsRouter.get("/:id/files", asyncHandler(projectFilesController.listByProject));
projectsRouter.post("/:id/files", asyncHandler(projectFilesController.create));
projectsRouter.delete("/:id/files/:fileId", asyncHandler(projectFilesController.remove));
projectsRouter.get("/:id/tasks", asyncHandler(projectTasksController.listByProject));
projectsRouter.post("/:id/tasks", asyncHandler(projectTasksController.create));
projectsRouter.patch("/:id/tasks/:taskId", asyncHandler(projectTasksController.update));
projectsRouter.delete("/:id/tasks/:taskId", asyncHandler(projectTasksController.remove));
