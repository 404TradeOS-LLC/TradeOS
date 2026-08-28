import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { ProposalGeneratorService } from "../proposal-generator/service";
import { ProposalDocument } from "../proposal-generator/types";
import { ProjectIntakeService } from "../project-intake/service";
import { ActivityTimelineService } from "../intelligence/service";
import { getDefaultAthenaEventService } from "../athena-events/service";
import { legacyProposalStatusMap, normalizeEstimateStatus, normalizeProposalStatus } from "../../domain";
import { clampQueueLimit, decodeUpdatedAtCursor, encodeUpdatedAtCursor, buildUpdatedAtRange, QueuePage } from "../shared/pagination";
import { expandCanonicalStatusFilter } from "../shared/statusFilter";
import { CreateProposalInput, ProposalDTO, ProposalDeliveryDTO, ProposalDraftPreviewDTO, ProposalQueueFilters, ProposalQueueItemDTO } from "./types";

interface PaymentScheduleEntry {
  label: string;
  amountPercent: number;
  notes?: string;
}

export class ProposalsService {
  private readonly proposalGenerator = new ProposalGeneratorService();
  private readonly projectIntake = new ProjectIntakeService();
  private readonly activityService = new ActivityTimelineService();

  async create(input: CreateProposalInput): Promise<ProposalDTO> {
    const row = input.estimateId
      ? await this.createFromEstimate(input)
      : await this.createFromProject(input);
    return toDTO(row);
  }

