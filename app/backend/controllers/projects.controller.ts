import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db/client";
import { ApiError } from "../middleware/errorHandler";
import { requireAuthContext, requireOrgId, requirePermissions } from "../requestContext";
import { toEstimateDTO } from "../../modules/estimate-engine/service";
import { calculateInvoiceFinancials, toInvoicePaymentDTO } from "../../modules/invoices/presentation";
import { ActivityTimelineService } from "../../modules/intelligence/service";
import { buildProjectIntake } from "../../modules/project-intake/service";
import { canTransitionProjectStatus, normalizeProjectStatus, projectStatuses, siteVisitVoiceNoteStatuses } from "../../domain";

// Lightweight CRUD for customers/projects. Not one of the 8 specified core
// modules — this is plumbing required so the Estimate Engine has a projectId
// to attach to, since estimates.project_id is not-null in the schema.

const activityService = new ActivityTimelineService();

function toProjectDTO<T extends { status: string }>(project: T): T & { status: ReturnType<typeof normalizeProjectStatus> } {
  return {
    ...project,
    status: normalizeProjectStatus(project.status),
  };
}

const customerSchema = z.object({
  orgId: z.string().uuid().optional(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  billingAddress: z.string().optional(),
  notes: z.string().optional(),
});

const customerUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  billingAddress: z.string().optional(),
  notes: z.string().optional(),
});

const projectSchema = z.object({
  orgId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  name: z.string().min(1),
  jobType: z.string().optional(),
  siteAddress: z.string().optional(),
  simpleScope: z.string().optional(),
  regionId: z.string().uuid().optional(),
});

const projectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  jobType: z.string().optional(),
  siteAddress: z.string().optional(),
  simpleScope: z.string().optional(),
  regionId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

const siteVisitDetailsSchema = z.object({
  arrivalAt: z.string().datetime().optional(),
  departureAt: z.string().datetime().optional(),
  gps: z.string().trim().optional(),
  customerNotes: z.string().trim().optional(),
  materialsNeeded: z.array(z.string().trim().min(1)).optional(),
  safetyNotes: z.array(z.string().trim().min(1)).optional(),
  punchList: z.array(z.string().trim().min(1)).optional(),
  voiceNoteStatus: z.enum(siteVisitVoiceNoteStatuses).optional(),
});

const siteVisitSchema = z.object({
  jobId: z.string().uuid().optional(),
  transcript: z.string().optional(),
  notes: z.string().optional(),
  detailsJson: siteVisitDetailsSchema.optional(),
  measurementsJson: z.record(z.string(), z.unknown()).optional(),
});

const siteVisitUpdateSchema = siteVisitSchema;

const projectFileSchema = z.object({
  fileType: z.string().min(1),
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  storagePath: z.string().optional(),
});

// Combines whatever scope-bearing text exists for a project/site-visit into
// one string for buildProjectIntake()'s keyword classifier — simpleScope is
// the primary signal, but notes/transcript often contain trade-identifying
// detail simpleScope doesn't (e.g. "tear off and reroof" mentioned on-site).
function buildIntakeScopeText(...parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(". ");
}

// The web app's SiteVisit.missingInfoJson contract predates buildProjectIntake()'s
// richer { field, reason, importance } shape and still expects plain strings
// (see web/src/lib/api.ts). Flatten to the human-readable reason here so the
// existing UI keeps working; the full structured breakdown is still available
// via intakeResultJson.missingInformation for any consumer that wants it.
function toMissingInfoStrings(missingInformation: ReturnType<typeof buildProjectIntake>["missingInformation"]): string[] {
  return missingInformation.map((item) => item.reason);
}

