const COSTBOOK_RESEARCH_CODE_PREFIX = "RC-";

/**
 * Generate the deterministic Cost Item code for a promoted research candidate.
 * Keep the full candidate UUID: truncating it creates avoidable collisions
 * against CostItem's organization-scoped unique code constraint.
 */
export function candidateCostItemCode(candidateId: string): string {
  return `${COSTBOOK_RESEARCH_CODE_PREFIX}${candidateId.toUpperCase()}`;
}