  async listByProject(projectId: string, orgId?: string): Promise<ProposalDTO[]> {
    const rows = await prisma.proposal.findMany({
      where: { projectId, project: orgId ? { orgId } : undefined },
      include: { deliveries: { orderBy: { occurredAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDTO);
  }

  /**
   * Organization-wide, newest-activity-first proposal queue. "Unsigned"
   * means no Contract row references this proposal yet (conversion is the
   * Contract's existence, independent of that contract's own signature
   * state). "Stale" is caller-defined via `staleBefore` against `sentAt` —
   * this domain has no canonical canceled/voided proposal status, so that
   * exclusion rule from the product spec has nothing to apply to today.
   */
  async listOrganizationQueue(filters: ProposalQueueFilters): Promise<QueuePage<ProposalQueueItemDTO>> {
    const limit = clampQueueLimit(filters.limit);
    const conditions: Prisma.ProposalWhereInput[] = [{ project: { orgId: filters.orgId } }];

    if (filters.statuses?.length) conditions.push({ status: { in: expandCanonicalStatusFilter(filters.statuses, legacyProposalStatusMap) } });
    if (filters.sent === true) conditions.push({ sentAt: { not: null } });
    if (filters.sent === false) conditions.push({ sentAt: null });
    if (filters.viewed === true) conditions.push({ viewedAt: { not: null } });
    if (filters.viewed === false) conditions.push({ viewedAt: null });
    if (filters.unsigned === true) conditions.push({ contracts: { none: {} } });
    if (filters.unsigned === false) conditions.push({ contracts: { some: {} } });
    if (filters.staleBefore) conditions.push({ sentAt: { lte: new Date(filters.staleBefore) } });

    const updatedAtRange = buildUpdatedAtRange(filters);
    if (updatedAtRange) conditions.push({ updatedAt: updatedAtRange });

    // filterWhere excludes the cursor predicate so count() reflects the
    // exact total for the filter, not just rows remaining after the cursor
    // position — pageWhere adds the cursor on top of it for findMany only.
    const filterWhere: Prisma.ProposalWhereInput = { AND: conditions };
    let pageWhere = filterWhere;
    if (filters.cursor) {
      const cursor = decodeUpdatedAtCursor(filters.cursor);
      pageWhere = {
        AND: [
          ...conditions,
          { OR: [{ updatedAt: { lt: cursor.updatedAt } }, { AND: [{ updatedAt: cursor.updatedAt }, { id: { lt: cursor.id } }] }] },
        ],
      };
    }

    const [total, rows] = await Promise.all([
      prisma.proposal.count({ where: filterWhere }),
      prisma.proposal.findMany({
        where: pageWhere,
        include: {
          project: { include: { customer: { select: { name: true } } } },
          contracts: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit,
      }),
    ]);

    const items = rows.map(toQueueItemDTO);
    const last = rows[rows.length - 1];
    const nextCursor = rows.length === limit && last ? encodeUpdatedAtCursor({ updatedAt: last.updatedAt, id: last.id }) : null;

    return { items, total, nextCursor };
  }

  async getById(id: string, orgId?: string): Promise<ProposalDTO> {
    const row = await this.findOrThrow(id, orgId);
    return toDTO(row);
  }

  async previewProjectDraft(projectId: string, orgId?: string, companyName?: string): Promise<ProposalDraftPreviewDTO> {
    const project = await this.getProjectDraftContext(projectId, orgId);
    const latestVisit = project.siteVisits[0];
    const draft = this.projectIntake.buildProposalDraft({
      companyName: companyName ?? project.organization?.name ?? "Your Company",
      customerName: project.customer?.name,
      projectName: project.name,
      simpleScope: project.simpleScope,
      jobType: project.jobType,
      projectAddress: project.siteAddress,
      notes: latestVisit?.notes,
      transcript: latestVisit?.transcript,
      measurements: asRecord(latestVisit?.measurementsJson),
    });

    return {
      companyName: companyName ?? project.organization?.name ?? "Your Company",
      normalizedJobType: draft.normalizedJobType,
      confidenceScore: latestVisit?.confidenceScore ? toNullableNumber(latestVisit.confidenceScore) : null,
      missingInfo: toStringArray(latestVisit?.missingInfoJson),
      aiQuestions: toStringArray(latestVisit?.aiQuestionsJson),
      scopeOfWork: draft.scopeOfWork,
      assumptions: draft.assumptions,
      exclusions: draft.exclusions,
      timeline: draft.timeline,
      priceLow: draft.priceLow,
      priceHigh: draft.priceHigh,
      paymentSchedule: draft.paymentSchedule,
    };
  }

  async update(id: string, input: Omit<CreateProposalInput, "estimateId" | "projectId">, orgId?: string): Promise<ProposalDTO> {
    const existing = await this.findOrThrow(id, orgId);
    const updated = await prisma.proposal.updateMany({
      where: {
        id,
        project: orgId ? { orgId } : undefined,
        status: { not: "accepted" },
        contracts: { none: {} },
      },
      data: {
        companyName: input.companyName,
        showLineItemDetail: input.showLineItemDetail,
        scopeOfWork: input.scopeOfWork,
        assumptions: input.assumptions,
        exclusions: input.exclusions,
        timeline: input.timeline,
        priceLow: input.priceLow,
        priceHigh: input.priceHigh,
        finalPrice: input.finalPrice,
        paymentScheduleJson:
          input.paymentScheduleJson === undefined
            ? undefined
            : (this.normalizePaymentSchedule(input.paymentScheduleJson, existing.paymentScheduleJson) as object | undefined),
        termsAndConditions: input.termsAndConditions,
      },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, `Proposal ${id} is immutable after acceptance or contract creation; use a change order or duplicate revision`);
    }
    return this.getById(id, orgId);
  }

  async getPdf(id: string, orgId?: string): Promise<ProposalDocument> {
    const row = await this.findOrThrow(id, orgId);
    if (!row.estimateId) {
      return this.proposalGenerator.generateProjectProposal({ proposalId: id, orgId });
    }
    return this.proposalGenerator.generateProposal({
      estimateId: row.estimateId,
      orgId,
      companyName: row.companyName ?? undefined,
      showLineItemDetail: row.showLineItemDetail,
      termsAndConditions: row.termsAndConditions ?? undefined,
      scopeOfWork: row.scopeOfWork ?? undefined,
      assumptions: row.assumptions ?? undefined,
      exclusions: row.exclusions ?? undefined,
      timeline: row.timeline ?? undefined,
      priceLow: row.priceLow != null ? Number(row.priceLow) : null,
      priceHigh: row.priceHigh != null ? Number(row.priceHigh) : null,
      finalPrice: row.finalPrice != null ? Number(row.finalPrice) : null,
      paymentScheduleJson: row.paymentScheduleJson,
    });
  }

  async send(id: string, orgId?: string, actorUserId?: string): Promise<ProposalDTO> {
    const row = await this.findOrThrow(id, orgId);
    if (row.status !== "draft") throw new ApiError(409, `Proposal ${id} has already been sent`);
    this.normalizePaymentSchedule(row.paymentScheduleJson);
    const updated = await prisma.proposal.update({ where: { id }, data: { status: "sent", sentAt: new Date() } });
    try {
      await getDefaultAthenaEventService().publish({
        orgId: orgId ?? row.project.orgId ?? "",
        type: "ProposalSent",
        version: "1.0.0",
        entity: { type: "proposal", id: row.id },
        actor: actorUserId ? { type: "user", id: actorUserId } : { type: "system", id: null },
        payload: { projectId: row.projectId, customerId: row.project.customer?.id ?? null },
        correlationId: randomUUID(),
        idempotencyKey: `proposal:${row.id}:sent:v1`,
      });
    } catch (error) {
      console.error("[athena-events] failed to publish ProposalSent event", error);
    }
    await this.recordDeliveryEvent({
      orgId: orgId ?? row.project.orgId ?? undefined,
      proposalId: row.id,
      projectId: row.projectId,
      actorUserId,
      eventType: "proposal.sent",
      recipientEmail: row.project.customer?.email ?? null,
      metadata: { previousStatus: row.status, newStatus: "sent" },
    });
    await prisma.project.update({ where: { id: row.projectId }, data: { status: "estimating" } });
    return this.getById(updated.id, orgId);
  }

  async markViewed(id: string, orgId?: string, actorUserId?: string): Promise<ProposalDTO> {
    const row = await this.findOrThrow(id, orgId);
    const currentStatus = normalizeProposalStatus(row.status);
    if (currentStatus === "draft") throw new ApiError(409, `Proposal ${id} has not been sent yet`);
    if (currentStatus === "viewed" || currentStatus === "accepted" || currentStatus === "declined") return toDTO(row);
    const updated = await prisma.proposal.updateMany({
      where: { id, status: "sent", project: orgId ? { orgId } : undefined },
      data: { status: "viewed", viewedAt: new Date() },
    });
    if (updated.count !== 1) {
      const latest = await this.findOrThrow(id, orgId);
      const latestStatus = normalizeProposalStatus(latest.status);
      if (latestStatus === "viewed" || latestStatus === "accepted" || latestStatus === "declined") return toDTO(latest);
      throw new ApiError(409, `Proposal ${id} changed before it could be marked viewed`);
    }
    await this.recordDeliveryEvent({
      orgId: orgId ?? row.project.orgId ?? undefined,
      proposalId: row.id,
      projectId: row.projectId,
      actorUserId,
      eventType: "proposal.viewed",
      recipientEmail: row.project.customer?.email ?? null,
      metadata: { previousStatus: row.status, newStatus: "viewed" },
    });
    return this.getById(row.id, orgId);
  }

  async accept(id: string, orgId?: string, actorUserId?: string): Promise<ProposalDTO> {
    const row = await this.findOrThrow(id, orgId);
    const currentStatus = normalizeProposalStatus(row.status);
    if (!["sent", "viewed"].includes(currentStatus)) throw new ApiError(409, `Proposal ${id} cannot be accepted from status ${currentStatus}`);
    const updated = await prisma.proposal.updateMany({
      where: { id, status: currentStatus, project: orgId ? { orgId } : undefined },
      data: { status: "accepted", respondedAt: new Date() },
    });
    if (updated.count !== 1) throw new ApiError(409, `Proposal ${id} changed before it could be accepted`);
    await this.recordDeliveryEvent({
      orgId: orgId ?? row.project.orgId ?? undefined,
      proposalId: row.id,
      projectId: row.projectId,
      actorUserId,
      eventType: "proposal.accepted",
      recipientEmail: row.project.customer?.email ?? null,
      metadata: { previousStatus: row.status, newStatus: "accepted" },
    });
    await prisma.project.update({ where: { id: row.projectId }, data: { status: "awarded" } });
    return this.getById(row.id, orgId);
  }

  async reject(id: string, orgId?: string, actorUserId?: string): Promise<ProposalDTO> {
    const row = await this.findOrThrow(id, orgId);
    const currentStatus = normalizeProposalStatus(row.status);
    if (!["sent", "viewed"].includes(currentStatus)) throw new ApiError(409, `Proposal ${id} cannot be declined from status ${currentStatus}`);
    const updated = await prisma.proposal.updateMany({
      where: { id, status: currentStatus, project: orgId ? { orgId } : undefined },
      data: { status: "declined", respondedAt: new Date() },
    });
    if (updated.count !== 1) throw new ApiError(409, `Proposal ${id} changed before it could be declined`);
    await this.recordDeliveryEvent({
      orgId: orgId ?? row.project.orgId ?? undefined,
      proposalId: row.id,
      projectId: row.projectId,
      actorUserId,
      eventType: "proposal.declined",
      recipientEmail: row.project.customer?.email ?? null,
      metadata: { previousStatus: currentStatus, newStatus: "declined" },
    });
    await prisma.project.update({ where: { id: row.projectId }, data: { status: "estimating" } });
    return this.getById(row.id, orgId);
  }

  async resend(id: string, orgId?: string, actorUserId?: string): Promise<ProposalDTO> {
    const row = await this.findOrThrow(id, orgId);
    const currentStatus = normalizeProposalStatus(row.status);
    if (!["sent", "viewed"].includes(currentStatus)) {
      throw new ApiError(409, `Proposal ${id} cannot be resent from status ${currentStatus}`);
    }

    const updated = await prisma.proposal.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
      },
    });
    await this.recordDeliveryEvent({
      orgId: orgId ?? row.project.orgId ?? undefined,
      proposalId: row.id,
      projectId: row.projectId,
      actorUserId,
      eventType: "proposal.resent",
      recipientEmail: row.project.customer?.email ?? null,
      metadata: { previousStatus: currentStatus, newStatus: "sent" },
    });
    await prisma.project.update({ where: { id: row.projectId }, data: { status: "estimating" } });
    return this.getById(updated.id, orgId);
  }

  async duplicate(id: string, orgId?: string): Promise<ProposalDTO> {
    const row = await this.findOrThrow(id, orgId);
    const duplicated = await prisma.proposal.create({
      data: {
        projectId: row.projectId,
        estimateId: row.estimateId,
        companyName: row.companyName,
        showLineItemDetail: row.showLineItemDetail,
        scopeOfWork: row.scopeOfWork,
        assumptions: row.assumptions,
        exclusions: row.exclusions,
        timeline: row.timeline,
        priceLow: toNullableNumber(row.priceLow),
        priceHigh: toNullableNumber(row.priceHigh),
        finalPrice: toNullableNumber(row.finalPrice),
        paymentScheduleJson: row.paymentScheduleJson as object | undefined,
        termsAndConditions: row.termsAndConditions,
      },
    });
    await prisma.project.update({ where: { id: row.projectId }, data: { status: "estimating" } });
    return toDTO(duplicated);
  }

  private async findOrThrow(id: string, orgId?: string) {
    const row = await prisma.proposal.findFirst({
      where: { id, project: orgId ? { orgId } : undefined },
      include: {
        deliveries: { orderBy: { occurredAt: "desc" } },
        project: {
          include: {
            customer: {
              select: { id: true, email: true },
            },
          },
        },
      },
    });
    if (!row) throw new ApiError(404, `Proposal ${id} not found`);
    return row;
  }

  private async recordDeliveryEvent(input: {
    orgId?: string;
    proposalId: string;
    projectId: string;
    actorUserId?: string;
    eventType: string;
    recipientEmail?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!input.orgId) {
      throw new ApiError(500, `Proposal ${input.proposalId} is missing organization scope`);
    }
    await prisma.proposalDelivery.create({
      data: {
        orgId: input.orgId,
        proposalId: input.proposalId,
        eventType: input.eventType,
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
      title: input.eventType.replace("proposal.", "Proposal ").replaceAll("_", " "),
      actorUserId: input.actorUserId,
      metadata: {
        proposalId: input.proposalId,
        recipientEmail: input.recipientEmail ?? null,
        ...(input.metadata ?? {}),
      },
    });
  }

  private async createFromEstimate(input: CreateProposalInput) {
    const estimate = await prisma.estimate.findFirst({ where: { id: input.estimateId, orgId: input.orgId } });
    if (!estimate) throw new ApiError(404, `Estimate ${input.estimateId} not found`);

    const estimateStatus = normalizeEstimateStatus(estimate.status);
    if (estimateStatus === "draft") {
      throw new ApiError(409, `Estimate ${input.estimateId} must be finalized before creating a proposal`);
    }
    const finalizedEstimatePrice = estimate.totalPrice;
    const hasExplicitRange = input.priceLow != null || input.priceHigh != null;

    const proposal = await prisma.proposal.create({
      data: {
        projectId: estimate.projectId,
        estimateId: input.estimateId,
        companyName: input.companyName,
        showLineItemDetail: input.showLineItemDetail ?? false,
        scopeOfWork: input.scopeOfWork,
        assumptions: input.assumptions,
        exclusions: input.exclusions,
        timeline: input.timeline,
        priceLow: input.priceLow,
        priceHigh: input.priceHigh,
        finalPrice: input.finalPrice ?? (hasExplicitRange ? null : finalizedEstimatePrice),
        paymentScheduleJson: this.normalizePaymentSchedule(input.paymentScheduleJson) as object | undefined,
        termsAndConditions: input.termsAndConditions,
      },
    });
    await prisma.project.update({ where: { id: estimate.projectId }, data: { status: "estimating" } });
    return proposal;
  }

  private async createFromProject(input: CreateProposalInput) {
    if (!input.projectId) throw new ApiError(400, "projectId is required when estimateId is not provided");

    const project = await this.getProjectDraftContext(input.projectId, input.orgId);

    const latestVisit = project.siteVisits[0];
    const draft = this.projectIntake.buildProposalDraft({
      companyName: input.companyName ?? project.organization?.name ?? "Your Company",
      customerName: project.customer?.name,
      projectName: project.name,
      simpleScope: project.simpleScope,
      jobType: project.jobType,
      projectAddress: project.siteAddress,
      notes: latestVisit?.notes,
      transcript: latestVisit?.transcript,
      measurements: asRecord(latestVisit?.measurementsJson),
    });

    const proposal = await prisma.proposal.create({
      data: {
        projectId: project.id,
        estimateId: null,
        companyName: input.companyName ?? project.organization?.name ?? null,
        showLineItemDetail: input.showLineItemDetail ?? false,
        scopeOfWork: input.scopeOfWork ?? draft.scopeOfWork,
        assumptions: input.assumptions ?? draft.assumptions,
        exclusions: input.exclusions ?? draft.exclusions,
        timeline: input.timeline ?? draft.timeline,
        priceLow: input.priceLow ?? draft.priceLow,
        priceHigh: input.priceHigh ?? draft.priceHigh,
        finalPrice: input.finalPrice ?? null,
        paymentScheduleJson: this.normalizePaymentSchedule(input.paymentScheduleJson, draft.paymentSchedule) as object | undefined,
        termsAndConditions: input.termsAndConditions,
      },
    });
    await prisma.project.update({ where: { id: project.id }, data: { status: "estimating" } });
    return proposal;
  }

  private async getProjectDraftContext(projectId: string, orgId?: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      include: {
        organization: true,
        customer: true,
        siteVisits: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!project) throw new ApiError(404, `Project ${projectId} not found`);
    return project;
  }

  private normalizePaymentSchedule(input: unknown, fallback?: unknown): PaymentScheduleEntry[] | undefined {
    const source = input ?? fallback;
    if (source === undefined || source === null) return undefined;
    if (!Array.isArray(source) || source.length === 0) {
      throw new ApiError(400, "Payment schedule must include at least one milestone");
    }

    const schedule = source.map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new ApiError(400, `Payment milestone ${index + 1} is invalid`);
      }

      const item = entry as Record<string, unknown>;
      const label = typeof item.label === "string" ? item.label.trim() : "";
      const notes = typeof item.notes === "string" ? item.notes.trim() : undefined;
      const amountPercent = typeof item.amountPercent === "number" ? item.amountPercent : Number(item.amountPercent);

      if (!label) throw new ApiError(400, `Payment milestone ${index + 1} needs a label`);
      if (!Number.isFinite(amountPercent) || amountPercent <= 0) {
        throw new ApiError(400, `Payment milestone ${index + 1} needs a positive percent`);
      }

      return {
        label,
        amountPercent: roundPercent(amountPercent),
        ...(notes ? { notes } : {}),
      };
    });

    const totalPercent = schedule.reduce((sum, entry) => sum + entry.amountPercent, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      throw new ApiError(400, "Payment schedule must total 100%");
    }

    return schedule;
  }
}

