import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { getRequestDatabaseClient, runInDatabaseTransaction } from "../../db/requestSession";
import { ApiError } from "../../backend/middleware/errorHandler";
import { ProposalGeneratorService } from "../proposal-generator/service";
import { ProposalDocument } from "../proposal-generator/types";
import { ProjectIntakeService } from "../project-intake/service";
import { ActivityTimelineService } from "../intelligence/service";
import { getDefaultAthenaEventService } from "../athena-events/service";
import { legacyProposalStatusMap, normalizeEstimateStatus, normalizeProposalStatus } from "../../domain";
import { clampQueueLimit, decodeUpdatedAtCursor, encodeUpdatedAtCursor, buildUpdatedAtRange, QueuePage } from "../shared/pagination";
import { expandCanonicalStatusFilter } from "../shared/statusFilter";
import { CreateProposalAllowanceInput, CreateProposalInput, CreateProposalSelectionInput, ProposalAllowanceDTO, ProposalDTO, ProposalDeliveryDTO, ProposalDraftPreviewDTO, ProposalQueueFilters, ProposalQueueItemDTO, ProposalSelectionDTO, ProposalSelectionStatus, UpdateProposalAllowanceInput, UpdateProposalSelectionInput } from "./types";
import { isValidSignatureDataUrl } from "./signatureValidation";


function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function proposalRequestHash(input: CreateProposalInput): string {
  // orgId is request scope, not request content; confirmedNoMatch is the
  // contractor's explicit confirmation, not proposal content. Neither may
  // change the hash, or a retry that gains (or loses) the flag would 409
  // instead of replaying the original draft.
  const request = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== "orgId" && key !== "confirmedNoMatch"),
  );
  return createHash("sha256").update(JSON.stringify(canonicalize(request))).digest("hex");
}


