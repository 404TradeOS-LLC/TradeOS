import { Prisma } from "@prisma/client";
import { basePrisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { hasPermission } from "../../domain";
import type { AuthContext } from "../../backend/auth/context";
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
        select: { id: true },
      });
      if (existing) return { kind: "existing" as const, id: existing.id };
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
