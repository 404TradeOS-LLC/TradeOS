import { prisma } from "../../db/client";
import { hasPermission } from "../../domain";
import type { AuthContext } from "../../backend/auth/context";
import { buildJonesAndSonsTerreHauteCandidates } from "./jonesAndSonsTerreHaute";
import { CostbookCandidateService, type CandidateCostItemDTO, type CreateCandidateInput } from "./candidateCostItemService";

/**
 * Stage 2 ingestion for the one governed real-source slice this pipeline has
 * actually run end to end: the two Jones & Sons Terre Haute branch-verified
 * aggregate materials (see jonesAndSonsTerreHaute.ts and
 * docs/reports/JONES_AND_SONS_TERRE_HAUTE_INGESTION_2026-09-12.md).
 *
 * This module deliberately submits only `buildJonesAndSonsTerreHauteCandidates()`
 * - the branch-verified, confidence:"high" records - never
 * `buildJonesAndSonsObservedCandidates()`'s unconfirmed-branch records. An
 * operator who wants the lower-confidence records reviewed too can still
 * create them by hand through the existing POST /costbook/candidates route;
 * this ingestion path exists to prove the trusted, source-backed case, not
 * to bulk-load everything the corpus contains.
 *
 * Like every other ingestion path in this pipeline: this creates
 * `CostbookResearchCandidate` rows only, through the canonical
 * `CostbookCandidateService.create()` - never a direct Material/CostItem
 * write - and never reviews or promotes anything. A named human with
 * costbook.manage must still make that decision.
 */

export interface JonesAndSonsIngestionResult {
  created: CandidateCostItemDTO[];
  /** Candidates skipped because this organization already has one with the same sourceIdentifier. */
  skipped: Array<{ sourceIdentifier: string; existingCandidateId: string }>;
}

/**
 * Ingests the Terre Haute branch-verified Jones & Sons records for one
 * organization. Idempotent by (orgId, sourceIdentifier): re-running this
 * against an organization that already has a candidate for a given supplier
 * SKU never creates a duplicate, regardless of that candidate's review
 * state - a candidate a reviewer already rejected must not silently
 * reappear as a fresh, re-approvable row.
 *
 * Requires costbook.write, matching the permission the API route enforces
 * for POST /costbook/candidates. This check is defense-in-depth: the
 * database's own costbook_research_candidates_write_policy independently
 * requires owner/admin (current_app_can_manage_costbook()) for the insert,
 * so an under-permissioned actor fails closed at the database layer even if
 * this check were bypassed.
 */
export async function ingestJonesAndSonsTerreHauteCandidates(
  auth: AuthContext,
  options: { retrievedAt?: string; loggedDate?: string } = {}
): Promise<JonesAndSonsIngestionResult> {
  if (!hasPermission(auth.role, "costbook.write")) {
    throw new Error(
      `Role "${auth.role}" does not have costbook.write; cannot submit Costbook research candidates for organization ${auth.orgId}.`
    );
  }

  const service = new CostbookCandidateService();
  const candidates: CreateCandidateInput[] = buildJonesAndSonsTerreHauteCandidates(options);

  const result: JonesAndSonsIngestionResult = { created: [], skipped: [] };

  for (const candidate of candidates) {
    const sourceIdentifier = candidate.sourceIdentifier;
    if (sourceIdentifier) {
      const existing = await prisma.costbookResearchCandidate.findFirst({
        where: { orgId: auth.orgId, sourceIdentifier },
        select: { id: true },
      });
      if (existing) {
        result.skipped.push({ sourceIdentifier, existingCandidateId: existing.id });
        continue;
      }
    }

    result.created.push(await service.create(auth, candidate));
  }

  return result;
}
