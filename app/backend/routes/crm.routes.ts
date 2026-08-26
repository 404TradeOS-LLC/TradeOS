import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { companyController, crmCustomersController, crmImportController, crmNotesController, jobsController, paymentsController } from "../controllers/crm.controller";

export const customersRouter = Router();
customersRouter.get("/", asyncHandler(crmCustomersController.list));
customersRouter.post("/", asyncHandler(crmCustomersController.create));
customersRouter.get("/:id", asyncHandler(crmCustomersController.getById));
customersRouter.patch("/:id", asyncHandler(crmCustomersController.update));
customersRouter.delete("/:id", asyncHandler(crmCustomersController.remove));
customersRouter.post("/:id/service-addresses", asyncHandler(crmCustomersController.addServiceAddress));
customersRouter.patch("/:id/service-addresses/:addressId", asyncHandler(crmCustomersController.updateServiceAddress));
customersRouter.delete("/:id/service-addresses/:addressId", asyncHandler(crmCustomersController.removeServiceAddress));
customersRouter.post("/:id/equipment", asyncHandler(crmCustomersController.addEquipment));
customersRouter.patch("/:id/equipment/:equipmentId", asyncHandler(crmCustomersController.updateEquipment));
customersRouter.delete("/:id/equipment/:equipmentId", asyncHandler(crmCustomersController.removeEquipment));
customersRouter.get("/:id/service-agreements", asyncHandler(crmCustomersController.listServiceAgreements));
customersRouter.post("/:id/service-agreements", asyncHandler(crmCustomersController.createServiceAgreement));

export const notesRouter = Router();
notesRouter.get("/", asyncHandler(crmNotesController.list));
notesRouter.post("/", asyncHandler(crmNotesController.create));

export const customerImportRouter = Router();
customerImportRouter.post("/", asyncHandler(crmImportController.importCustomers));

export const companyRouter = Router();
companyRouter.get("/", asyncHandler(companyController.get));
companyRouter.patch("/", asyncHandler(companyController.update));

export const jobsRouter = Router();
jobsRouter.get("/:id/notes", asyncHandler(jobsController.listNotes));
jobsRouter.post("/:id/notes", asyncHandler(jobsController.addNote));

export const invoicePaymentsRouter = Router();
invoicePaymentsRouter.get("/:id/payments", asyncHandler(paymentsController.list));
invoicePaymentsRouter.post("/:id/payments", asyncHandler(paymentsController.create));