export const customersController = {
  async list(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    res.json(
      await prisma.customer.findMany({ where: { orgId: requireOrgId(req), deletedAt: null }, orderBy: { name: "asc" } })
    );
  },
  async create(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const auth = requireAuthContext(req);
    const customer = await prisma.customer.create({ data: { ...customerSchema.parse(req.body), orgId: requireOrgId(req) } });
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
    requirePermissions(req, ["crm.read"]);
    const row = await prisma.customer.findFirst({
      where: { id: req.params.id, orgId: requireOrgId(req), deletedAt: null },
      include: { projects: true },
    });
    if (!row) throw new ApiError(404, `Customer ${req.params.id} not found`);
    res.json(row);
  },
  async update(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const body = customerUpdateSchema.parse(req.body);
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, orgId: requireOrgId(req), deletedAt: null } });
    if (!existing) throw new ApiError(404, `Customer ${req.params.id} not found`);
    res.json(await prisma.customer.update({ where: { id: req.params.id }, data: body }));
  },
  async remove(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, orgId: requireOrgId(req), deletedAt: null } });
    if (!existing) throw new ApiError(404, `Customer ${req.params.id} not found`);
    await prisma.customer.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.status(204).send();
  },
};

export const projectsController = {
  async list(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    const rows = await prisma.project.findMany({ where: { orgId: requireOrgId(req) }, orderBy: { createdAt: "desc" } });
    res.json(rows.map((row) => toProjectDTO(row)));
  },
  async create(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const auth = requireAuthContext(req);
    const project = await prisma.project.create({ data: { ...projectSchema.parse(req.body), orgId: requireOrgId(req) } });
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "project",
      entityId: project.id,
      eventType: "project.created",
      title: `Project created: ${project.name}`,
      actorUserId: auth.userId,
    });
    res.status(201).json(toProjectDTO(project));
  },
  async getById(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    const row = await prisma.project.findFirst({
      where: { id: req.params.id, orgId: requireOrgId(req) },
      include: {
        customer: true,
        estimates: { orderBy: { version: "desc" } },
        siteVisits: { orderBy: { createdAt: "desc" } },
        projectFiles: { orderBy: { createdAt: "desc" } },
        proposals: { orderBy: { createdAt: "desc" }, include: { deliveries: { orderBy: { occurredAt: "desc" } } } },
        invoices: {
          orderBy: { createdAt: "desc" },
          include: {
            lineItems: { orderBy: { sortOrder: "asc" } },
            payments: { where: { status: "recorded" }, orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }] },
            deliveries: { orderBy: { occurredAt: "desc" } },
          },
        },
        contracts: { orderBy: { createdAt: "desc" }, include: { events: { orderBy: { occurredAt: "desc" } } } },
        changeOrders: { orderBy: { createdAt: "desc" }, include: { lineItems: { orderBy: { sortOrder: "asc" } } } },
        tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }] },
        jobs: { orderBy: [{ archivedAt: "asc" }, { scheduledStart: "asc" }, { createdAt: "desc" }] },
      },
    });
    if (!row) throw new ApiError(404, `Project ${req.params.id} not found`);
    // estimates carry Decimal fields, which Prisma/JSON serialize as strings —
    // normalize through the same DTO mapper the estimate-engine module uses so
    // every consumer of "an estimate" sees the same numeric shape.
    res.json({
      ...toProjectDTO(row),
      title: row.name,
      projectAddress: row.siteAddress,
      estimates: row.estimates.map(toEstimateDTO),
      siteVisits: (row.siteVisits ?? []).map((visit) => ({ ...visit, confidenceScore: toNullableNumber(visit.confidenceScore) })),
      changeOrders: (row.changeOrders ?? []).map((changeOrder) => ({
        ...changeOrder,
        amount: toNullableNumber(changeOrder.amount) ?? 0,
        lineItems: (changeOrder.lineItems ?? []).map((lineItem) => ({
          ...lineItem,
          quantity: toNullableNumber(lineItem.quantity) ?? 0,
          unitCost: toNullableNumber(lineItem.unitCost) ?? 0,
          lineCost: toNullableNumber(lineItem.lineCost) ?? 0,
        })),
      })),
      invoices: (row.invoices ?? []).map((invoice) => ({
        ...invoice,
        amount: toNullableNumber(invoice.amount) ?? 0,
        subtotal: toNullableNumber(invoice.subtotal) ?? toNullableNumber(invoice.amount) ?? 0,
        taxPct: toNullableNumber(invoice.taxPct) ?? 0,
        taxAmount: toNullableNumber(invoice.taxAmount) ?? 0,
        ...calculateInvoiceFinancials(invoice.amount, invoice.status, invoice.payments ?? []),
        payments: (invoice.payments ?? []).map(toInvoicePaymentDTO),
        percentComplete: toNullableNumber(invoice.percentComplete),
        lineItems: (invoice.lineItems ?? []).map((lineItem) => ({
          ...lineItem,
          quantity: toNullableNumber(lineItem.quantity) ?? 0,
          unitPrice: toNullableNumber(lineItem.unitPrice) ?? 0,
          lineTotal: toNullableNumber(lineItem.lineTotal) ?? 0,
        })),
      })),
      jobs: (row.jobs ?? []).map((job) => ({
        id: job.id,
        jobNumber: job.jobNumber,
        title: job.title,
        jobType: job.jobType,
        status: job.status,
        priority: job.priority,
        scheduledStart: job.scheduledStart?.toISOString() ?? null,
        scheduledEnd: job.scheduledEnd?.toISOString() ?? null,
        archivedAt: job.archivedAt?.toISOString() ?? null,
      })),
    });
  },
  async update(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const body = projectUpdateSchema.parse(req.body);
    const existing = await prisma.project.findFirst({ where: { id: req.params.id, orgId: requireOrgId(req) } });
    if (!existing) throw new ApiError(404, `Project ${req.params.id} not found`);
    res.json(await prisma.project.update({ where: { id: req.params.id }, data: body }));
  },
  async updateStatus(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const auth = requireAuthContext(req);
    const schema = z.object({
      status: z.enum(projectStatuses),
    });
    const { status } = schema.parse(req.body);
    const existing = await prisma.project.findFirst({ where: { id: req.params.id, orgId: requireOrgId(req) } });
    if (!existing) throw new ApiError(404, `Project ${req.params.id} not found`);
    const currentStatus = normalizeProjectStatus(existing.status);
    if (!canTransitionProjectStatus(currentStatus, status)) {
      throw new ApiError(409, `Project ${req.params.id} cannot transition from ${currentStatus} to ${status}`);
    }
    const project = await prisma.project.update({ where: { id: req.params.id }, data: { status } });
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "project",
      entityId: project.id,
      eventType: "project.status_changed",
      title: `Project status changed to ${status}`,
      actorUserId: auth.userId,
      metadata: { previousStatus: existing.status, nextStatus: status },
    });
    res.json(toProjectDTO(project));
  },
};

