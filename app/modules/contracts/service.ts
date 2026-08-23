import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { ActivityTimelineService } from "../intelligence/service";
import { hasPermission, normalizeContractStatus } from "../../domain/contracts";
import { renderContractPdf } from "./pdf";
import { ContractDTO, ContractDocument, ContractEventDTO, CreateContractInput, SignContractInput } from "./types";

const DEFAULT_TERMS =
  "This contract incorporates the accepted proposal in full. Work will proceed as scoped, with any changes " +
  "documented and priced via a separate change order. Payment terms follow the invoicing schedule agreed upon acceptance.";

export class ContractsService {
  private readonly activityService = new ActivityTimelineService();

  async create(input: CreateContractInput): Promise<ContractDTO> {
    assertContractWriteAccess(input.actorRole);
    const proposal = await prisma.proposal.findFirst({
      where: { id: input.proposalId, project: input.orgId ? { orgId: input.orgId } : undefined },
    });
    if (!proposal) throw new ApiError(404, `Proposal ${input.proposalId} not found`);
    if (proposal.status !== "accepted") throw new ApiError(409, `Proposal ${input.proposalId} must be accepted before a contract can be created`);

    const row = await prisma.contract.create({
      data: {
        projectId: proposal.projectId,
        proposalId: proposal.id,
        termsText: input.termsText ?? proposal.termsAndConditions ?? DEFAULT_TERMS,
      },
    });
    await this.recordContractEvent({
      orgId: input.orgId,
      contractId: row.id,
      projectId: row.projectId,
      actorUserId: input.actorUserId,
      eventType: "contract.created",
      metadata: {
        proposalId: row.proposalId,
        status: row.status,
      },
    });
    return this.getById(row.id, input.orgId);
  }

  async listByProject(projectId: string, orgId?: string): Promise<ContractDTO[]> {
    const rows = await prisma.contract.findMany({
      where: { projectId, project: orgId ? { orgId } : undefined },
      include: { events: { orderBy: { occurredAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDTO);
  }

  async getById(id: string, orgId?: string): Promise<ContractDTO> {
    const row = await this.findOrThrow(id, orgId);
    return toDTO(row);
  }

  async sign(id: string, input: SignContractInput): Promise<ContractDTO> {
    assertContractWriteAccess(input.actorRole);
    const row = await this.findOrThrow(id, input.orgId);
    if (row.status !== "pending_signature") throw new ApiError(409, `Contract ${id} cannot be signed from status ${row.status}`);
    const updated = await prisma.contract.update({
      where: { id },
      data: {
        status: "signed",
        signerName: input.signerName,
        signerEmail: input.signerEmail,
        signatureDataUrl: input.signatureDataUrl,
        signatureIp: input.signatureIp,
        signedAt: new Date(),
      },
    });
    await this.recordContractEvent({
      orgId: input.orgId,
      contractId: row.id,
      projectId: row.projectId,
      actorUserId: input.actorUserId,
      eventType: "contract.signed",
      recipientEmail: input.signerEmail ?? row.signerEmail ?? null,
      metadata: {
        previousStatus: row.status,
        newStatus: "signed",
        signerName: input.signerName,
      },
    });
    return this.getById(updated.id, input.orgId);
  }

  async void(id: string, orgId?: string, actorUserId?: string, actorRole?: string): Promise<ContractDTO> {
    assertContractWriteAccess(actorRole);
    const row = await this.findOrThrow(id, orgId);
    if (row.status === "signed") throw new ApiError(409, `Contract ${id} has already been signed and cannot be voided`);
    const updated = await prisma.contract.update({ where: { id }, data: { status: "voided" } });
    await this.recordContractEvent({
      orgId: orgId ?? row.project.orgId ?? undefined,
      contractId: row.id,
      projectId: row.projectId,
      actorUserId,
      eventType: "contract.voided",
      recipientEmail: row.signerEmail,
      metadata: { previousStatus: row.status, newStatus: "voided", proposalId: row.proposalId },
    });
    return this.getById(updated.id, orgId);
  }

  async getPdf(id: string, orgId?: string): Promise<ContractDocument> {
    const row = await prisma.contract.findFirst({
      where: { id, project: orgId ? { orgId } : undefined },
      include: { project: { include: { customer: true } } },
    });
    if (!row) throw new ApiError(404, `Contract ${id} not found`);

    const buffer = await renderContractPdf(row, { companyName: "Your Company Name" });
    return {
      buffer,
      filename: `contract-${row.project.name.replace(/\s+/g, "-").toLowerCase()}.pdf`,
      contentType: "application/pdf",
    };
  }

  private async findOrThrow(id: string, orgId?: string) {
    const row = await prisma.contract.findFirst({
      where: { id, project: orgId ? { orgId } : undefined },
      include: {
        events: { orderBy: { occurredAt: "desc" } },
        project: true,
      },
    });
    if (!row) throw new ApiError(404, `Contract ${id} not found`);
    return row;
  }

  private async recordContractEvent(input: {
    orgId?: string;
    contractId: string;
    projectId: string;
    actorUserId?: string;
    eventType: string;
    recipientEmail?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!input.orgId) {
      throw new ApiError(500, `Contract ${input.contractId} is missing organization scope`);
    }
    await prisma.contractEvent.create({
      data: {
        orgId: input.orgId,
        contractId: input.contractId,
        eventType: input.eventType,
        actorUserId: input.actorUserId,
        recipientEmail: input.recipientEmail,
        metadataJson: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await this.activityService.record({
      orgId: input.orgId,
      entityType: "project",
      entityId: input.projectId,
      eventType: input.eventType,
      title: input.eventType.replace("contract.", "Contract ").replaceAll("_", " "),
      actorUserId: input.actorUserId,
      metadata: {
        contractId: input.contractId,
        recipientEmail: input.recipientEmail ?? null,
        ...(input.metadata ?? {}),
      },
    });
  }
}

function toDTO(row: {
  id: string;
  projectId: string;
  proposalId: string;
  status: string;
  termsText: string;
  signerName: string | null;
  signerEmail: string | null;
  signatureDataUrl: string | null;
  signatureIp: string | null;
  signedAt: Date | null;
  createdAt: Date;
  events?: Array<{
    id: string;
    eventType: string;
    actorUserId: string | null;
    recipientEmail: string | null;
    metadataJson: Prisma.JsonValue | null;
    occurredAt: Date;
    createdAt: Date;
  }>;
}): ContractDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    proposalId: row.proposalId,
    status: normalizeContractStatus(row.status),
    termsText: row.termsText,
    signerName: row.signerName,
    signerEmail: row.signerEmail,
    signatureDataUrl: row.signatureDataUrl,
    signatureIp: row.signatureIp,
    signedAt: row.signedAt,
    createdAt: row.createdAt,
    events: (row.events ?? []).map(toEventDTO),
  };
}

function toEventDTO(row: {
  id: string;
  eventType: string;
  actorUserId: string | null;
  recipientEmail: string | null;
  metadataJson: Prisma.JsonValue | null;
  occurredAt: Date;
  createdAt: Date;
}): ContractEventDTO {
  return {
    id: row.id,
    eventType: row.eventType,
    actorUserId: row.actorUserId,
    recipientEmail: row.recipientEmail,
    metadata: asRecord(row.metadataJson),
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function assertContractWriteAccess(role?: string) {
  if (!role || !hasPermission(role, "documents.manage")) {
    throw new ApiError(403, "You do not have permission to manage contracts");
  }
}
