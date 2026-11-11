/**
 * Tenant-scoped job assessment service (issue #946, TODO 4).
 *
 * Persists explicit Project/Estimate context, proposed work type, citations
 * with rationale, unknowns, needs-review statuses, owner signoff, and audit
 * fields in `codes_job_assessment`. Tenant isolation is enforced twice:
 * app-side (every query is org-scoped and the parent Project/Estimate must
 * belong to the caller's org) and database-side (FORCE ROW LEVEL SECURITY
 * policies on the table — see the migration; live coverage lives in
 * app/tests/rls.integration.ts, because mocked Prisma tests cannot prove RLS).
 *
 * Owner approval is never set at creation. It requires the explicit sign-off
 * path, which stamps the actor and time for the audit trail.
 */
import { PrismaClient } from "@prisma/client";
import { ApiError } from "../../../backend/middleware/errorHandler";
import { prisma } from "../../../db/client";
import { assessmentStatuses, type AssessmentCitation, type AssessmentStatus, type CodesJobAssessmentDTO, type CreateAssessmentInput } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CITATIONS = 20;
const MAX_UNKNOWNS = 20;

type AssessmentRow = {
  id: string;
  orgId: string;
  projectId: string;
  estimateId: string | null;
  workType: string;
  status: string;
  citations: unknown;
  unknowns: unknown;
  ownerSignoff: boolean;
  signedOffBy: string | null;
  signedOffAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDTO(row: AssessmentRow): CodesJobAssessmentDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    projectId: row.projectId,
    estimateId: row.estimateId,
    workType: row.workType,
    status: row.status as AssessmentStatus,
    citations: (Array.isArray(row.citations) ? row.citations : []) as AssessmentCitation[],
    unknowns: (Array.isArray(row.unknowns) ? row.unknowns : []) as string[],
    ownerSignoff: row.ownerSignoff,
    signedOffBy: row.signedOffBy,
    signedOffAt: row.signedOffAt ? row.signedOffAt.toISOString() : null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validateCitations(citations: unknown): AssessmentCitation[] {
  if (!Array.isArray(citations) || citations.length > MAX_CITATIONS) {
    throw new ApiError(400, `citations must be an array of at most ${MAX_CITATIONS} entries`);
  }
  return citations.map((entry) => {
    if (typeof entry !== "object" || entry === null) throw new ApiError(400, "each citation must be an object");
    const { source_id, rationale } = entry as Record<string, unknown>;
    if (typeof source_id !== "string" || source_id.trim().length < 1 || source_id.length > 120) {
      throw new ApiError(400, "each citation needs a source_id of 1-120 characters");
    }
    if (typeof rationale !== "string" || rationale.trim().length < 1 || rationale.length > 500) {
      throw new ApiError(400, "each citation needs a rationale of 1-500 characters");
    }
    return { source_id: source_id.trim(), rationale: rationale.trim() };
  });
}

function validateUnknowns(unknowns: unknown): string[] {
  if (!Array.isArray(unknowns) || unknowns.length > MAX_UNKNOWNS) {
    throw new ApiError(400, `unknowns must be an array of at most ${MAX_UNKNOWNS} entries`);
  }
  return unknowns.map((entry) => {
    if (typeof entry !== "string" || entry.trim().length < 1 || entry.length > 500) {
      throw new ApiError(400, "each unknown must be 1-500 characters");
    }
    return entry.trim();
  });
}

export class CodesJobAssessmentService {
  constructor(private readonly db: PrismaClient = prisma) {}

  private async assertProjectInOrg(projectId: string, orgId: string): Promise<void> {
    const project = await this.db.project.findFirst({ where: { id: projectId, orgId } });
    if (!project) throw new ApiError(404, `Project ${projectId} not found`);
  }

  private async assertEstimateInProject(estimateId: string, projectId: string, orgId: string): Promise<void> {
    const estimate = await this.db.estimate.findFirst({ where: { id: estimateId, projectId, orgId } });
    if (!estimate) throw new ApiError(404, `Estimate ${estimateId} not found for this project`);
  }

  async create(input: CreateAssessmentInput): Promise<CodesJobAssessmentDTO> {
    if (!UUID.test(input.projectId)) throw new ApiError(400, "projectId must be a UUID");
    if (input.estimateId !== undefined && input.estimateId !== null && !UUID.test(input.estimateId)) {
      throw new ApiError(400, "estimateId must be a UUID");
    }
    const workType = input.workType?.trim() ?? "";
    if (workType.length < 1 || workType.length > 120) {
      throw new ApiError(400, "workType must be 1-120 characters");
    }
    const status = input.status ?? "needs_review";
    // The input type already excludes owner_approved; the string comparison
    // below is the runtime guard for untyped callers.
    if (!assessmentStatuses.includes(status) || (status as string) === "owner_approved") {
      throw new ApiError(400, "status must be needs_review, in_review, or needs_verification at creation; owner approval requires sign-off");
    }
    const citations = validateCitations(input.citations);
    const unknowns = validateUnknowns(input.unknowns);

    await this.assertProjectInOrg(input.projectId, input.orgId);
    if (input.estimateId) await this.assertEstimateInProject(input.estimateId, input.projectId, input.orgId);

    const row = (await this.db.codesJobAssessment.create({
      data: {
        orgId: input.orgId,
        projectId: input.projectId,
        estimateId: input.estimateId ?? null,
        workType,
        status,
        citations: citations as unknown as object,
        unknowns: unknowns as unknown as object,
        ownerSignoff: false,
        createdBy: input.createdBy ?? null,
      },
    })) as unknown as AssessmentRow;
    return toDTO(row);
  }

  async listForProject(projectId: string, orgId: string): Promise<CodesJobAssessmentDTO[]> {
    await this.assertProjectInOrg(projectId, orgId);
    const rows = (await this.db.codesJobAssessment.findMany({
      where: { projectId, orgId },
      orderBy: { createdAt: "desc" },
    })) as unknown as AssessmentRow[];
    return rows.map(toDTO);
  }

  async listForEstimate(estimateId: string, orgId: string): Promise<CodesJobAssessmentDTO[]> {
    const estimate = await this.db.estimate.findFirst({ where: { id: estimateId, orgId } });
    if (!estimate) throw new ApiError(404, `Estimate ${estimateId} not found`);
    const rows = (await this.db.codesJobAssessment.findMany({
      where: { estimateId, orgId },
      orderBy: { createdAt: "desc" },
    })) as unknown as AssessmentRow[];
    return rows.map(toDTO);
  }

  /**
   * Owner sign-off. Only owner/admin roles may call this (enforced in the
   * controller too); the service re-checks the row belongs to the org and
   * refuses to re-approve an already approved assessment.
   */
  async signOff(id: string, orgId: string, signedOffBy: string): Promise<CodesJobAssessmentDTO> {
    if (!UUID.test(id)) throw new ApiError(400, "assessment id must be a UUID");
    const existing = (await this.db.codesJobAssessment.findFirst({
      where: { id, orgId },
    })) as unknown as AssessmentRow | null;
    if (!existing) throw new ApiError(404, "Job assessment not found");
    if (existing.status === "owner_approved" || existing.ownerSignoff) {
      throw new ApiError(409, "Assessment is already owner-approved");
    }
    // Atomic conditional write: the unapproved-state predicate is checked by
    // the database in the same statement as the update, so two concurrent
    // sign-offs cannot both pass the check above and overwrite each other's
    // signedOffBy / signedOffAt audit stamp. The update is also org-scoped,
    // not id-only. A zero count means a concurrent sign-off won the race.
    const result = await this.db.codesJobAssessment.updateMany({
      where: { id, orgId, ownerSignoff: false, status: { not: "owner_approved" } },
      data: { status: "owner_approved", ownerSignoff: true, signedOffBy, signedOffAt: new Date() },
    });
    if (result.count === 0) throw new ApiError(409, "Assessment is already owner-approved");
    const row = (await this.db.codesJobAssessment.findFirst({
      where: { id, orgId },
    })) as unknown as AssessmentRow | null;
    if (!row) throw new ApiError(404, "Job assessment not found");
    return toDTO(row);
  }
}
