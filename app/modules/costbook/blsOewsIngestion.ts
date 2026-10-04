import { Prisma } from "@prisma/client";
import { basePrisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { hasPermission } from "../../domain";
import type { AuthContext } from "../../backend/auth/context";
import { ApiError } from "../../backend/middleware/errorHandler";
import { buildTerreHauteBlsOewsLaborCandidates } from "./blsOewsTerreHaute";
import { CostbookCandidateService, type CandidateCostItemDTO } from "./candidateCostItemService";

export interface BlsOewsIngestionResult {
  created: CandidateCostItemDTO[];
  skipped: Array<{ sourceIdentifier: string; existingCandidateId: string }>;
}

/**
 * Submit the verified Terre Haute OEWS benchmark slice to the existing
 * Costbook research-review queue. This never creates or updates LaborRate:
 * OEWS employee wages are evidence, not an organization loaded cost or bill
 * rate. Human review and a later organization-specific labor-pricing step
 * remain required.
 */
export async function ingestTerreHauteBlsOewsCandidates(
  auth: AuthContext,
  retrievedAt: string = new Date().toISOString()
): Promise<BlsOewsIngestionResult> {
  if (!hasPermission(auth.role, "costbook.write")) {
    throw new Error(
      `Role "${auth.role}" does not have costbook.write; cannot submit BLS OEWS Costbook candidates for organization ${auth.orgId}.`
    );
  }

  const service = new CostbookCandidateService();
  const result: BlsOewsIngestionResult = { created: [], skipped: [] };

  for (const candidate of buildTerreHauteBlsOewsLaborCandidates(retrievedAt)) {
    const sourceIdentifier = candidate.sourceIdentifier;
    if (!sourceIdentifier) {
      result.created.push(await service.create(auth, candidate));
      continue;
    }

    const outcome = await runInDatabaseTransaction(basePrisma, async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`costbook-bls-oews-ingest:${auth.orgId}:${sourceIdentifier}`}, 0))`
      );
      const existing = await tx.costbookResearchCandidate.findFirst({
        where: { orgId: auth.orgId, sourceIdentifier },
        select: {
          id: true,
          trade: true,
          category: true,
          itemName: true,
          description: true,
          unitOfMeasure: true,
          materialCostLow: true,
          materialCostTypical: true,
          materialCostHigh: true,
          laborHours: true,
          laborRateAssumption: true,
          equipmentCost: true,
          sourceName: true,
          sourceUrl: true,
          sourceIdentifier: true,
          sourceDate: true,
          regionalBasis: true,
          confidence: true,
          researchNotes: true,
          provenanceStatus: true,
        },
      });
      if (existing) {
        if (!blsOewsCandidateReplayMatches(existing, candidate)) {
          throw new ApiError(
            409,
            `BLS OEWS candidate ${sourceIdentifier} already exists with different source evidence; use a new source identifier for revised evidence`
          );
        }
        return { kind: "existing" as const, id: existing.id };
      }
      const created = await new CostbookCandidateService(tx).create(auth, candidate);
      return { kind: "created" as const, candidate: created };
    });

    if (outcome.kind === "existing") {
      result.skipped.push({ sourceIdentifier, existingCandidateId: outcome.id });
    } else {
      result.created.push(outcome.candidate);
    }
  }

  return result;
}


const BLS_REPLAY_FIELDS = [
  "trade",
  "category",
  "itemName",
  "description",
  "unitOfMeasure",
  "materialCostLow",
  "materialCostTypical",
  "materialCostHigh",
  "laborHours",
  "laborRateAssumption",
  "equipmentCost",
  "sourceName",
  "sourceUrl",
  "sourceIdentifier",
  "sourceDate",
  "regionalBasis",
  "confidence",
  "researchNotes",
  "provenanceStatus",
] as const;

/**
 * Idempotent BLS replay comparison. retrievedAt is intentionally excluded:
 * re-fetching the same published evidence later must not create a conflict.
 */
export function blsOewsCandidateReplayMatches(existing: object, candidate: object): boolean {
  const left = existing as Record<string, unknown>;
  const right = candidate as Record<string, unknown>;
  return BLS_REPLAY_FIELDS.every(
    (field) => comparableBlsEvidenceValue(left[field]) === comparableBlsEvidenceValue(right[field])
  );
}

function comparableBlsEvidenceValue(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber?: unknown }).toNumber === "function"
  ) {
    return Number((value as { toNumber: () => number }).toNumber()).toString();
  }
  if (typeof value === "number") return Number(value).toString();
  return String(value);
}
