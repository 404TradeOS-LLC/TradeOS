import { Request, Response } from "express";
import { z } from "zod";
import { CrmService } from "../../modules/crm/service";
import { ActivityTimelineService } from "../../modules/intelligence/service";
import { requireAuthContext, requireOrgAdmin, requireOrgId, requireRoles } from "../requestContext";

const service = new CrmService();
const activityService = new ActivityTimelineService();
const hexColor = /^#(?:[0-9a-fA-F]{6})$/;

const customerSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().max(64).optional(),
    address: z.string().trim().max(500).optional(),
    billingAddress: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

const customerUpdateSchema = customerSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one customer field is required",
});

const serviceAddressSchema = z
  .object({
    label: z.string().trim().max(120).optional(),
    addressLine1: z.string().trim().min(1).max(240),
    addressLine2: z.string().trim().max(240).optional(),
    city: z.string().trim().min(1).max(120),
    state: z.string().trim().min(1).max(120),
    postalCode: z.string().trim().min(1).max(32),
    country: z.string().trim().max(120).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

const serviceAddressUpdateSchema = serviceAddressSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one service address field is required",
});

const equipmentSchema = z
  .object({
    serviceAddressId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160),
    manufacturer: z.string().trim().max(160).optional(),
    model: z.string().trim().max(160).optional(),
    serialNumber: z.string().trim().max(160).optional(),
    installedAt: z.string().datetime().optional(),
    status: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

const equipmentUpdateSchema = equipmentSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one equipment field is required",
});

const noteSchema = z
  .object({
    entityType: z.enum(["customer", "job"]),
    entityId: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

const customerImportSchema = z
  .object({
    csvContent: z.string().min(1),
  })
  .strict();

const serviceAgreementSchema = z
  .object({
    serviceAddressId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160),
    status: z.string().trim().max(80).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    billingCadence: z.string().trim().max(80).optional(),
    amount: z.number().nonnegative().optional(),
    terms: z.string().trim().max(4000).optional(),
  })
  .strict();

const paymentSchema = z
  .object({
    amount: z.number().positive(),
    paymentDate: z.string().datetime(),
    method: z.string().trim().min(1).max(120),
    status: z.string().trim().max(80).optional(),
    reference: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

const companyProfileSchema = z
  .object({
    companyName: z.string().trim().min(1).max(160),
    phone: z.string().trim().max(64).optional(),
    email: z.string().trim().email().max(320).optional(),
    address: z.string().trim().max(500).optional(),
    logoUrl: z.string().trim().url().max(500).optional(),
    primaryColor: z.string().regex(hexColor, "primaryColor must be a valid hex color").optional(),
    secondaryColor: z.string().regex(hexColor, "secondaryColor must be a valid hex color").optional(),
  })
  .strict();

export const crmCustomersController = {
  async list(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher", "technician"]);
    res.json(await service.listCustomers(requireOrgId(req)));
  },
  async create(req: Request, res: Response) {
    const auth = requireRoles(req, ["owner", "dispatcher"]);
    const customer = await service.createCustomer(requireOrgId(req), customerSchema.parse(req.body));
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "customer",
      entityId: customer.id,
      eventType: "customer.created",
      title: `Customer created: ${customer.name}`,
      actorUserId: auth.userId,
    });
    res.status(201).json(customer);
  },
  async getById(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher", "technician"]);
    res.json(await service.getCustomer(requireOrgId(req), req.params.id));
  },
  async update(req: Request, res: Response) {
    const auth = requireRoles(req, ["owner", "dispatcher"]);
    const input = customerUpdateSchema.parse(req.body);
    const customer = await service.updateCustomer(requireOrgId(req), req.params.id, input);
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "customer",
      entityId: customer.id,
      eventType: "customer.updated",
      title: `Customer updated: ${customer.name}`,
      actorUserId: auth.userId,
      metadata: { fields: Object.keys(input).sort() },
    });
    res.json(customer);
  },
  async remove(req: Request, res: Response) {
    const auth = requireRoles(req, ["owner", "dispatcher"]);
    await service.removeCustomer(requireOrgId(req), req.params.id);
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "customer",
      entityId: req.params.id,
      eventType: "customer.deleted",
      title: "Customer archived",
      actorUserId: auth.userId,
    });
    res.status(204).send();
  },
  async addServiceAddress(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher"]);
    res.status(201).json(await service.addServiceAddress(requireOrgId(req), req.params.id, serviceAddressSchema.parse(req.body)));
  },
  async updateServiceAddress(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher"]);
    res.json(
      await service.updateServiceAddress(requireOrgId(req), req.params.id, req.params.addressId, serviceAddressUpdateSchema.parse(req.body))
    );
  },
  async removeServiceAddress(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher"]);
    await service.removeServiceAddress(requireOrgId(req), req.params.id, req.params.addressId);
    res.status(204).send();
  },
  async addEquipment(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher"]);
    res.status(201).json(await service.addEquipment(requireOrgId(req), req.params.id, equipmentSchema.parse(req.body)));
  },
  async updateEquipment(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher"]);
    res.json(await service.updateEquipment(requireOrgId(req), req.params.id, req.params.equipmentId, equipmentUpdateSchema.parse(req.body)));
  },
  async removeEquipment(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher"]);
    await service.removeEquipment(requireOrgId(req), req.params.id, req.params.equipmentId);
    res.status(204).send();
  },
  async listServiceAgreements(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher", "technician"]);
    res.json(await service.listServiceAgreements(requireOrgId(req), req.params.id));
  },
  async createServiceAgreement(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher"]);
    res.status(201).json(await service.createServiceAgreement(requireOrgId(req), req.params.id, serviceAgreementSchema.parse(req.body)));
  },
};

export const crmNotesController = {
  async list(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher", "technician"]);
    res.json(await service.listNotes(requireOrgId(req), req.query.entityType as "customer" | "job", String(req.query.entityId ?? "")));
  },
  async create(req: Request, res: Response) {
    const auth = requireRoles(req, ["owner", "dispatcher", "technician"]);
    res.status(201).json(await service.createNote(requireOrgId(req), auth.userId, noteSchema.parse(req.body)));
  },
};

export const crmImportController = {
  async importCustomers(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher"]);
    res.status(201).json(await service.importCustomers(requireOrgId(req), customerImportSchema.parse(req.body).csvContent));
  },
};

export const companyController = {
  async get(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher", "technician"]);
    res.json(await service.getCompanyProfile(requireOrgId(req)));
  },
  async update(req: Request, res: Response) {
    requireOrgAdmin(req);
    res.json(await service.upsertCompanyProfile(requireOrgId(req), companyProfileSchema.parse(req.body)));
  },
};

export const jobsController = {
  async addNote(req: Request, res: Response) {
    const auth = requireAuthContext(req);
    const body = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body);
    res.status(201).json(
      await service.createNote(requireOrgId(req), auth.userId, { entityType: "job", entityId: req.params.id, body: body.body })
    );
  },
  async listNotes(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher", "technician"]);
    res.json(await service.listNotes(requireOrgId(req), "job", req.params.id));
  },
};

export const paymentsController = {
  async list(req: Request, res: Response) {
    requireRoles(req, ["owner", "dispatcher", "technician"]);
    res.json(await service.listPayments(requireOrgId(req), req.params.id));
  },
  async create(req: Request, res: Response) {
    const auth = requireRoles(req, ["owner", "dispatcher"]);
    res
      .status(201)
      .json(await service.createPayment(requireOrgId(req), req.params.id, paymentSchema.parse(req.body), auth.userId, auth.role));
  },
};
