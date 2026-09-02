import { Request, Response } from "express";
import { z } from "zod";
import { CrmService } from "../../modules/crm/service";
import { requireAuthContext, requireOrgAdmin, requireOrgId, requirePermissions, requireRoles } from "../auth/context";
import { activityService } from "../../modules/activity/service";

const service = new CrmService();

const customerSchema = z
  .object({
    name: z.string().trim().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    address: z.string().trim().optional().nullable(),
  })
  .strict();

const customerUpdateSchema = customerSchema.partial();

const serviceAddressSchema = z
  .object({
    label: z.string().trim().optional().nullable(),
    addressLine1: z.string().trim().min(1),
    addressLine2: z.string().trim().optional().nullable(),
    city: z.string().trim().min(1),
    state: z.string().trim().min(1),
    postalCode: z.string().trim().min(1),
    country: z.string().trim().min(1).default("US"),
    isPrimary: z.boolean().optional(),
  })
  .strict();

const serviceAddressUpdateSchema = serviceAddressSchema.partial();

const equipmentSchema = z
  .object({
    type: z.string().trim().min(1),
    manufacturer: z.string().trim().optional().nullable(),
    model: z.string().trim().optional().nullable(),
    serialNumber: z.string().trim().optional().nullable(),
    installedAt: z.coerce.date().optional().nullable(),
    notes: z.string().trim().optional().nullable(),
  })
  .strict();

const equipmentUpdateSchema = equipmentSchema.partial();

const serviceAgreementSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().trim().optional().nullable(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional().nullable(),
    recurrence: z.string().trim().optional().nullable(),
    status: z.string().trim().optional(),
  })
  .strict();

const noteSchema = z
  .object({
    entityType: z.enum(["customer", "job"]),
    entityId: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

const paymentSchema = z
  .object({
    amount: z.number().positive(),
    paidAt: z.coerce.date(),
    method: z.string().trim().min(1),
    reference: z.string().trim().optional().nullable(),
    notes: z.string().trim().optional().nullable(),
  })
  .strict();

const customerImportSchema = z
  .object({
    csvContent: z.string().min(1),
  })
  .strict();

const companyProfileSchema = z
  .object({
    companyName: z.string().trim().min(1),
    phone: z.string().trim().optional().nullable(),
    email: z.string().email().optional().nullable(),
    website: z.string().url().optional().nullable(),
    addressLine1: z.string().trim().optional().nullable(),
    addressLine2: z.string().trim().optional().nullable(),
    city: z.string().trim().optional().nullable(),
    state: z.string().trim().optional().nullable(),
    postalCode: z.string().trim().optional().nullable(),
    country: z.string().trim().optional().nullable(),
  })
  .strict();

export const crmCustomersController = {
  async list(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher", "technician"]);
    res.json(await service.listCustomers(requireOrgId(req)));
  },
  async create(req: Request, res: Response) {
    const auth = requireRoles(req, ["owner", "admin", "dispatcher"]);
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
    requireRoles(req, ["owner", "admin", "dispatcher", "technician"]);
    res.json(await service.getCustomer(requireOrgId(req), req.params.id));
  },
  async update(req: Request, res: Response) {
    const auth = requireRoles(req, ["owner", "admin", "dispatcher"]);
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
    const auth = requireRoles(req, ["owner", "admin", "dispatcher"]);
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
    requireRoles(req, ["owner", "admin", "dispatcher"]);
    res.status(201).json(await service.addServiceAddress(requireOrgId(req), req.params.id, serviceAddressSchema.parse(req.body)));
  },
  async updateServiceAddress(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher"]);
    res.json(
      await service.updateServiceAddress(requireOrgId(req), req.params.id, req.params.addressId, serviceAddressUpdateSchema.parse(req.body))
    );
  },
  async removeServiceAddress(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher"]);
    await service.removeServiceAddress(requireOrgId(req), req.params.id, req.params.addressId);
    res.status(204).send();
  },
  async addEquipment(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher"]);
    res.status(201).json(await service.addEquipment(requireOrgId(req), req.params.id, equipmentSchema.parse(req.body)));
  },
  async updateEquipment(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher"]);
    res.json(await service.updateEquipment(requireOrgId(req), req.params.id, req.params.equipmentId, equipmentUpdateSchema.parse(req.body)));
  },
  async removeEquipment(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher"]);
    await service.removeEquipment(requireOrgId(req), req.params.id, req.params.equipmentId);
    res.status(204).send();
  },
  async listServiceAgreements(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher", "technician"]);
    res.json(await service.listServiceAgreements(requireOrgId(req), req.params.id));
  },
  async createServiceAgreement(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher"]);
    res.status(201).json(await service.createServiceAgreement(requireOrgId(req), req.params.id, serviceAgreementSchema.parse(req.body)));
  },
};

export const crmNotesController = {
  async list(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher", "technician"]);
    res.json(await service.listNotes(requireOrgId(req), req.query.entityType as "customer" | "job", String(req.query.entityId ?? "")));
  },
  async create(req: Request, res: Response) {
    const auth = requireRoles(req, ["owner", "admin", "dispatcher", "technician"]);
    res.status(201).json(await service.createNote(requireOrgId(req), auth.userId, noteSchema.parse(req.body)));
  },
};

export const crmImportController = {
  async importCustomers(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher"]);
    res.status(201).json(await service.importCustomers(requireOrgId(req), customerImportSchema.parse(req.body).csvContent));
  },
};

export const companyController = {
  async get(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher", "technician"]);
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
    requireRoles(req, ["owner", "admin", "dispatcher", "technician"]);
    res.json(await service.listNotes(requireOrgId(req), "job", req.params.id));
  },
};

export const paymentsController = {
  async list(req: Request, res: Response) {
    requireRoles(req, ["owner", "admin", "dispatcher", "technician"]);
    res.json(await service.listPayments(requireOrgId(req), req.params.id));
  },
  async create(req: Request, res: Response) {
    const auth = requirePermissions(req, ["billing.write"]);
    res
      .status(201)
      .json(await service.createPayment(requireOrgId(req), req.params.id, paymentSchema.parse(req.body), auth.userId, auth.role));
  },
};
