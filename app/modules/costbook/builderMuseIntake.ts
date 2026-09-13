import { z } from "zod";
import type { CreateCandidateInput } from "./candidateCostItemService";

/**
 * BuilderMuse is treated as prepared research intake, not trusted production
 * pricing. The supplied workbook has useful normalized values, but its material
 * rows do not carry enough provenance to create Costbook research candidates
 * without a separate verification step (exact source date, geography, SKU and
 * evidence URL/quote).
 */

export const builderMuseMaterialRowSchema = z.object({
  externalId: z.string().trim().min(1),
  itemCode: z.string().trim().min(1),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1),
  costbookUnit: z.string().trim().min(1),
  sourceValue: z.number().finite().nonnegative(),
  packageQuantity: z.number().finite().positive().nullable().optional(),
  normalizedUnitCost: z.number().finite().nonnegative(),
  sourcePriceUnit: z.string().trim().min(1),
  pricePeriod: z.string().trim().regex(/^\d{4}-\d{2}$/, "pricePeriod must be YYYY-MM"),
  geography: z.string().trim().min(1),
  vendorOrSource: z.string().trim().min(1),
  supplierSku: z.string().trim().min(1).nullable().optional(),
  importStatus: z.string().trim().min(1),
  reviewReason: z.string().trim().optional(),
  sourceFile: z.string().trim().min(1),
  sourceRow: z.number().int().positive(),
}).strict();

export type BuilderMuseMaterialRow = z.infer<typeof builderMuseMaterialRowSchema>;

export const builderMusePriceIndexRowSchema = z.object({
  category: z.string().trim().min(1),
  seriesId: z.string().trim().min(1),
  seriesName: z.string().trim().min(1),
  indexValue: z.number().finite().positive(),
  period: z.string().trim().min(1),
  source: z.string().trim().min(1),
  costbookUse: z.string().trim().min(1),
}).passthrough();

export type BuilderMusePriceIndexRow = z.infer<typeof builderMusePriceIndexRowSchema>;

export const builderMuseIntakeBlockers = [
  "missing-exact-source-date",
  "missing-local-geography",
  "missing-supplier-sku",
  "missing-source-evidence",
] as const;

export type BuilderMuseIntakeBlocker = (typeof builderMuseIntakeBlockers)[number];

export interface BuilderMuseMaterialAssessment {
  row: BuilderMuseMaterialRow;
  blockers: BuilderMuseIntakeBlocker[];
  eligibleForCandidateCreation: boolean;
}

export function assessBuilderMuseMaterialRow(input: unknown): BuilderMuseMaterialAssessment {
  const row = builderMuseMaterialRowSchema.parse(input);
  const blockers: BuilderMuseIntakeBlocker[] = [];

  // A month-level period is useful context, but the canonical candidate
  // contract requires a real calendar date. Never invent the first/last day.
  blockers.push("missing-exact-source-date");

  if (/^(not specified|unknown|n\/a)$/i.test(row.geography)) {
    blockers.push("missing-local-geography");
  }
  if (!row.supplierSku?.trim()) {
    blockers.push("missing-supplier-sku");
  }

  // The prepared workbook identifies a vendor/source by name but does not
  // provide a quote URL, product URL, receipt, invoice, or other primary
  // evidence locator. A sourceIdentifier derived from externalId is useful for
  // deduplication but is not evidence of the observed price.
  blockers.push("missing-source-evidence");

  return { row, blockers, eligibleForCandidateCreation: blockers.length === 0 };
}

export const verifiedBuilderMuseProvenanceSchema = z.object({
  sourceDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  retrievedAt: z.string().trim().datetime({ offset: true }),
  regionalBasis: z.string().trim().min(1),
  supplierSku: z.string().trim().min(1),
  evidenceUrl: z.string().trim().url(),
  sourceName: z.string().trim().min(1),
}).strict();

export type VerifiedBuilderMuseProvenance = z.infer<typeof verifiedBuilderMuseProvenanceSchema>;

/**
 * Conversion is deliberately impossible without separately verified
 * provenance. This function does not persist anything; callers must still use
 * CostbookCandidateService.create(), which creates an unapproved candidate and
 * keeps the named-human review/promotion boundary intact.
 */
export function toVerifiedBuilderMuseCandidate(
  input: unknown,
  provenanceInput: unknown
): CreateCandidateInput {
  const row = builderMuseMaterialRowSchema.parse(input);
  const provenance = verifiedBuilderMuseProvenanceSchema.parse(provenanceInput);

  return {
    trade: row.category,
    category: row.category,
    itemName: row.description,
    description: `${row.description} — supplier SKU ${provenance.supplierSku}`,
    unitOfMeasure: row.costbookUnit,
    materialCostTypical: row.normalizedUnitCost,
    equipmentCost: 0,
    sourceName: provenance.sourceName,
    sourceUrl: provenance.evidenceUrl,
    sourceIdentifier: `BUILDERMUSE-${row.externalId}`,
    sourceDate: provenance.sourceDate,
    retrievedAt: provenance.retrievedAt,
    regionalBasis: provenance.regionalBasis,
    confidence: "medium",
    researchNotes: [
      `Prepared from ${row.sourceFile} row ${row.sourceRow}.`,
      `Original vendor/source label: ${row.vendorOrSource}.`,
      `Original price period: ${row.pricePeriod}.`,
      `Original source price unit: ${row.sourcePriceUnit}; normalized unit cost: ${row.normalizedUnitCost}.`,
      "Candidate only: canonical Costbook promotion still requires named-human approval.",
    ].join(" "),
    provenanceStatus: "documented",
  };
}

export interface BuilderMuseEscalationReference {
  category: string;
  seriesId: string;
  seriesName: string;
  indexValue: number;
  period: string;
  source: string;
  semanticBoundary: "escalation-reference-only";
}

export function toBuilderMuseEscalationReference(input: unknown): BuilderMuseEscalationReference {
  const row = builderMusePriceIndexRowSchema.parse(input);
  return {
    category: row.category,
    seriesId: row.seriesId,
    seriesName: row.seriesName,
    indexValue: row.indexValue,
    period: row.period,
    source: row.source,
    semanticBoundary: "escalation-reference-only",
  };
}
