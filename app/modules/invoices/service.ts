import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { ActivityTimelineService } from "../intelligence/service";
import { hasPermission, legacyInvoiceStatusMap, normalizeInvoiceStatus } from "../../domain/contracts";
import { renderInvoicePdf } from "./pdf";
import { clampQueueLimit, decodeUpdatedAtCursor, encodeUpdatedAtCursor, QueuePage } from "../shared/pagination";
import { expandCanonicalStatusFilter } from "../shared/statusFilter";
import {
  CreateInvoiceInput,
  InvoiceDTO,
  InvoiceDeliveryDTO,
  InvoiceDocument,
  InvoiceLineItemDTO,
  InvoiceLineItemInput,
  InvoiceQueueFilters,
  InvoiceQueueItemDTO,
} from "./types";

export class InvoicesService {
  private readonly activityService = new ActivityTimelineService();

  async create(input: CreateInvoiceInput): Promise<InvoiceDTO> {
    assertInvoiceWriteAccess(input.actorRole);
    const project = await prisma.project.findFirst({ where: { id: input.projectId, orgId: input.orgId } });
    if (!project) throw new ApiError(404, `Project ${input.projectId} not found`);

    const type = input.type ?? "full";
    if (type === "progress" && (input.percentComplete == null || input.percentComplete <= 0 || input.percentComplete > 100)) {
      throw new ApiError(400, "percentComplete (0-100] is required for progress invoices");
    }

    const lineItems = await this.resolveLineItems(input, type);
    if (lineItems.length === 0) throw new ApiError(400, "Invoice requires lineItems or an estimateId");

    if (input.proposalId) {
      const proposal = await prisma.proposal.findFirst({ where: { id: input.proposalId, projectId: input.projectId } });
      if (!proposal) throw new ApiError(404, `Proposal ${input.proposalId} not found`);
    }

    const amount = lineItems.reduce((sum, li) => sum + li.quantity * li.unitCost, 0);
    const nextNumber = (await prisma.invoice.aggregate({ where: { projectId: input.projectId }, _max: { invoiceNumber: true } }))._max
      .invoiceNumber ?? 0;

    const row = await prisma.invoice.create({
      data: {
        projectId: input.projectId,
        estimateId: input.estimateId,
        proposalId: input.proposalId,
        invoiceNumber: nextNumber + 1,
        type,
        percentComplete: type === "progress" ? input.percentComplete : undefined,
        amount,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        lineItems: {
          create: lineItems.map((li, index) => ({
            description: li.description,
            quantity: li.quantity,
            unitOfMeasure: li.unitOfMeasure,
            unitCost: li.unitCost,
            lineCost: li.quantity * li.unitCost,
            sortOrder: index,
          })),
        },
      },
    });
    await this.recordDeliveryEvent({
      orgId: input.orgId,
      invoiceId: row.id,
      projectId: row.projectId,
      actorUserId: input.actorUserId,
      eventType: "invoice.created",
      metadata: {
        invoiceNumber: row.invoiceNumber,
        type: row.type,
        amount,
      },
    });
    return this.getById(row.id, input.orgId);
  }

  async listByProject(projectId: string, orgId?: string): Promise<InvoiceDTO[]> {
    const rows = await prisma.invoice.findMany({
      where: { projectId, project: orgId ? { orgId } : undefined },
      include: { deliveries: { orderBy: { occurredAt: "desc" } } },
      orderBy: { invoiceNumber: "asc" },
    });
    return rows.map(toDTO);
  }

