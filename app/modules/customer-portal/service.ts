import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { basePrisma, prisma } from "../../db/client";
import { getDatabaseTransactionMaxWait } from "../../db/requestSession";
import { ApiError } from "../../backend/middleware/errorHandler";
import { ContractsService } from "../contracts/service";
import { InvoicesService } from "../invoices/service";
import { ProposalsService } from "../proposals/service";
import { CloseoutService } from "../closeout/service";
import type { CloseoutChecklist, GetCloseoutResult, ProjectCloseoutDTO, WarrantyRecordDTO } from "../closeout/types";
import { logError } from "../../backend/logging";
import { emailService, scheduleEmailInBackground } from "../email/service";
import { hashRecipientAddress, recordOutboundDeliveryMessage } from "../email/deliveryJournal";
import { resendDeliveryJournalStore } from "../../db/resendDeliveryJournalStore";

export const CUSTOMER_PORTAL_SESSION_HEADER = "x-tradeos-portal-session";
export const CUSTOMER_PORTAL_ACCESS_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CUSTOMER_PORTAL_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface CustomerPortalContext {
  sessionId: string;
  accessTokenId: string;
  orgId: string;
  customerId: string;
}

export interface IssuedCustomerPortalToken {
  id: string;
  customerId: string;
  expiresAt: Date;
  token: string;
}

export interface RedeemedCustomerPortalToken {
  sessionToken: string;
  sessionId: string;
  customerId: string;
  orgId: string;
  expiresAt: Date;
}

/**
 * Read-only closeout handoff for the customer portal. Matches the shape
 * the web portal section renders: the closeout status, the backend's
 * computed checklist, the resolved/open punch summary, warranty records
 * exactly as stored, and the portal-scoped link to the rendered closeout
 * document. `documentHref` is a web-portal proxy path (the browser's
 * portal session cookie authenticates it); the backend route it forwards
 * to is /api/v1/customer-portal/projects/:id/closeout/document.
 */
export interface PortalCloseoutHandoff {
  status: ProjectCloseoutDTO["status"];
  checklist: CloseoutChecklist;
  resolvedPunchCount: number;
  openPunchCount: number;
  warranties: PortalWarrantyRecord[];
  documentHref: string;
}

export interface PortalWarrantyRecord {
  id: string;
  projectId: string;
  jobId: string | null;
  contractId: string | null;
  invoiceId: string | null;
  title: string;
  coverageText: string;
  sourceType: WarrantyRecordDTO["sourceType"];
  sourceId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// The portal shows warranty records exactly as stored — and nothing else.
// The staff DTO also carries the owning org and the staff author; neither
// belongs in a customer-facing payload.
function toPortalWarrantyRecord(record: WarrantyRecordDTO): PortalWarrantyRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    jobId: record.jobId,
    contractId: record.contractId,
    invoiceId: record.invoiceId,
    title: record.title,
    coverageText: record.coverageText,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Delivery metadata returned by internal proposal APIs may contain staff-only
 * approval evidence. The customer portal may show an approval milestone but
 * must not leak the staff's note, contact details, or other internal fields.
 * Keep the source marker only so the portal timeline labels the event honestly.
 */
function redactInternalProposalEvidence<T extends {
  deliveries: Array<{ metadata: Record<string, unknown> | null }>
}>(proposal: T): T {
  return {
    ...proposal,
    deliveries: proposal.deliveries.map((delivery) =>
      delivery.metadata?.source === "staff_recorded_offline"
        ? { ...delivery, actorUserId: null, recipientEmail: null, metadata: { source: "staff_recorded_offline" } }
        : delivery
    ),
  };
}

export class CustomerPortalService {
  private readonly proposals = new ProposalsService();
  private readonly invoices = new InvoicesService();
  private readonly contracts = new ContractsService();
  private readonly closeout = new CloseoutService();