function toQueueItemDTO(row: {
  id: string;
  projectId: string;
  status: string;
  finalPrice: unknown;
  sentAt: Date | null;
  viewedAt: Date | null;
  updatedAt: Date;
  project: { name: string; customer: { name: string } | null };
  contracts: Array<{ id: string }>;
}): ProposalQueueItemDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    customerName: row.project.customer?.name ?? null,
    status: normalizeProposalStatus(row.status),
    amount: toNullableNumber(row.finalPrice),
    contractId: row.contracts[0]?.id ?? null,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    viewedAt: row.viewedAt ? row.viewedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDTO(row: {
  id: string;
  projectId: string;
  estimateId: string | null;
  status: string;
  companyName: string | null;
  showLineItemDetail: boolean;
  scopeOfWork: string | null;
  assumptions: string | null;
  exclusions: string | null;
  timeline: string | null;
  priceLow: unknown;
  priceHigh: unknown;
  finalPrice: unknown;
  paymentScheduleJson: unknown;
  pdfUrl: string | null;
  termsAndConditions: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
  deliveries?: Array<{
    id: string;
    proposalId: string;
    eventType: string;
    deliveryChannel: string;
    recipientEmail: string | null;
    actorUserId: string | null;
    metadataJson: Prisma.JsonValue | null;
    occurredAt: Date;
    createdAt: Date;
  }>;
}): ProposalDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    estimateId: row.estimateId,
    status: normalizeProposalStatus(row.status),
    companyName: row.companyName,
    showLineItemDetail: row.showLineItemDetail,
    scopeOfWork: row.scopeOfWork,
    assumptions: row.assumptions,
    exclusions: row.exclusions,
    timeline: row.timeline,
    priceLow: toNullableNumber(row.priceLow),
    priceHigh: toNullableNumber(row.priceHigh),
    finalPrice: toNullableNumber(row.finalPrice),
    paymentScheduleJson: row.paymentScheduleJson,
    pdfUrl: row.pdfUrl,
    termsAndConditions: row.termsAndConditions,
    sentAt: row.sentAt,
    viewedAt: row.viewedAt,
    respondedAt: row.respondedAt,
    createdAt: row.createdAt,
    deliveries: (row.deliveries ?? []).map(toDeliveryDTO),
  };
}

function toDeliveryDTO(row: {
  id: string;
  proposalId: string;
  eventType: string;
  deliveryChannel: string;
  recipientEmail: string | null;
  actorUserId: string | null;
  metadataJson: Prisma.JsonValue | null;
  occurredAt: Date;
  createdAt: Date;
}): ProposalDeliveryDTO {
  return {
    id: row.id,
    proposalId: row.proposalId,
    eventType: row.eventType,
    deliveryChannel: row.deliveryChannel,
    recipientEmail: row.recipientEmail,
    actorUserId: row.actorUserId,
    metadata: asRecord(row.metadataJson),
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
  };
}

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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}