  /**
   * Organization-wide, newest-activity-first invoice queue. `paidAmount`/
   * `balanceDue` have no stored column — Invoice only carries its own
   * `amount`; payments are recorded separately on `Payment` rows read
   * elsewhere (e.g. the Revenue-This-Week ledger) — so the `unpaid`/
   * `overdue`/`partiallyPaid` predicates need the paid-amount aggregate
   * evaluated in SQL before pagination, not filtered in memory after a
   * plain Prisma fetch. `$queryRaw` runs through the same `prisma` proxy
   * every other service call uses, so it still executes inside the active
   * request-scoped RLS transaction/session when one is active.
   */
  async listOrganizationQueue(filters: InvoiceQueueFilters): Promise<QueuePage<InvoiceQueueItemDTO>> {
    const limit = clampQueueLimit(filters.limit);
    const voidedRawStatuses = expandCanonicalStatusFilter(["voided"], legacyInvoiceStatusMap);

    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (filters.statuses?.length) {
      const rawStatuses = expandCanonicalStatusFilter(filters.statuses, legacyInvoiceStatusMap);
      conditions.push(Prisma.sql`status IN (${Prisma.join(rawStatuses)})`);
    }
    if (filters.sent === true) conditions.push(Prisma.sql`sent_at IS NOT NULL`);
    if (filters.sent === false) conditions.push(Prisma.sql`sent_at IS NULL`);
    if (filters.overdue === true) {
      conditions.push(Prisma.sql`due_date IS NOT NULL AND due_date < now() AND balance_due > 0 AND status NOT IN (${Prisma.join(followUpExcludedRawStatuses(voidedRawStatuses))})`);
    }
    if (filters.partiallyPaid === true) {
      conditions.push(Prisma.sql`paid_amount > 0 AND balance_due > 0 AND status NOT IN (${Prisma.join(followUpExcludedRawStatuses(voidedRawStatuses))})`);
    }
    if (filters.unpaid === true) {
      conditions.push(Prisma.sql`balance_due > 0 AND status NOT IN (${Prisma.join(followUpExcludedRawStatuses(voidedRawStatuses))})`);
    }
    if (filters.updatedAfter) conditions.push(Prisma.sql`updated_at >= ${new Date(filters.updatedAfter)}`);
    if (filters.updatedBefore) conditions.push(Prisma.sql`updated_at <= ${new Date(filters.updatedBefore)}`);

    // filterWhere excludes the cursor predicate so the count query reflects
    // the exact total for the filter, not just rows remaining after the
    // cursor position — pageWhere adds the cursor on top of it for the rows
    // query only.
    const filterWhere = Prisma.join(conditions, " AND ");
    let pageWhere = filterWhere;
    if (filters.cursor) {
      const cursor = decodeUpdatedAtCursor(filters.cursor);
      pageWhere = Prisma.join(
        [...conditions, Prisma.sql`(updated_at < ${cursor.updatedAt} OR (updated_at = ${cursor.updatedAt} AND id < ${cursor.id}::uuid))`],
        " AND "
      );
    }

    const cte = Prisma.sql`
      with queue as (
        select
          i.id,
          i.project_id,
          i.invoice_number,
          i.status,
          i.amount,
          i.due_date,
          i.sent_at,
          i.updated_at,
          p.name as project_name,
          c.name as customer_name,
          coalesce(pt.paid_amount, 0) as paid_amount,
          (i.amount - coalesce(pt.paid_amount, 0)) as balance_due
        from invoices i
        join projects p on p.id = i.project_id
        left join customers c on c.id = p.customer_id
        left join (
          select invoice_id, sum(amount) as paid_amount
          from payments
          where org_id = ${filters.orgId}::uuid and status = 'recorded'
          group by invoice_id
        ) pt on pt.invoice_id = i.id
        where p.org_id = ${filters.orgId}::uuid
      )
    `;

    const [rows, totalRows] = await Promise.all([
      prisma.$queryRaw<InvoiceQueueRawRow[]>(Prisma.sql`
        ${cte}
        select * from queue
        where ${pageWhere}
        order by updated_at desc, id desc
        limit ${limit}
      `),
      prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        ${cte}
        select count(*)::bigint as count from queue
        where ${filterWhere}
      `),
    ]);

    const items = rows.map(toInvoiceQueueItemDTO);
    const last = rows[rows.length - 1];
    const nextCursor = rows.length === limit && last ? encodeUpdatedAtCursor({ updatedAt: last.updated_at, id: last.id }) : null;

    return { items, total: Number(totalRows[0]?.count ?? 0), nextCursor };
  }

  async getById(id: string, orgId?: string): Promise<InvoiceDTO & { lineItems: InvoiceLineItemDTO[] }> {
    const row = await prisma.invoice.findFirst({
      where: { id, project: orgId ? { orgId } : undefined },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        deliveries: { orderBy: { occurredAt: "desc" } },
      },
    });
    if (!row) throw new ApiError(404, `Invoice ${id} not found`);
    return { ...toDTO(row), lineItems: row.lineItems.map(toLineItemDTO) };
  }

  async getPdf(id: string, orgId?: string): Promise<InvoiceDocument> {
    const row = await prisma.invoice.findFirst({
      where: { id, project: orgId ? { orgId } : undefined },
      include: { lineItems: { orderBy: { sortOrder: "asc" } }, project: { include: { customer: true } } },
    });
    if (!row) throw new ApiError(404, `Invoice ${id} not found`);

    const buffer = await renderInvoicePdf(
      {
        invoiceNumber: row.invoiceNumber,
        type: row.type,
        status: row.status,
        amount: Number(row.amount),
        dueDate: row.dueDate,
        createdAt: row.createdAt,
        percentComplete: row.percentComplete ? Number(row.percentComplete) : null,
        project: row.project,
        lineItems: row.lineItems.map((li) => ({
          description: li.description,
          quantity: Number(li.quantity),
          unitOfMeasure: li.unitOfMeasure,
          unitCost: Number(li.unitCost),
          lineCost: Number(li.lineCost),
        })),
      },
      { companyName: "Your Company Name" }
    );

    return {
      buffer,
      filename: `invoice-${row.project.name.replace(/\s+/g, "-").toLowerCase()}-${row.invoiceNumber}.pdf`,
      contentType: "application/pdf",
    };
  }

  async send(id: string, orgId?: string, actorUserId?: string, actorRole?: string): Promise<InvoiceDTO> {
    assertInvoiceWriteAccess(actorRole);
    const row = await this.findOrThrow(id, orgId);
    if (row.status !== "draft") throw new ApiError(409, `Invoice ${id} has already been sent`);
    const updated = await prisma.invoice.update({ where: { id }, data: { status: "sent", sentAt: new Date() } });
    await this.recordDeliveryEvent({
      orgId: orgId ?? row.project.orgId ?? undefined,
      invoiceId: row.id,
      projectId: row.projectId,
      actorUserId,
      eventType: "invoice.sent",
      recipientEmail: row.project.customer?.email ?? null,
      metadata: { previousStatus: row.status, newStatus: "sent", invoiceNumber: row.invoiceNumber },
    });
    return this.getById(updated.id, orgId);
  }

  async markPaid(id: string, orgId?: string, actorUserId?: string, actorRole?: string): Promise<InvoiceDTO> {
    assertInvoiceWriteAccess(actorRole);
    const row = await this.findOrThrow(id, orgId);
    if (!["sent", "overdue"].includes(row.status)) throw new ApiError(409, `Invoice ${id} cannot be marked paid from status ${row.status}`);
    const updated = await prisma.invoice.update({ where: { id }, data: { status: "paid", paidAt: new Date() } });
    await this.recordDeliveryEvent({
      orgId: orgId ?? row.project.orgId ?? undefined,
      invoiceId: row.id,
      projectId: row.projectId,
      actorUserId,
      eventType: "invoice.paid",
      recipientEmail: row.project.customer?.email ?? null,
      metadata: { previousStatus: row.status, newStatus: "paid", invoiceNumber: row.invoiceNumber },
    });
    return this.getById(updated.id, orgId);
  }

  async recordPaidEvent(input: {
    orgId: string;
    invoiceId: string;
    projectId: string;
    actorUserId?: string;
    recipientEmail?: string | null;
    previousStatus: string;
    invoiceNumber: number;
    paymentId: string;
    recordedPaymentTotal: string;
  }): Promise<void> {
    await this.recordDeliveryEvent({
      orgId: input.orgId,
      invoiceId: input.invoiceId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      eventType: "invoice.paid",
      recipientEmail: input.recipientEmail,
      metadata: {
        previousStatus: input.previousStatus,
        newStatus: "paid",
        invoiceNumber: input.invoiceNumber,
        paymentId: input.paymentId,
        reconciliation: "recorded_payment",
        recordedPaymentTotal: input.recordedPaymentTotal,
      },
    });
  }

  async void(id: string, orgId?: string, actorUserId?: string, actorRole?: string): Promise<InvoiceDTO> {
    assertInvoiceWriteAccess(actorRole);
    const row = await this.findOrThrow(id, orgId);
    if (row.status === "paid") throw new ApiError(409, `Invoice ${id} has already been paid and cannot be voided`);
    const updated = await prisma.invoice.update({ where: { id }, data: { status: "void" } });
    await this.recordDeliveryEvent({
      orgId: orgId ?? row.project.orgId ?? undefined,
      invoiceId: row.id,
      projectId: row.projectId,
      actorUserId,
      eventType: "invoice.voided",
      recipientEmail: row.project.customer?.email ?? null,
      metadata: { previousStatus: row.status, newStatus: "voided", invoiceNumber: row.invoiceNumber },
    });
    return this.getById(updated.id, orgId);
  }

  private async findOrThrow(id: string, orgId?: string) {
    const row = await prisma.invoice.findFirst({
      where: { id, project: orgId ? { orgId } : undefined },
      include: {
        deliveries: { orderBy: { occurredAt: "desc" } },
        project: {
          include: {
            customer: {
              select: { email: true },
            },
          },
        },
      },
    });
    if (!row) throw new ApiError(404, `Invoice ${id} not found`);
    return row;
  }

  private async recordDeliveryEvent(input: {
    orgId?: string;
    invoiceId: string;
    projectId: string;
    actorUserId?: string;
    eventType: string;
    recipientEmail?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!input.orgId) {
      throw new ApiError(500, `Invoice ${input.invoiceId} is missing organization scope`);
    }
    await prisma.invoiceDelivery.create({
      data: {
        orgId: input.orgId,
        invoiceId: input.invoiceId,
        eventType: input.eventType,
        deliveryChannel: "app",
        recipientEmail: input.recipientEmail,
        actorUserId: input.actorUserId,
        metadataJson: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await this.activityService.record({
      orgId: input.orgId,
      entityType: "project",
      entityId: input.projectId,
      eventType: input.eventType,
      title: input.eventType.replace("invoice.", "Invoice ").replaceAll("_", " "),
      actorUserId: input.actorUserId,
      metadata: {
        invoiceId: input.invoiceId,
        recipientEmail: input.recipientEmail ?? null,
        ...(input.metadata ?? {}),
      },
    });
  }

  private async resolveLineItems(input: CreateInvoiceInput, type: string): Promise<InvoiceLineItemInput[]> {
    if (input.lineItems && input.lineItems.length > 0) return input.lineItems;
    if (!input.estimateId) return [];

    const estimate = await prisma.estimate.findFirst({
      where: { id: input.estimateId, orgId: input.orgId, projectId: input.projectId },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    if (!estimate) throw new ApiError(404, `Estimate ${input.estimateId} not found`);

    const scale = type === "progress" ? (input.percentComplete ?? 0) / 100 : 1;
    return estimate.lineItems.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity) * scale,
      unitOfMeasure: li.unitOfMeasure,
      unitCost: Number(li.unitCost),
    }));
  }
}

interface InvoiceQueueRawRow {
  id: string;
  project_id: string;
  invoice_number: number;
  status: string;
  amount: unknown;
  due_date: Date | null;
  updated_at: Date;
  project_name: string;
  customer_name: string | null;
  paid_amount: unknown;
  balance_due: unknown;
}

function toInvoiceQueueItemDTO(row: InvoiceQueueRawRow): InvoiceQueueItemDTO {
  return {
    id: row.id,
    documentNumber: row.invoice_number,
    projectId: row.project_id,
    projectName: row.project_name,
    customerName: row.customer_name,
    status: normalizeInvoiceStatus(row.status),
    amount: Number(row.amount),
    paidAmount: Number(row.paid_amount),
    balanceDue: Number(row.balance_due),
    dueDate: row.due_date ? row.due_date.toISOString() : null,
    updatedAt: row.updated_at.toISOString(),
  };
}

function toDTO(row: {
  id: string;
  projectId: string;
  estimateId: string | null;
  proposalId: string | null;
  invoiceNumber: number;
  type: string;
  status: string;
  percentComplete: unknown;
  amount: unknown;
  dueDate: Date | null;
  sentAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  deliveries?: Array<{
    id: string;
    eventType: string;
    deliveryChannel: string;
    recipientEmail: string | null;
    actorUserId: string | null;
    metadataJson: Prisma.JsonValue | null;
    occurredAt: Date;
    createdAt: Date;
  }>;
}): InvoiceDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    estimateId: row.estimateId,
    proposalId: row.proposalId,
    invoiceNumber: row.invoiceNumber,
    type: row.type,
    status: normalizeInvoiceStatus(row.status),
    percentComplete: row.percentComplete != null ? Number(row.percentComplete) : null,
    amount: Number(row.amount),
    dueDate: row.dueDate,
    sentAt: row.sentAt,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    deliveries: (row.deliveries ?? []).map(toDeliveryDTO),
  };
}

function toLineItemDTO(row: {
  id: string;
  description: string;
  quantity: unknown;
  unitOfMeasure: string;
  unitCost: unknown;
  lineCost: unknown;
  sortOrder: number;
}): InvoiceLineItemDTO {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitOfMeasure: row.unitOfMeasure,
    unitCost: Number(row.unitCost),
    lineCost: Number(row.lineCost),
    sortOrder: row.sortOrder,
  };
}

function toDeliveryDTO(row: {
  id: string;
  eventType: string;
  deliveryChannel: string;
  recipientEmail: string | null;
  actorUserId: string | null;
  metadataJson: Prisma.JsonValue | null;
  occurredAt: Date;
  createdAt: Date;
}): InvoiceDeliveryDTO {
  return {
    id: row.id,
    eventType: row.eventType,
    deliveryChannel: row.deliveryChannel,
    recipientEmail: row.recipientEmail,
    actorUserId: row.actorUserId,
    metadata: asRecord(row.metadataJson),
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function assertInvoiceWriteAccess(role?: string) {
  if (!role || !hasPermission(role, "billing.write")) {
    throw new ApiError(403, "You do not have permission to manage invoices");
  }
}

function followUpExcludedRawStatuses(voidedRawStatuses: string[]): string[] {
  return [...new Set([...voidedRawStatuses, "paid"])];
}