  async issueAccessToken(input: { orgId: string; customerId: string; createdByUserId?: string }): Promise<IssuedCustomerPortalToken> {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, orgId: input.orgId, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!customer) throw new ApiError(404, `Customer ${input.customerId} not found`);
    const customerEmail = customer.email;
    if (!customerEmail) throw new ApiError(409, "Customer must have an email address before a portal link can be issued");

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + CUSTOMER_PORTAL_ACCESS_TOKEN_TTL_MS);
    const row = await prisma.customerPortalAccessToken.create({
      data: {
        orgId: input.orgId,
        customerId: customer.id,
        tokenHash: hashPortalSecret(token),
        expiresAt,
        createdByUserId: input.createdByUserId,
      },
    });
    scheduleEmailInBackground(async () => {
      try {
        const result = await emailService.sendCustomerPortalAccess({ to: customerEmail, token, expiresAt: row.expiresAt });
        if (result.providerMessageId) {
          try {
            await recordOutboundDeliveryMessage(resendDeliveryJournalStore, {
              providerMessageId: result.providerMessageId,
              kind: "customer_portal_access",
              orgId: input.orgId,
              recipientDigest: hashRecipientAddress(customerEmail),
            });
          } catch (error) {
            logError("customer_portal.access_email_journal_failed", { error: error instanceof Error ? error.name : "UnknownError" });
          }
        }
      } catch (error) {
        logError("customer_portal.access_email_failed", { error: error instanceof Error ? error.name : "UnknownError" });
      }
    });
    return { id: row.id, customerId: row.customerId, expiresAt: row.expiresAt, token };
  }

  async revokeAccessToken(orgId: string, accessTokenId: string): Promise<void> {
    const token = await prisma.customerPortalAccessToken.findFirst({
      where: { id: accessTokenId, orgId },
      select: { id: true },
    });
    if (!token) throw new ApiError(404, `Customer portal access token ${accessTokenId} not found`);

    const revokedAt = new Date();
    await prisma.customerPortalAccessToken.updateMany({
      where: { id: token.id, orgId, revokedAt: null },
      data: { revokedAt },
    });
    await prisma.customerPortalSession.updateMany({
      where: { accessTokenId: token.id, orgId, revokedAt: null },
      data: { revokedAt },
    });
  }

  async redeemAccessToken(rawToken: string): Promise<RedeemedCustomerPortalToken> {
    assertPortalSecret(rawToken, "access token");
    const tokenHash = hashPortalSecret(rawToken);
    const now = new Date();

    return basePrisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`
          select set_config('app.portal_lookup_hash', ${tokenHash}, true)
        `);
        const accessToken = await transaction.customerPortalAccessToken.findFirst({
          where: { tokenHash, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } },
          select: { id: true, orgId: true, customerId: true, expiresAt: true },
        });
        if (!accessToken) throw new ApiError(410, "This customer portal link is invalid, expired, or already used");

        const claimed = await transaction.customerPortalAccessToken.updateMany({
          where: { id: accessToken.id, tokenHash, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { redeemedAt: now },
        });
        if (claimed.count !== 1) throw new ApiError(410, "This customer portal link is invalid, expired, or already used");

        await transaction.$queryRaw(Prisma.sql`
          select
            set_config('app.org_id', ${accessToken.orgId}, true),
            set_config('app.portal_customer_id', ${accessToken.customerId}, true)
        `);
        const sessionToken = randomBytes(32).toString("base64url");
        const sessionHash = hashPortalSecret(sessionToken);
        await transaction.$queryRaw(Prisma.sql`
          select set_config('app.portal_session_hash', ${sessionHash}, true)
        `);
        const session = await transaction.customerPortalSession.create({
          data: {
            orgId: accessToken.orgId,
            customerId: accessToken.customerId,
            accessTokenId: accessToken.id,
            sessionHash,
            expiresAt: new Date(Date.now() + CUSTOMER_PORTAL_SESSION_TTL_MS),
          },
        });

        return {
          sessionToken,
          sessionId: session.id,
          customerId: session.customerId,
          orgId: session.orgId,
          expiresAt: session.expiresAt,
        };
      },
      { maxWait: getDatabaseTransactionMaxWait() },
    );
  }

  async resolveSession(rawSessionToken: string): Promise<CustomerPortalContext> {
    assertPortalSecret(rawSessionToken, "portal session");
    const sessionHash = hashPortalSecret(rawSessionToken);
    const now = new Date();

    return basePrisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`
          select set_config('app.portal_session_hash', ${sessionHash}, true)
        `);
        const session = await transaction.customerPortalSession.findFirst({
          where: { sessionHash, revokedAt: null, expiresAt: { gt: now } },
          select: { id: true, accessTokenId: true, orgId: true, customerId: true, expiresAt: true },
        });
        if (!session) throw new ApiError(401, "Customer portal session is invalid or expired");

        await transaction.$queryRaw(Prisma.sql`
          select
            set_config('app.org_id', ${session.orgId}, true),
            set_config('app.portal_customer_id', ${session.customerId}, true),
            set_config('app.portal_session_id', ${session.id}, true)
        `);
        const customer = await transaction.customer.findFirst({
          where: { id: session.customerId, orgId: session.orgId, deletedAt: null },
          select: { id: true },
        });
        if (!customer) throw new ApiError(401, "Customer portal identity is no longer active");

        const touched = await transaction.customerPortalSession.updateMany({
          where: { id: session.id, sessionHash, revokedAt: null, expiresAt: { gt: now } },
          data: { lastSeenAt: now },
        });
        if (touched.count !== 1) throw new ApiError(401, "Customer portal session is invalid or was revoked");
        return {
          sessionId: session.id,
          accessTokenId: session.accessTokenId,
          orgId: session.orgId,
          customerId: session.customerId,
        };
      },
      { maxWait: getDatabaseTransactionMaxWait() },
    );
  }

  async listProjects(context: CustomerPortalContext) {
    const projects = await prisma.project.findMany({
      where: { orgId: context.orgId, customerId: context.customerId },
      select: { id: true, orgId: true, customerId: true, name: true, jobType: true, siteAddress: true, simpleScope: true, regionId: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return projects.map((project) => ({ ...project, title: project.name, projectAddress: project.siteAddress }));
  }

  async getProject(context: CustomerPortalContext, projectId: string) {
    const project = await this.assertProject(context, projectId);
    const [proposals, invoices, contracts, closeout] = await Promise.all([
      this.proposals.listByProject(project.id, context.orgId),
      this.invoices.listByProject(project.id, context.orgId),
      this.contracts.listByProject(project.id, context.orgId),
      this.getCloseoutHandoff(context, project.id),
    ]);
    return {
      ...project,
      title: project.name,
      projectAddress: project.siteAddress,
      proposals: proposals.filter((proposal) => proposal.status !== "draft").map(redactInternalProposalEvidence),
      invoices: invoices.filter((invoice) => invoice.status !== "draft"),
      contracts,
      closeout,
      estimates: [],
      siteVisits: [],
      projectFiles: [],
      changeOrders: [],
      tasks: [],
      jobs: [],
    };
  }

  async getProposal(context: CustomerPortalContext, proposalId: string) {
    await this.assertProposal(context, proposalId);
    const proposal = await this.proposals.getById(proposalId, context.orgId);
    if (proposal.status === "draft") throw new ApiError(404, `Proposal ${proposalId} not found`);
    return redactInternalProposalEvidence(proposal);
  }

  async getInvoice(context: CustomerPortalContext, invoiceId: string) {
    await this.assertInvoice(context, invoiceId);
    const invoice = await this.invoices.getById(invoiceId, context.orgId);
    if (invoice.status === "draft") throw new ApiError(404, `Invoice ${invoiceId} not found`);
    // DES-7 (c): a portal view is the mark-viewed writer. The read path
    // already verified the portal session's organization + customer scope,
    // and markViewed is idempotent, so repeat views record nothing new.
    return this.invoices.markViewed(invoiceId, context.orgId);
  }

  async getContract(context: CustomerPortalContext, contractId: string) {
    await this.assertContract(context, contractId);
    return this.contracts.getById(contractId, context.orgId);
  }

  async getProposalPdf(context: CustomerPortalContext, proposalId: string) {
    const proposal = await this.assertProposal(context, proposalId);
    if (proposal.status === "draft") throw new ApiError(404, `Proposal ${proposalId} not found`);
    return this.proposals.getPdf(proposalId, context.orgId);
  }

  async getInvoicePdf(context: CustomerPortalContext, invoiceId: string) {
    const invoice = await this.assertInvoice(context, invoiceId);
    if (invoice.status === "draft") throw new ApiError(404, `Invoice ${invoiceId} not found`);
    return this.invoices.getPdf(invoiceId, context.orgId);
  }

  async getContractPdf(context: CustomerPortalContext, contractId: string) {
    await this.assertContract(context, contractId);
    return this.contracts.getPdf(contractId, context.orgId);
  }

  /**
   * Read-only closeout document for the portal customer. The project is
   * verified as theirs first (assertProject 404s otherwise); the closeout
   * service then enforces the same organization scope on the document
   * itself. No portal write happens here.
   */
  async getCloseoutDocument(context: CustomerPortalContext, projectId: string) {
    await this.assertProject(context, projectId);
    return this.closeout.getCloseoutDocumentHtml(projectId, context.orgId);
  }

  /**
   * The project's closeout handoff, or null when no closeout exists yet.
   * A missing closeout is a normal state (closeout starts at field
   * completion), not an error — only a real failure propagates.
   */
  private async getCloseoutHandoff(context: CustomerPortalContext, projectId: string): Promise<PortalCloseoutHandoff | null> {
    let result: GetCloseoutResult;
    try {
      result = await this.closeout.getCloseoutByProject(projectId, context.orgId);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) return null;
      throw error;
    }
    const [punchItems, warranties] = await Promise.all([
      this.closeout.listPunchItemsByProject(projectId, context.orgId),
      this.closeout.listWarrantyRecordsByProject(projectId, context.orgId),
    ]);
    return {
      status: result.closeout.status,
      checklist: result.checklist,
      resolvedPunchCount: punchItems.filter((item) => item.status === "resolved" || item.status === "verified").length,
      openPunchCount: result.checklist.openPunchCount,
      warranties: warranties.map(toPortalWarrantyRecord),
      documentHref: `/api/customer-portal/projects/${projectId}/closeout/document`,
    };
  }

  async signContract(context: CustomerPortalContext, contractId: string, input: {
    signerName: string;
    signatureDataUrl?: string;
    signatureIpReported?: string;
    signatureUserAgentReported?: string;
  }) {
    const contract = await this.assertContract(context, contractId);
    const customer = await prisma.customer.findFirst({
      where: { id: context.customerId, orgId: context.orgId, deletedAt: null },
      select: { email: true },
    });
    if (!customer?.email) throw new ApiError(409, "Customer email is required to attribute a signature");
    return this.contracts.signAsPortalCustomer(contract.id, {
      orgId: context.orgId,
      customerId: context.customerId,
      portalSessionId: context.sessionId,
      signerName: input.signerName,
      signerEmail: customer.email,
      signatureDataUrl: input.signatureDataUrl,
      signatureIpReported: input.signatureIpReported,
      signatureUserAgentReported: input.signatureUserAgentReported,
    });
  }

  private async assertProject(context: CustomerPortalContext, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId: context.orgId, customerId: context.customerId },
      include: { customer: { select: { id: true, name: true, email: true } } },
    });
    if (!project) throw new ApiError(404, `Project ${projectId} not found`);
    return project;
  }

  private async assertProposal(context: CustomerPortalContext, proposalId: string) {
    const row = await prisma.proposal.findFirst({
      where: { id: proposalId, project: { orgId: context.orgId, customerId: context.customerId } },
      select: { id: true, status: true },
    });
    if (!row) throw new ApiError(404, `Proposal ${proposalId} not found`);
    return row;
  }

  private async assertInvoice(context: CustomerPortalContext, invoiceId: string) {
    const row = await prisma.invoice.findFirst({
      where: { id: invoiceId, project: { orgId: context.orgId, customerId: context.customerId } },
      select: { id: true, status: true },
    });
    if (!row) throw new ApiError(404, `Invoice ${invoiceId} not found`);
    return row;
  }

  private async assertContract(context: CustomerPortalContext, contractId: string) {
    const row = await prisma.contract.findFirst({
      where: { id: contractId, project: { orgId: context.orgId, customerId: context.customerId } },
      select: { id: true },
    });
    if (!row) throw new ApiError(404, `Contract ${contractId} not found`);
    return row;
  }
}

export function hashPortalSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function assertPortalSecret(value: string, label: string): void {
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(value)) throw new ApiError(401, `Invalid ${label}`);
}