export const siteVisitsController = {
  async listByProject(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    const project = await prisma.project.findFirst({ where: { id: req.params.id, orgId: requireOrgId(req) } });
    if (!project) throw new ApiError(404, `Project ${req.params.id} not found`);

    const visits = await prisma.siteVisit.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(visits.map((visit) => ({ ...visit, confidenceScore: toNullableNumber(visit.confidenceScore) })));
  },

  async create(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const auth = requireAuthContext(req);
    const project = await prisma.project.findFirst({ where: { id: req.params.id, orgId: requireOrgId(req) } });
    if (!project) throw new ApiError(404, `Project ${req.params.id} not found`);

    const input = siteVisitSchema.parse(req.body);
    if (input.jobId) {
      const job = await prisma.job.findFirst({ where: { id: input.jobId, orgId: requireOrgId(req), projectId: project.id, archivedAt: null } });
      if (!job) throw new ApiError(404, `Job ${input.jobId} not found`);
    }
    const intakeResult = buildProjectIntake(buildIntakeScopeText(project.simpleScope, input.notes, input.transcript));

    const visit = await prisma.siteVisit.create({
      data: {
        projectId: project.id,
        jobId: input.jobId,
        transcript: input.transcript,
        notes: input.notes,
        detailsJson: toInputJson(input.detailsJson),
        measurementsJson: toInputJson(input.measurementsJson),
        aiQuestionsJson: toInputJson(intakeResult.followUpQuestions),
        missingInfoJson: toInputJson(toMissingInfoStrings(intakeResult.missingInformation)),
        confidenceScore: intakeResult.confidenceScore.score,
        intakeResultJson: toInputJson(intakeResult),
      },
    });

    if (!project.jobType && intakeResult.trade) {
      await prisma.project.update({ where: { id: project.id }, data: { jobType: intakeResult.trade, status: "estimating" } });
    } else if (normalizeProjectStatus(project.status) === "lead") {
      await prisma.project.update({ where: { id: project.id }, data: { status: "estimating" } });
    }

    await activityService.record({
      orgId: requireOrgId(req),
      entityType: "project",
      entityId: project.id,
      eventType: "site_visit.created",
      title: "Site visit captured",
      description: input.notes ?? input.transcript ?? undefined,
      actorUserId: auth.userId,
      metadata: { siteVisitId: visit.id, confidenceScore: toNullableNumber(visit.confidenceScore) },
    });

    res.status(201).json({ ...visit, confidenceScore: toNullableNumber(visit.confidenceScore) });
  },

  async update(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const existing = await prisma.siteVisit.findFirst({
      where: { id: req.params.siteVisitId, project: { orgId: requireOrgId(req) } },
      include: { project: true },
    });
    if (!existing) throw new ApiError(404, `Site visit ${req.params.siteVisitId} not found`);

    const input = siteVisitUpdateSchema.parse(req.body);
    if (input.jobId) {
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, orgId: requireOrgId(req), projectId: existing.projectId, archivedAt: null },
      });
      if (!job) throw new ApiError(404, `Job ${input.jobId} not found`);
    }
    const mergedMeasurements = (input.measurementsJson ?? asRecord(existing.measurementsJson) ?? undefined) as Record<string, unknown> | undefined;
    const mergedNotes = input.notes ?? existing.notes;
    const mergedTranscript = input.transcript ?? existing.transcript;
    const intakeResult = buildProjectIntake(buildIntakeScopeText(existing.project.simpleScope, mergedNotes, mergedTranscript));

    const updated = await prisma.siteVisit.update({
      where: { id: existing.id },
      data: {
        jobId: input.jobId ?? existing.jobId,
        transcript: mergedTranscript,
        notes: mergedNotes,
        detailsJson: toInputJson(input.detailsJson ?? asRecord(existing.detailsJson) ?? undefined),
        measurementsJson: toInputJson(mergedMeasurements),
        aiQuestionsJson: toInputJson(intakeResult.followUpQuestions),
        missingInfoJson: toInputJson(toMissingInfoStrings(intakeResult.missingInformation)),
        confidenceScore: intakeResult.confidenceScore.score,
        intakeResultJson: toInputJson(intakeResult),
      },
    });

    res.json({ ...updated, confidenceScore: toNullableNumber(updated.confidenceScore) });
  },
};