async function withProposalCreateSavepoint<T>(operation: () => Promise<T>): Promise<T> {
  const activeTransaction = getRequestDatabaseClient();
  if (!activeTransaction) return operation();

  // A duplicate insert aborts the current PostgreSQL transaction. Isolate the
  // insert and its project side effect so the caller can read the winner after rollback.
  const savepoint = `proposal_create_${randomUUID().replace(/-/g, "")}`;
  await activeTransaction.$executeRawUnsafe(`SAVEPOINT "${savepoint}"`);
  try {
    const result = await operation();
    await activeTransaction.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`);
    return result;
  } catch (error) {
    await activeTransaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${savepoint}"`);
    await activeTransaction.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`);
    throw error;
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

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
    // DES-10 Status Check: the unkeyed (legacy) create path records the
    // same confirmation event as the keyed path. A flag without a key
    // must not silently drop the contractor's explicit confirmation;
    // this path has no replays, so a retry creates a second draft (the
    // legacy path's pre-existing behavior).
    if (input.confirmedNoMatch === true && input.orgId) {
      await this.recordStatusCheckConfirmation(row, input.orgId, input.estimateId ?? null, null);
    }
    return toDTO(row);
  }

  /**
   * Persist a contractor's explicit Status Check no-match confirmation as
   * a `proposal.status_check_confirmed` activity event on the project.
   * Recorded only on a genuinely fresh create, never on a replay; the
   * flag is never part of the idempotency hash.
   */
  private async recordStatusCheckConfirmation(
    row: { id: string; projectId: string },
    orgId: string,
    estimateId: string | null,
    idempotencyKey: string | null,
  ): Promise<void> {
    await this.activityService.record({
      orgId,
      entityType: "project",
      entityId: row.projectId,
      eventType: "proposal.status_check_confirmed",
      title:
        "Contractor confirmed no proposal for this project and estimate was present in the loaded list; created again",
      metadata: {
        proposalId: row.id,
        estimateId,
        idempotencyKey,
      },
    });
  }

  /**
   * Creates one proposal for an organization-scoped request key. A replay
   * returns the original proposal; reusing the key for different input fails
   * with 409. The database unique constraint arbitrates simultaneous requests.
   */
  async createWithIdempotency(
    input: CreateProposalInput,
    idempotencyKey: string
  ): Promise<{ proposal: ProposalDTO; replayed: boolean }> {
    if (!input.orgId) throw new ApiError(400, "Organization context is required");
    const requestHash = proposalRequestHash(input);
    let projectId: string;

    if (input.estimateId) {
      const estimate = await prisma.estimate.findFirst({
        where: { id: input.estimateId, orgId: input.orgId },
        select: { projectId: true },
      });
      if (!estimate) throw new ApiError(404, `Estimate ${input.estimateId} not found`);
      projectId = estimate.projectId;
    } else {
      if (!input.projectId) throw new ApiError(400, "projectId is required when estimateId is not provided");
      const project = await this.getProjectDraftContext(input.projectId, input.orgId);
      projectId = project.id;
    }

    const findReplay = async () => {
      const existing = await prisma.proposal.findFirst({
        where: { projectId, idempotencyKey, project: { orgId: input.orgId } },
        // Load the child collections too: a replay returns the original
        // proposal, and Prisma excludes relations unless requested, so
        // without these the replay would report empty selections and a
        // zero allowances total for a proposal that has both.
        include: {
          deliveries: { orderBy: { occurredAt: "desc" } },
          selections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          allowances: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      });
      if (!existing) return null;
      if (existing.idempotencyHash !== requestHash) {
        throw new ApiError(409, "This proposal request key was already used with different details. Check the project proposal list before starting a new draft.");
      }
      return { proposal: toDTO(existing), replayed: true as const };
    };

    const replay = await findReplay();
    if (replay) return replay;

    try {
      const row = await withProposalCreateSavepoint(() =>
        input.estimateId
          ? this.createFromEstimate(input, { idempotencyKey, requestHash })
          : this.createFromProject(input, { idempotencyKey, requestHash })
      );
      if (input.confirmedNoMatch === true) {
        // A replay records nothing — the original attempt already
        // recorded it (or never carried the flag).
        await this.recordStatusCheckConfirmation(row, input.orgId, input.estimateId ?? null, idempotencyKey);
      }
      return { proposal: toDTO(row), replayed: false };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const concurrentReplay = await findReplay();
      if (concurrentReplay) return concurrentReplay;
      throw error;
    }
  }

  async listByProject(projectId: string, orgId?: string): Promise<ProposalDTO[]> {
    const rows = await prisma.proposal.findMany({
      where: { projectId, project: orgId ? { orgId } : undefined },
      // Load the child collections too: Prisma excludes relations unless
      // requested, so without these every listed proposal would report
      // empty selections and a zero allowances total.
      include: {
        deliveries: { orderBy: { occurredAt: "desc" } },
        selections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        allowances: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
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
        // Explicit column list (#1093): a select-all read 500s the whole
        // queue when the database lags the code by an additive column
        // (here: the DES-10-F7 signature columns). The queue item consumes
        // only these columns, mirroring the invoices queue's
        // explicit-column raw SQL.
        select: {
          id: true,
          projectId: true,
          status: true,
          finalPrice: true,
          sentAt: true,
          viewedAt: true,
          updatedAt: true,
          project: { select: { name: true, customer: { select: { name: true } } } },
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

  // --- DES-10-F8: proposal selections (Copperline section 03) ---
  // Selections and allowances are editable through the same draft rules as
  // the proposal itself (see update()): an accepted proposal, or one with a
  // contract, is immutable. Nothing here touches acceptance, estimate
  // finalization, or totals — allowancesTotal is display-only.

  /**
   * Serialize child mutations against proposal acceptance. Acceptance
   * commits through a conditional update on the proposal row, so taking a
   * row lock on the parent first — inside the same transaction as the child
   * write — orders the two: whichever commits first wins, and the loser
   * re-reads the committed state (the editability check below, or the
   * conditional updateMany/deleteMany predicate) instead of racing past it.
   * Mirrors EstimateEngineService.lockEstimateForMutation. Skipped when the
   * client cannot run raw SQL (mocked Prisma in unit tests), where the
   * conditional predicates remain the only guard.
   */
  private async lockProposalForMutation(proposalId: string): Promise<void> {
    if (typeof prisma.$queryRaw !== "function") return;
    await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM public.proposals
      WHERE id = CAST(${proposalId} AS uuid)
      FOR UPDATE
    `);
  }

  /**
   * Advance the parent proposal's revision after a child mutation, so a
   * customer holding the approval page rendered before the change cannot
   * accept the stale revision: acceptAsPortalCustomer compares the
   * proposal's updatedAt against the expectedUpdatedAt the page rendered
   * with, and a child-only change left updatedAt untouched. Runs inside
   * the same transaction as the child write, under the parent row lock.
   */
  private async bumpProposalRevision(proposalId: string): Promise<void> {
    await prisma.proposal.update({ where: { id: proposalId }, data: { updatedAt: new Date() } });
  }

  /**
   * Run a child mutation inside one transaction (reusing the active request
   * transaction when one exists) so the parent lock above and the child
   * write commit or roll back together. Falls through to the direct call
   * when the client has no $transaction (mocked Prisma in unit tests);
   * there the request-scoped transaction already provides the boundary, or
   * there is no concurrent writer to serialize against.
   */
  private async inProposalMutationTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (typeof prisma.$transaction !== "function") return operation();
    return runInDatabaseTransaction(prisma, operation);
  }

  async listSelections(proposalId: string, orgId?: string): Promise<ProposalSelectionDTO[]> {
    await this.findOrThrow(proposalId, orgId);
    const rows = await prisma.proposalSelection.findMany({
      where: { proposalId, proposal: { project: orgId ? { orgId } : undefined } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toSelectionDTO);
  }

  async createSelection(proposalId: string, input: CreateProposalSelectionInput, orgId?: string): Promise<ProposalSelectionDTO> {
    return this.inProposalMutationTransaction(() => this.createSelectionInTransaction(proposalId, input, orgId));
  }

  private async createSelectionInTransaction(proposalId: string, input: CreateProposalSelectionInput, orgId?: string): Promise<ProposalSelectionDTO> {
    await this.lockProposalForMutation(proposalId);
    const parent = await this.findEditableProposal(proposalId, orgId);
    const validated = validateSelectionInput(input);
    if (validated.label === undefined) throw new ApiError(400, "Selection label must be 1-120 characters");
    const childOrgId = parent.project.orgId ?? orgId;
    if (!childOrgId) throw new ApiError(500, `Proposal ${proposalId} is missing organization scope`);
    // Allocate after the highest surviving row, not the row count: after a
    // delete, count() would reuse a deleted slot and the new row could land
    // before a surviving one. Runs under the parent row lock, inside the
    // same transaction as the insert (see lockProposalForMutation).
    const maxSortOrder = await prisma.proposalSelection.aggregate({ where: { proposalId }, _max: { sortOrder: true } });
    const sortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;
    const row = await prisma.proposalSelection.create({
      data: {
        orgId: childOrgId,
        proposalId,
        sortOrder,
        label: validated.label,
        detail: validated.detail ?? null,
        status: validated.status ?? "action_required",
        dueDate: validated.dueDate ?? null,
      },
    });
    await this.bumpProposalRevision(proposalId);
    return toSelectionDTO(row);
  }

  async updateSelection(selectionId: string, proposalId: string, input: UpdateProposalSelectionInput, orgId?: string): Promise<ProposalSelectionDTO> {
    return this.inProposalMutationTransaction(() => this.updateSelectionInTransaction(selectionId, proposalId, input, orgId));
  }

  private async updateSelectionInTransaction(selectionId: string, proposalId: string, input: UpdateProposalSelectionInput, orgId?: string): Promise<ProposalSelectionDTO> {
    await this.lockProposalForMutation(proposalId);
    const validated = validateSelectionInput(input, true);
    const updated = await prisma.proposalSelection.updateMany({
      where: {
        id: selectionId,
        proposal: {
          id: proposalId,
          status: { not: "accepted" },
          contracts: { none: {} },
          project: orgId ? { orgId } : undefined,
        },
      },
      data: {
        label: validated.label,
        detail: validated.detail,
        status: validated.status,
        dueDate: validated.dueDate,
      },
    });
    if (updated.count !== 1) throw await this.selectionWriteError(selectionId, proposalId, orgId);
    await this.bumpProposalRevision(proposalId);
    const row = await prisma.proposalSelection.findFirstOrThrow({ where: { id: selectionId } });
    return toSelectionDTO(row);
  }

  async deleteSelection(selectionId: string, proposalId: string, orgId?: string): Promise<void> {
    return this.inProposalMutationTransaction(() => this.deleteSelectionInTransaction(selectionId, proposalId, orgId));
  }

  private async deleteSelectionInTransaction(selectionId: string, proposalId: string, orgId?: string): Promise<void> {
    await this.lockProposalForMutation(proposalId);
    const deleted = await prisma.proposalSelection.deleteMany({
      where: {
        id: selectionId,
        proposal: {
          id: proposalId,
          status: { not: "accepted" },
          contracts: { none: {} },
          project: orgId ? { orgId } : undefined,
        },
      },
    });
    if (deleted.count !== 1) throw await this.selectionWriteError(selectionId, proposalId, orgId);
    await this.bumpProposalRevision(proposalId);
  }

  // --- DES-10-F8: proposal allowances (Copperline section 04) ---

  async listAllowances(proposalId: string, orgId?: string): Promise<ProposalAllowanceDTO[]> {
    await this.findOrThrow(proposalId, orgId);
    const rows = await prisma.proposalAllowance.findMany({
      where: { proposalId, proposal: { project: orgId ? { orgId } : undefined } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toAllowanceDTO);
  }

  async createAllowance(proposalId: string, input: CreateProposalAllowanceInput, orgId?: string): Promise<ProposalAllowanceDTO> {
    return this.inProposalMutationTransaction(() => this.createAllowanceInTransaction(proposalId, input, orgId));
  }

  private async createAllowanceInTransaction(proposalId: string, input: CreateProposalAllowanceInput, orgId?: string): Promise<ProposalAllowanceDTO> {
    await this.lockProposalForMutation(proposalId);
    const parent = await this.findEditableProposal(proposalId, orgId);
    const validated = validateAllowanceInput(input);
    if (validated.description === undefined || validated.amount === undefined) {
      throw new ApiError(400, "Allowance description and amount are required");
    }
    const childOrgId = parent.project.orgId ?? orgId;
    if (!childOrgId) throw new ApiError(500, `Proposal ${proposalId} is missing organization scope`);
    // Allocate after the highest surviving row, not the row count: after a
    // delete, count() would reuse a deleted slot and the new row could land
    // before a surviving one. Runs under the parent row lock, inside the
    // same transaction as the insert (see lockProposalForMutation).
    const maxSortOrder = await prisma.proposalAllowance.aggregate({ where: { proposalId }, _max: { sortOrder: true } });
    const sortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;
    const row = await prisma.proposalAllowance.create({
      data: {
        orgId: childOrgId,
        proposalId,
        sortOrder,
        description: validated.description,
        amount: validated.amount,
      },
    });
    await this.bumpProposalRevision(proposalId);
    return toAllowanceDTO(row);
  }

  async updateAllowance(allowanceId: string, proposalId: string, input: UpdateProposalAllowanceInput, orgId?: string): Promise<ProposalAllowanceDTO> {
    return this.inProposalMutationTransaction(() => this.updateAllowanceInTransaction(allowanceId, proposalId, input, orgId));
  }

  private async updateAllowanceInTransaction(allowanceId: string, proposalId: string, input: UpdateProposalAllowanceInput, orgId?: string): Promise<ProposalAllowanceDTO> {
    await this.lockProposalForMutation(proposalId);
    const validated = validateAllowanceInput(input, true);
    const updated = await prisma.proposalAllowance.updateMany({
      where: {
        id: allowanceId,
        proposal: {
          id: proposalId,
          status: { not: "accepted" },
          contracts: { none: {} },
          project: orgId ? { orgId } : undefined,
        },
      },
      data: {
        description: validated.description,
        amount: validated.amount,
      },
    });
    if (updated.count !== 1) throw await this.allowanceWriteError(allowanceId, proposalId, orgId);
    await this.bumpProposalRevision(proposalId);
    const row = await prisma.proposalAllowance.findFirstOrThrow({ where: { id: allowanceId } });
    return toAllowanceDTO(row);
  }

  async deleteAllowance(allowanceId: string, proposalId: string, orgId?: string): Promise<void> {
    return this.inProposalMutationTransaction(() => this.deleteAllowanceInTransaction(allowanceId, proposalId, orgId));
  }

  private async deleteAllowanceInTransaction(allowanceId: string, proposalId: string, orgId?: string): Promise<void> {
    await this.lockProposalForMutation(proposalId);
    const deleted = await prisma.proposalAllowance.deleteMany({
      where: {
        id: allowanceId,
        proposal: {
          id: proposalId,
          status: { not: "accepted" },
          contracts: { none: {} },
          project: orgId ? { orgId } : undefined,
        },
      },
    });
    if (deleted.count !== 1) throw await this.allowanceWriteError(allowanceId, proposalId, orgId);
    await this.bumpProposalRevision(proposalId);
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
      // The recorded portal signature (if any) renders in the PDF Acceptance
      // block; the project-draft path reads the same fields from the row.
      acceptance: {
        signerName: row.signerName ?? null,
        signerEmail: row.signerEmail ?? null,
        signatureDataUrl: row.signatureDataUrl ?? null,
        signedAt: row.signedAt ?? null,
      },
    });
  }

  async send(id: string, orgId?: string, actorUserId?: string): Promise<ProposalDTO> {
    const row = await this.findOrThrow(id, orgId);
    if (row.status !== "draft") throw new ApiError(409, `Proposal ${id} has already been sent`);
    this.normalizePaymentSchedule(row.paymentScheduleJson);
    // Sending and staff-recorded offline approval compete for the same draft.
    // Require the exact revision we validated so neither can overwrite the other.
    const updated = await prisma.proposal.updateMany({
      where: { id, status: "draft", updatedAt: row.updatedAt, project: orgId ? { orgId } : undefined },
      data: { status: "sent", sentAt: new Date() },
    });
    if (updated.count !== 1) throw new ApiError(409, `Proposal ${id} changed before it could be sent`);
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
    return this.getById(id, orgId);
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

  /**
   * Staff-recorded customer approval received outside TradeOS.
   * This is deliberately distinct from send: it never sets sentAt,
   * triggers email delivery, or manufactures a ProposalSent event.
   */
  async acceptOffline(
    id: string,
    input: { channel: "in_person" | "phone" | "signed_document"; note: string },
    orgId?: string,
    actorUserId?: string
  ): Promise<ProposalDTO> {
    if (!orgId || !actorUserId) throw new ApiError(403, "Authenticated organization and actor are required");
    const note = input.note?.trim() ?? "";
    if (!["in_person", "phone", "signed_document"].includes(input.channel) || note.length < 10 || note.length > 500) {
      throw new ApiError(400, "Provide the acceptance method and a 10-500 character audit note");
    }

    const row = await this.findOrThrow(id, orgId);
    const currentStatus = normalizeProposalStatus(row.status);
    if (currentStatus !== "draft") {
      throw new ApiError(409, `Proposal ${id} is not a draft and cannot be recorded as accepted offline`);
    }
    if (!row.scopeOfWork?.trim() || row.finalPrice == null || !Number.isFinite(Number(row.finalPrice)) || Number(row.finalPrice) <= 0) {
      throw new ApiError(409, "Finish the written scope and final price before recording customer acceptance");
    }
    this.normalizePaymentSchedule(row.paymentScheduleJson);
    const updated = await prisma.proposal.updateMany({
      where: { id, status: "draft", updatedAt: row.updatedAt, project: { orgId } },
      data: { status: "accepted", respondedAt: new Date() },
    });
    if (updated.count !== 1) throw new ApiError(409, `Proposal ${id} changed before offline acceptance could be recorded`);

    await this.recordDeliveryEvent({
      orgId,
      proposalId: row.id,
      projectId: row.projectId,
      actorUserId,
      eventType: "proposal.accepted",
      recipientEmail: null,
      metadata: {
        previousStatus: "draft",
        newStatus: "accepted",
        acceptanceChannel: input.channel,
        acceptanceNote: note,
        source: "staff_recorded_offline",
      },
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

  /**
   * DES-10-F7: governed public-portal acceptance. The customer answers from
   * a redeemed magic-link session (ADR-010) — no staff JWT, no customer
   * account. The caller is the token holder: signerEmail comes from the
   * customer record on file (passed in by CustomerPortalService, never from
   * the HTTP body), and the signature must be a drawn image, not a
   * free-text field alone.
   *
   * Governance, in order: the portal service asserts the proposal belongs
   * to this session's customer (404 otherwise, before any write); the
   * response is bound to the revision the customer reviewed
   * (expectedUpdatedAt — a staff edit after the page rendered is a 409,
   * and the conditional update also predicates on it, so the check is
   * atomic); the conditional update requires sent/viewed and the
   * org/customer project scope; the 20261124150000 migration grants one
   * narrow portal UPDATE policy keyed by the transaction-local portal
   * proposal id and a trigger that pins every column except the response
   * itself. A second accept, an accept of a draft/declined proposal, or a
   * replayed token all fail here with 409/404 before anything is recorded.
   *
   * No Athena event is published and no email is sent — this records the
   * customer's own answer, it does not originate a staff action.
   */
  async acceptAsPortalCustomer(
    id: string,
    input: {
      orgId: string;
      customerId: string;
      portalSessionId: string;
      signerName: string;
      signerEmail: string;
      signatureDataUrl: string;
      signatureIpReported?: string;
      signatureUserAgentReported?: string;
      expectedUpdatedAt?: string;
    },
  ): Promise<ProposalDTO> {
    const signerName = input.signerName?.trim() ?? "";
    if (signerName.length < 1 || signerName.length > 200) {
      throw new ApiError(400, "Signer name is required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.signerEmail ?? "")) {
      throw new ApiError(409, "Customer email is required to attribute a signature");
    }
    if (!isValidSignatureDataUrl(input.signatureDataUrl) || input.signatureDataUrl.length > 2_000_000) {
      throw new ApiError(400, "A drawn signature is required to accept this proposal");
    }
    const expectedUpdatedAt = parseExpectedUpdatedAt(input.expectedUpdatedAt);

    const row = await this.findOrThrow(id, input.orgId);
    const currentStatus = normalizeProposalStatus(row.status);
    if (!["sent", "viewed"].includes(currentStatus)) {
      throw new ApiError(409, `Proposal ${id} cannot be accepted from status ${currentStatus}`);
    }
    if (row.project.customer?.id !== input.customerId) {
      throw new ApiError(404, `Proposal ${id} not found`);
    }
    assertReviewedRevision(row, expectedUpdatedAt);

    // Portal sessions carry app.role = 'portal_customer', so the staff
    // proposals write policy denies them. The 20261124150000 migration
    // grants one narrowly scoped portal UPDATE policy keyed by this
    // transaction-local proposal id (same shape as app.portal_contract_id
    // for contract signing); the whole portal request runs in one
    // transaction, so the setting covers the update, the award, and the
    // response-event inserts below. Staff sessions ignore it — their own
    // write policy already permits the update. Skipped when the client
    // cannot run raw SQL (mocked Prisma in unit tests), where the
    // conditional predicates remain the only guard.
    if (typeof prisma.$queryRaw === "function") {
      await prisma.$queryRaw(Prisma.sql`
        select
          set_config('app.portal_proposal_id', ${id}, true),
          set_config('app.portal_proposal_project_id', ${row.projectId}, true)
      `);
    }
    const now = new Date();
    const updated = await prisma.proposal.updateMany({
      where: {
        id,
        status: currentStatus,
        ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}),
        project: { orgId: input.orgId, customerId: input.customerId },
      },
      data: {
        status: "accepted",
        respondedAt: now,
        signerName,
        signerEmail: input.signerEmail,
        signatureDataUrl: input.signatureDataUrl,
        signatureIpReported: input.signatureIpReported,
        signatureUserAgentReported: input.signatureUserAgentReported,
        signedAt: now,
      },
    });
    if (updated.count !== 1) throw new ApiError(409, `Proposal ${id} changed before it could be accepted`);
    await this.recordDeliveryEvent({
      orgId: input.orgId,
      proposalId: row.id,
      projectId: row.projectId,
      eventType: "proposal.accepted",
      deliveryChannel: "portal",
      recipientEmail: input.signerEmail,
      metadata: {
        previousStatus: currentStatus,
        newStatus: "accepted",
        actorType: "customer_portal",
        customerId: input.customerId,
        portalSessionId: input.portalSessionId,
        signerName,
        signatureIpReported: input.signatureIpReported ?? null,
        signatureUserAgentReported: input.signatureUserAgentReported ?? null,
      },
    });
    // Staff accept parity: award the project. Best-effort under the portal
    // session — the narrow award policy only permits estimating -> awarded
    // for this proposal's project, so a project already awarded through
    // another proposal simply stays awarded and the acceptance still stands.
    await prisma.project.updateMany({
      where: { id: row.projectId, status: "estimating", orgId: input.orgId, customerId: input.customerId },
      data: { status: "awarded" },
    });
    return this.getById(row.id, input.orgId);
  }

  /**
   * DES-10-F7: governed public-portal decline. Same token scoping and
   * audit trail as the portal accept, minus the signature: declining
   * records who declined (the token holder's customer + session), when,
   * and the optional reason. It deliberately does NOT touch the project:
   * a project may carry several proposals, and declining one must not
   * un-award a project won through another (unlike staff reject(), which
   * sets 'estimating' unconditionally).
   */
  async declineAsPortalCustomer(
    id: string,
    input: { orgId: string; customerId: string; portalSessionId: string; reason?: string; expectedUpdatedAt?: string },
  ): Promise<ProposalDTO> {
    const reason = input.reason?.trim() ?? "";
    if (reason.length > 500) throw new ApiError(400, "Decline reason must be 500 characters or fewer");
    const expectedUpdatedAt = parseExpectedUpdatedAt(input.expectedUpdatedAt);

    const row = await this.findOrThrow(id, input.orgId);
    const currentStatus = normalizeProposalStatus(row.status);
    if (!["sent", "viewed"].includes(currentStatus)) {
      throw new ApiError(409, `Proposal ${id} cannot be declined from status ${currentStatus}`);
    }
    if (row.project.customer?.id !== input.customerId) {
      throw new ApiError(404, `Proposal ${id} not found`);
    }
    assertReviewedRevision(row, expectedUpdatedAt);

    if (typeof prisma.$queryRaw === "function") {
      await prisma.$queryRaw(Prisma.sql`select set_config('app.portal_proposal_id', ${id}, true)`);
    }
    const updated = await prisma.proposal.updateMany({
      where: {
        id,
        status: currentStatus,
        ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}),
        project: { orgId: input.orgId, customerId: input.customerId },
      },
      data: { status: "declined", respondedAt: new Date(), declinedReason: reason || null },
    });
    if (updated.count !== 1) throw new ApiError(409, `Proposal ${id} changed before it could be declined`);
    await this.recordDeliveryEvent({
      orgId: input.orgId,
      proposalId: row.id,
      projectId: row.projectId,
      eventType: "proposal.declined",
      deliveryChannel: "portal",
      recipientEmail: row.project.customer?.email ?? null,
      metadata: {
        previousStatus: currentStatus,
        newStatus: "declined",
        actorType: "customer_portal",
        customerId: input.customerId,
        portalSessionId: input.portalSessionId,
        declinedReason: reason || null,
      },
    });
    return this.getById(row.id, input.orgId);
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
    // A duplicate is a fresh draft revision of the same proposal: carry the
    // customer's pending decisions and allowance lines with it so the copy
    // does not silently lose them.
    const [selections, allowances] = await Promise.all([
      prisma.proposalSelection.findMany({ where: { proposalId: id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
      prisma.proposalAllowance.findMany({ where: { proposalId: id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ]);
    if (selections.length > 0) {
      await prisma.proposalSelection.createMany({
        data: selections.map((selection) => ({
          orgId: selection.orgId,
          proposalId: duplicated.id,
          label: selection.label,
          detail: selection.detail,
          status: selection.status,
          dueDate: selection.dueDate,
          sortOrder: selection.sortOrder,
        })),
      });
    }
    if (allowances.length > 0) {
      await prisma.proposalAllowance.createMany({
        data: allowances.map((allowance) => ({
          orgId: allowance.orgId,
          proposalId: duplicated.id,
          description: allowance.description,
          amount: allowance.amount,
          sortOrder: allowance.sortOrder,
        })),
      });
    }
    await prisma.project.update({ where: { id: row.projectId }, data: { status: "estimating" } });
    // Reload the copy: the bare create result carries no relations, so
    // returning it directly would report empty selections and a zero
    // allowances total even though the children were just copied.
    const reloaded = await this.findOrThrow(duplicated.id, orgId);
    return toDTO(reloaded);
  }

  private async findEditableProposal(proposalId: string, orgId?: string) {
    const row = await prisma.proposal.findFirst({
      where: { id: proposalId, project: orgId ? { orgId } : undefined },
      include: {
        project: { select: { orgId: true } },
        contracts: { select: { id: true }, take: 1 },
      },
    });
    if (!row) throw new ApiError(404, `Proposal ${proposalId} not found`);
    if (normalizeProposalStatus(row.status) === "accepted" || row.contracts.length > 0) {
      throw new ApiError(409, `Proposal ${proposalId} is immutable after acceptance or contract creation; use a change order or duplicate revision`);
    }
    return row;
  }

  private async selectionWriteError(selectionId: string, proposalId: string, orgId?: string): Promise<ApiError> {
    const existing = await prisma.proposalSelection.findFirst({
      where: { id: selectionId, proposal: { id: proposalId, project: orgId ? { orgId } : undefined } },
      include: { proposal: { include: { contracts: { select: { id: true }, take: 1 } } } },
    });
    if (!existing) return new ApiError(404, `Proposal selection ${selectionId} not found`);
    return new ApiError(409, `Proposal ${proposalId} is immutable after acceptance or contract creation; use a change order or duplicate revision`);
  }

  private async allowanceWriteError(allowanceId: string, proposalId: string, orgId?: string): Promise<ApiError> {
    const existing = await prisma.proposalAllowance.findFirst({
      where: { id: allowanceId, proposal: { id: proposalId, project: orgId ? { orgId } : undefined } },
      include: { proposal: { include: { contracts: { select: { id: true }, take: 1 } } } },
    });
    if (!existing) return new ApiError(404, `Proposal allowance ${allowanceId} not found`);
    return new ApiError(409, `Proposal ${proposalId} is immutable after acceptance or contract creation; use a change order or duplicate revision`);
  }

  private async findOrThrow(id: string, orgId?: string) {
    const row = await prisma.proposal.findFirst({
      where: { id, project: orgId ? { orgId } : undefined },
      include: {
        deliveries: { orderBy: { occurredAt: "desc" } },
        selections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        allowances: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
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
    deliveryChannel?: string;
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
        deliveryChannel: input.deliveryChannel ?? "app",
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

  private async createFromEstimate(input: CreateProposalInput, idempotency?: { idempotencyKey: string; requestHash: string }) {
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
        idempotencyKey: idempotency?.idempotencyKey,
        idempotencyHash: idempotency?.requestHash,
      },
    });
    await prisma.project.update({ where: { id: estimate.projectId }, data: { status: "estimating" } });
    return proposal;
  }

  private async createFromProject(input: CreateProposalInput, idempotency?: { idempotencyKey: string; requestHash: string }) {
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
        idempotencyKey: idempotency?.idempotencyKey,
        idempotencyHash: idempotency?.requestHash,
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

/**
 * DES-10-F7 (review repair): bind a portal response to the revision the
 * customer reviewed. The portal page renders the proposal's updatedAt and
 * the form returns it as expectedUpdatedAt; a staff edit after the page
 * rendered bumps updatedAt (Prisma @updatedAt), so the response is
 * rejected with 409 and the customer must review the updated document.
 * Omitted when the caller cannot send a revision (older clients) — the
 * status + scope predicates remain the guard then. The conditional update
 * also predicates on updatedAt, so the check is atomic.
 */
function parseExpectedUpdatedAt(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new ApiError(400, "expectedUpdatedAt must be a valid date-time");
  }
  return parsed;
}

function assertReviewedRevision(row: { updatedAt: Date }, expectedUpdatedAt: Date | undefined): void {
  if (expectedUpdatedAt && row.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    throw new ApiError(409, "Proposal changed since it was reviewed — please review the updated proposal before responding");
  }
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
  signerName: string | null;
  signerEmail: string | null;
  signatureDataUrl: string | null;
  signedAt: Date | null;
  declinedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  selections?: Array<{
    id: string;
    proposalId: string;
    label: string;
    detail: string | null;
    status: string;
    dueDate: Date | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  allowances?: Array<{
    id: string;
    proposalId: string;
    description: string;
    amount: unknown;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): ProposalDTO {
  const selections = (row.selections ?? []).map(toSelectionDTO);
  const allowances = (row.allowances ?? []).map(toAllowanceDTO);
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
    signerName: row.signerName ?? null,
    signerEmail: row.signerEmail ?? null,
    signatureDataUrl: row.signatureDataUrl ?? null,
    signedAt: row.signedAt ?? null,
    declinedReason: row.declinedReason ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deliveries: (row.deliveries ?? []).map(toDeliveryDTO),
    selections,
    allowances,
    allowancesTotal: allowances.reduce((sum, allowance) => sum + allowance.amount, 0),
  };
}

function toSelectionDTO(row: {
  id: string;
  proposalId: string;
  label: string;
  detail: string | null;
  status: string;
  dueDate: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): ProposalSelectionDTO {
  return {
    id: row.id,
    proposalId: row.proposalId,
    label: row.label,
    detail: row.detail,
    status: normalizeSelectionStatus(row.status),
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAllowanceDTO(row: {
  id: string;
  proposalId: string;
  description: string;
  amount: unknown;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): ProposalAllowanceDTO {
  return {
    id: row.id,
    proposalId: row.proposalId,
    description: row.description,
    amount: toNullableNumber(row.amount) ?? 0,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const PROPOSAL_SELECTION_STATUSES: readonly ProposalSelectionStatus[] = ["action_required", "confirmed"];

function normalizeSelectionStatus(status: string): ProposalSelectionStatus {
  return (PROPOSAL_SELECTION_STATUSES as readonly string[]).includes(status)
    ? (status as ProposalSelectionStatus)
    : "action_required";
}

function validateSelectionInput(
  input: CreateProposalSelectionInput | UpdateProposalSelectionInput,
  partial = false
): { label?: string; detail?: string | null; status?: ProposalSelectionStatus; dueDate?: Date | null } {
  const result: { label?: string; detail?: string | null; status?: ProposalSelectionStatus; dueDate?: Date | null } = {};

  if (input.label !== undefined || !partial) {
    const label = typeof input.label === "string" ? input.label.trim() : "";
    if (label.length < 1 || label.length > 120) {
      throw new ApiError(400, "Selection label must be 1-120 characters");
    }
    result.label = label;
  }
  if (input.detail !== undefined) {
    if (input.detail === null) {
      result.detail = null;
    } else {
      const detail = typeof input.detail === "string" ? input.detail.trim() : "";
      if (detail.length > 500) throw new ApiError(400, "Selection detail must be at most 500 characters");
      result.detail = detail === "" ? null : detail;
    }
  }
  if (input.status !== undefined) {
    if (!(PROPOSAL_SELECTION_STATUSES as readonly string[]).includes(input.status)) {
      throw new ApiError(400, "Selection status must be action_required or confirmed");
    }
    result.status = input.status;
  }
  if (input.dueDate !== undefined) {
    if (input.dueDate === null) {
      result.dueDate = null;
    } else {
      const dueDate = new Date(input.dueDate);
      if (Number.isNaN(dueDate.getTime())) throw new ApiError(400, "Selection due date must be a valid date");
      result.dueDate = dueDate;
    }
  }
  return result;
}

function validateAllowanceInput(
  input: CreateProposalAllowanceInput | UpdateProposalAllowanceInput,
  partial = false
): { description?: string; amount?: number } {
  const result: { description?: string; amount?: number } = {};

  if (input.description !== undefined || !partial) {
    const description = typeof input.description === "string" ? input.description.trim() : "";
    if (description.length < 1 || description.length > 200) {
      throw new ApiError(400, "Allowance description must be 1-200 characters");
    }
    result.description = description;
  }
  if (input.amount !== undefined) {
    const amount = typeof input.amount === "number" ? input.amount : Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ApiError(400, "Allowance amount must be a finite number of 0 or more");
    }
    result.amount = amount;
  } else if (!partial) {
    throw new ApiError(400, "Allowance amount must be a finite number of 0 or more");
  }
  return result;
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
