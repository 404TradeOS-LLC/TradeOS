import { Prisma } from "@prisma/client";
import { prisma, basePrisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { ApiError } from "../../backend/middleware/errorHandler";
import type { AuthContext } from "../../backend/auth/context";
import { pageCatalogRows, type CatalogPage, type CatalogQuery } from "../shared/catalog-query";
import { CostDatabaseService } from "../cost-database/service";
import { CostbookService } from "./service";
import {
  costbookResearchCandidateSchema,
  isEligibleForCostbookPromotion,
  type CostbookCandidateReviewStatus,
  type CostbookResearchCandidate,
} from "./candidateCostItem";

/**
 * Stage 6 of docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md: the
 * reviewed persistence + promotion boundary between a researched candidate
 * and the production relational Costbook.
 *
 * This service never writes a CostItem/Material/LaborRate/Equipment row on
 * its own initiative. `promote()` is the only method that does so, and only
 * after re-checking isEligibleForCostbookPromotion() against the persisted
 * row inside a transaction serialized by a per-candidate advisory lock -
 * never trusting a caller-supplied "already approved" claim.
 */

export interface CreateCandidateInput {
  trade: string;
  category: string;
  itemName: string;
  description?: string;
  unitOfMeasure: string;
  materialCostLow?: number;
  materialCostTypical: number;
  materialCostHigh?: number;
  laborHours?: number;
  laborRateAssumption?: number;
  equipmentCost?: number;
  sourceName: string;
  sourceUrl?: string;
  sourceIdentifier?: string;
  sourceDate: string;
  retrievedAt: string;
  regionalBasis: string;
  confidence: "low" | "medium" | "high";
  researchNotes?: string;
  provenanceStatus?: "documented" | "unverified-legacy" | "placeholder";
}

export interface CandidateListFilters {
  reviewStatus?: CostbookCandidateReviewStatus;
}

export interface ReviewCandidateInput {
  decision: "approved" | "rejected";
  reviewNotes?: string;
}

export interface CandidateCostItemDTO {
  id: string;
  orgId: string;
  trade: string;
  category: string;
  itemName: string;
  description: string | null;
  unitOfMeasure: string;
  materialCostLow: number | null;
  materialCostTypical: number;
  materialCostHigh: number | null;
  laborHours: number | null;
  laborRateAssumption: number | null;
  equipmentCost: number;
  sourceName: string;
  sourceUrl: string | null;
  sourceIdentifier: string | null;
  sourceDate: string;
  retrievedAt: string;
  regionalBasis: string;
  confidence: string;
  researchNotes: string | null;
  provenanceStatus: string;
  reviewStatus: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  promotedAt: string | null;
  promotedByUserId: string | null;
  promotedCostItemId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

type CandidateRow = Awaited<ReturnType<typeof prisma.costbookResearchCandidate.findFirstOrThrow>>;

const OPEN_REVIEW_STATUSES: CostbookCandidateReviewStatus[] = ["candidate", "needs-review"];

export class CostbookCandidateService {
  private readonly costDatabase = new CostDatabaseService();
  private readonly costbook = new CostbookService();

  async create(auth: AuthContext, input: CreateCandidateInput): Promise<CandidateCostItemDTO> {
    // Re-validate through the Stage 5 contract so a candidate can never be
    // persisted in a shape the schema itself would reject - the API layer's
    // own zod schema additionally strips any client-supplied review fields
    // before this input ever reaches here (see the controller).
    const parsed = costbookResearchCandidateSchema.parse({
      trade: input.trade,
      category: input.category,
      itemName: input.itemName,
      description: input.description,
      unitOfMeasure: input.unitOfMeasure,
      materialCostLow: input.materialCostLow,
      materialCostTypical: input.materialCostTypical,
      materialCostHigh: input.materialCostHigh,
      laborHours: input.laborHours,
      laborRateAssumption: input.laborRateAssumption,
      equipmentCost: input.equipmentCost,
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      sourceIdentifier: input.sourceIdentifier,
      sourceDate: input.sourceDate,
      retrievedAt: input.retrievedAt,
      regionalBasis: input.regionalBasis,
      confidence: input.confidence,
      researchNotes: input.researchNotes,
      provenanceStatus: input.provenanceStatus,
      // reviewStatus/reviewedBy/reviewedAt are never accepted from a caller
      // at creation time; every candidate starts as "candidate".
    });

    const row = await prisma.costbookResearchCandidate.create({
      data: {
        orgId: auth.orgId,
        trade: parsed.trade,
        category: parsed.category,
        itemName: parsed.itemName,
        description: parsed.description ?? null,
        unitOfMeasure: parsed.unitOfMeasure,
        materialCostLow: parsed.materialCostLow ?? null,
        materialCostTypical: parsed.materialCostTypical,
        materialCostHigh: parsed.materialCostHigh ?? null,
        laborHours: parsed.laborHours ?? null,
        laborRateAssumption: parsed.laborRateAssumption ?? null,
        equipmentCost: parsed.equipmentCost,
        sourceName: parsed.sourceName,
        sourceUrl: parsed.sourceUrl ?? null,
        sourceIdentifier: parsed.sourceIdentifier ?? null,
        sourceDate: parsed.sourceDate,
        retrievedAt: new Date(parsed.retrievedAt),
        regionalBasis: parsed.regionalBasis,
        confidence: parsed.confidence,
        researchNotes: parsed.researchNotes ?? null,
        provenanceStatus: parsed.provenanceStatus,
        reviewStatus: "candidate",
        createdByUserId: auth.userId,
      },
    });
    return toDTO(row);
  }

  async listPage(auth: AuthContext, query: CatalogQuery, filters: CandidateListFilters): Promise<CatalogPage<CandidateCostItemDTO>> {
    query = { ...query, scope: auth.orgId };
    const where = {
      orgId: auth.orgId,
      ...(filters.reviewStatus ? { reviewStatus: filters.reviewStatus } : {}),
      ...(query.q ? { OR: [{ itemName: { contains: query.q, mode: "insensitive" } }, { trade: { contains: query.q, mode: "insensitive" } }, { category: { contains: query.q, mode: "insensitive" } }] } : {}),
    };
    const field = catalogField(query.sort, { createdAt: "createdAt", updatedAt: "updatedAt", reviewStatus: "reviewStatus" });
    return pageCatalogRows<any>({
      query,
      where,
      cursorField: field,
      cursorValueType: field === "reviewStatus" ? "string" : "date",
      findMany: (args) => prisma.costbookResearchCandidate.findMany(args as any) as any,
      count: (args) => prisma.costbookResearchCandidate.count(args as any),
      getCursorValue: (row) => (row as any)[field],
      getId: (row) => row.id,
      map: (row) => toDTO(row),
    }) as Promise<CatalogPage<CandidateCostItemDTO>>;
  }

  async getById(auth: AuthContext, id: string): Promise<CandidateCostItemDTO> {
    const row = await prisma.costbookResearchCandidate.findFirst({ where: { id, orgId: auth.orgId } });
    if (!row) throw new ApiError(404, `Costbook research candidate ${id} not found`);
    return toDTO(row);
  }

  async review(auth: AuthContext, id: string, input: ReviewCandidateInput): Promise<CandidateCostItemDTO> {
    return runInDatabaseTransaction(basePrisma, async (transaction) => {
      const existing = await transaction.costbookResearchCandidate.findFirst({ where: { id, orgId: auth.orgId } });
      if (!existing) throw new ApiError(404, `Costbook research candidate ${id} not found`);
      if (!OPEN_REVIEW_STATUSES.includes(existing.reviewStatus as CostbookCandidateReviewStatus)) {
        throw new ApiError(409, `Costbook research candidate ${id} has already been reviewed (${existing.reviewStatus})`);
      }

      const reviewedAt = new Date();
      // Claim the review before mutating anything else, mirroring the
      // supplier-price-update review pattern: the status predicate makes
      // approve/reject mutually exclusive under concurrent review.
      const claimed = await transaction.costbookResearchCandidate.updateMany({
        where: { id, orgId: auth.orgId, reviewStatus: existing.reviewStatus },
        data: {
          reviewStatus: input.decision,
          reviewedByUserId: auth.userId,
          reviewedAt,
          reviewNotes: input.reviewNotes ?? null,
        },
      });
      if (claimed.count !== 1) {
        throw new ApiError(409, `Costbook research candidate ${id} is no longer open for review`);
      }

      return toDTO({
        ...existing,
        reviewStatus: input.decision,
        reviewedByUserId: auth.userId,
        reviewedAt,
        reviewNotes: input.reviewNotes ?? null,
      });
    });
  }

  /**
   * The sole path from an approved candidate to a real, org-scoped
   * CostItem. Requires an existing Subcategory in this organization's
   * Costbook hierarchy matching the candidate's category - it does not
   * invent Division/Category/Subcategory structure, by design (see the
   * design doc's Stage 6 "what this does not do" notes).
   */
  async promote(auth: AuthContext, id: string): Promise<CandidateCostItemDTO> {
    return runInDatabaseTransaction(basePrisma, async (transaction) => {
      // Serialize concurrent promote attempts for the same candidate so two
      // simultaneous requests cannot both pass the promotedCostItemId-is-null
      // check and each create a production CostItem.
      if (typeof transaction.$executeRaw === "function") {
        await transaction.$executeRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`costbook-candidate-promote:${id}`}, 0))`
        );
      }

      const row = await transaction.costbookResearchCandidate.findFirst({ where: { id, orgId: auth.orgId } });
      if (!row) throw new ApiError(404, `Costbook research candidate ${id} not found`);
      if (row.promotedCostItemId) {
        throw new ApiError(409, `Costbook research candidate ${id} has already been promoted to cost item ${row.promotedCostItemId}`);
      }

      // Defensively re-validate the persisted row through the Stage 5
      // contract's own eligibility gate rather than trusting reviewStatus
      // alone - fails closed (as an ApiError, not a raw ZodError) even
      // against a row that is somehow missing reviewedBy/reviewedAt despite
      // an "approved" status.
      let eligible: boolean;
      try {
        eligible = isEligibleForCostbookPromotion(toContractShape(row));
      } catch {
        eligible = false;
      }
      if (!eligible) {
        throw new ApiError(
          409,
          `Costbook research candidate ${id} is not eligible for promotion (reviewStatus=${row.reviewStatus}); it must be approved by a named human reviewer first`
        );
      }

      const subcategory = await prisma.subcategory.findFirst({
        where: { name: { equals: row.category, mode: "insensitive" }, category: { division: { orgId: auth.orgId } } },
        select: { id: true },
      });
      if (!subcategory) {
        throw new ApiError(
          422,
          `No Costbook subcategory named "${row.category}" exists in this organization. Create or map a matching subcategory before promoting this candidate.`
        );
      }

      const laborHours = row.laborHours != null ? Number(row.laborHours) : null;
      const equipmentCostValue = Number(row.equipmentCost);
      if (equipmentCostValue > 0 && !(laborHours && laborHours > 0)) {
        throw new ApiError(
          422,
          `Costbook research candidate ${id} includes equipment cost but no positive laborHours/production rate; supply a production-rate basis before promoting it.`
        );
      }

      // Reuse the existing, org-scoped Costbook write paths for each
      // component instead of a second parallel pricing store - the same
      // requirement Stage 6 places on the CostItem write itself below.
      const materialCostTypical = Number(row.materialCostTypical);
      const materialId = materialCostTypical > 0
        ? (await this.costbook.createMaterial(auth, {
          name: row.itemName,
          unitOfMeasure: row.unitOfMeasure,
          unitCost: materialCostTypical,
          wasteFactorPct: 0,
        })).id
        : null;

      const laborRateAssumption = row.laborRateAssumption != null ? Number(row.laborRateAssumption) : null;
      // billRate is set equal to the researched hourlyCost - the candidate
      // carries no markup assumption, so no markup is invented here; an org
      // can adjust the bill rate after promotion via the labor-rate endpoints.
      const laborRateId = laborHours && laborHours > 0 && laborRateAssumption && laborRateAssumption > 0
        ? (await this.costbook.createLaborRate(auth, {
          role: row.trade,
          description: `Researched labor rate from candidate ${row.id}`,
          hourlyCost: laborRateAssumption,
          billRate: laborRateAssumption,
        })).id
        : null;

      // The candidate carries a single flat equipmentCost with no
      // ownership/operating split, so it is recorded entirely as operating
      // cost per hour; an org can rebalance it after promotion.
      const equipmentId = equipmentCostValue > 0
        ? (await this.costbook.createEquipment(auth, {
          name: `${row.itemName} equipment`,
          ownershipCostPerHour: 0,
          operatingCostPerHour: equipmentCostValue,
        })).id
        : null;

      // Preserve the full candidate UUID in the deterministic generated code;
      // truncating to eight characters can collide for distinct candidates.
      const code = `RC-${row.id.toUpperCase()}`;
      const costItem = await this.costDatabase.create({
        orgId: auth.orgId,
        subcategoryId: subcategory.id,
        code,
        name: row.itemName,
        unitOfMeasure: row.unitOfMeasure,
        productionRate: laborHours && laborHours > 0 ? Math.round((1 / laborHours) * 10_000) / 10_000 : undefined,
        laborRateId: laborRateId ?? undefined,
        materialId: materialId ?? undefined,
        equipmentId: equipmentId ?? undefined,
        notes: `Promoted from Costbook research candidate ${row.id} (source: ${row.sourceName}${row.sourceUrl ? `, ${row.sourceUrl}` : ""}).`,
      });

      const promotedAt = new Date();
      const claimed = await transaction.costbookResearchCandidate.updateMany({
        where: { id, orgId: auth.orgId, promotedCostItemId: null },
        data: { promotedAt, promotedByUserId: auth.userId, promotedCostItemId: costItem.id },
      });
      if (claimed.count !== 1) {
        // Should be unreachable under the advisory lock; fail loudly if it
        // ever happens rather than silently leaving an orphaned CostItem.
        throw new ApiError(409, `Costbook research candidate ${id} was promoted concurrently`);
      }

      return toDTO({ ...row, promotedAt, promotedByUserId: auth.userId, promotedCostItemId: costItem.id });
    });
  }
}

function toContractShape(row: CandidateRow): CostbookResearchCandidate {
  return costbookResearchCandidateSchema.parse({
    trade: row.trade,
    category: row.category,
    itemName: row.itemName,
    description: row.description ?? undefined,
    unitOfMeasure: row.unitOfMeasure,
    materialCostLow: row.materialCostLow != null ? Number(row.materialCostLow) : undefined,
    materialCostTypical: Number(row.materialCostTypical),
    materialCostHigh: row.materialCostHigh != null ? Number(row.materialCostHigh) : undefined,
    laborHours: row.laborHours != null ? Number(row.laborHours) : undefined,
    laborRateAssumption: row.laborRateAssumption != null ? Number(row.laborRateAssumption) : undefined,
    equipmentCost: Number(row.equipmentCost),
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl ?? undefined,
    sourceIdentifier: row.sourceIdentifier ?? undefined,
    sourceDate: row.sourceDate,
    retrievedAt: row.retrievedAt.toISOString(),
    regionalBasis: row.regionalBasis,
    confidence: row.confidence,
    researchNotes: row.researchNotes ?? undefined,
    provenanceStatus: row.provenanceStatus,
    reviewStatus: row.reviewStatus,
    reviewedBy: row.reviewedByUserId ?? undefined,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : undefined,
    reviewNotes: row.reviewNotes ?? undefined,
  });
}

function toDTO(row: CandidateRow): CandidateCostItemDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    trade: row.trade,
    category: row.category,
    itemName: row.itemName,
    description: row.description,
    unitOfMeasure: row.unitOfMeasure,
    materialCostLow: row.materialCostLow != null ? Number(row.materialCostLow) : null,
    materialCostTypical: Number(row.materialCostTypical),
    materialCostHigh: row.materialCostHigh != null ? Number(row.materialCostHigh) : null,
    laborHours: row.laborHours != null ? Number(row.laborHours) : null,
    laborRateAssumption: row.laborRateAssumption != null ? Number(row.laborRateAssumption) : null,
    equipmentCost: Number(row.equipmentCost),
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    sourceIdentifier: row.sourceIdentifier,
    sourceDate: row.sourceDate,
    retrievedAt: row.retrievedAt.toISOString(),
    regionalBasis: row.regionalBasis,
    confidence: row.confidence,
    researchNotes: row.researchNotes,
    provenanceStatus: row.provenanceStatus,
    reviewStatus: row.reviewStatus,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewNotes: row.reviewNotes,
    promotedAt: row.promotedAt ? row.promotedAt.toISOString() : null,
    promotedByUserId: row.promotedByUserId,
    promotedCostItemId: row.promotedCostItemId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function catalogField(sort: string, allowed: Record<string, string>): string {
  const field = allowed[sort];
  if (!field) throw new ApiError(400, `Unsupported catalog sort field: ${sort}`);
  return field;
}