export const projectFilesController = {
  async listByProject(req: Request, res: Response) {
    requirePermissions(req, ["crm.read"]);
    const project = await prisma.project.findFirst({ where: { id: req.params.id, orgId: requireOrgId(req) } });
    if (!project) throw new ApiError(404, `Project ${req.params.id} not found`);

    res.json(await prisma.projectFile.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "desc" } }));
  },

  async create(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const auth = requireAuthContext(req);
    const project = await prisma.project.findFirst({ where: { id: req.params.id, orgId: requireOrgId(req) } });
    if (!project) throw new ApiError(404, `Project ${req.params.id} not found`);

    const file = await prisma.projectFile.create({
      data: {
        projectId: project.id,
        ...projectFileSchema.parse(req.body),
      },
    });
    await activityService.record({
      orgId: requireOrgId(req),
      entityType: file.fileType.startsWith("image") ? "photo" : "document",
      entityId: file.id,
      eventType: "project_file.uploaded",
      title: `File uploaded: ${file.fileName}`,
      actorUserId: auth.userId,
      metadata: { projectId: project.id, storagePath: file.storagePath, fileType: file.fileType },
    });
    res.status(201).json(file);
  },

  async remove(req: Request, res: Response) {
    requirePermissions(req, ["crm.write"]);
    const project = await prisma.project.findFirst({ where: { id: req.params.id, orgId: requireOrgId(req) } });
    if (!project) throw new ApiError(404, `Project ${req.params.id} not found`);

    const file = await prisma.projectFile.findFirst({
      where: {
        id: req.params.fileId,
        projectId: project.id,
      },
    });
    if (!file) throw new ApiError(404, `Project file ${req.params.fileId} not found`);

    await prisma.projectFile.delete({ where: { id: file.id } });
    res.status(204).send();
  },
};

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && value && "toString" in value) return Number(String(value));
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toInputJson(value: unknown) {
  return value as Prisma.InputJsonValue | undefined;
}
