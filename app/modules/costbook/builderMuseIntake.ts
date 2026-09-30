import { z } from "zod";
import type { CreateCandidateInput } from "./candidateCostItemService";

/**
 * BuilderMuse is treated as prepared research intake, not trusted production
 * pricing. The supplied workbook has useful normalized values, but its material
 * rows do not carry enough provenance to create Costbook research candidates
 * without a separate verification step (exact source date, geography, SKU and
 * evidence URL/quote).
 */

const calendarMonthSchema = z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "period must be YYYY-MM with a valid month");
const nonPlaceholderSchema = z.string().trim().min(1).refine(
  (value) => !/^(not specified|unknown|n\/a)$/i.test(value),
  "verified provenance cannot use placeholder values"
);

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
  pricePeriod: calendarMonthSchema,
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
  period: calendarMonthSchema,
  source: z.string().trim().min(1),
  costbookUse: z.literal("ESCALATION REFERENCE ONLY"),
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

  blockers.push("missing-exact-source-date");

  if (/^(not specified|unknown|n\/a)$/i.test(row.geography)) {
    blockers.push("missing-local-geography");
  }
  if (!row.supplierSku?.trim() || /^(not specified|unknown|n\/a)$/i.test(row.supplierSku)) {
    blockers.push("missing-supplier-sku");
  }

  blockers.push("missing-source-evidence");

  return { row, blockers, eligibleForCandidateCreation: blockers.length === 0 };
}

export const verifiedBuilderMuseProvenanceSchema = z.object({
  sourceDate: z.string().trim().date(),
  retrievedAt: z.string().trim().datetime({ offset: true }),
  regionalBasis: nonPlaceholderSchema,
  supplierSku: nonPlaceholderSchema,
  evidenceUrl: z.string().trim().url().optional(),
  evidenceQuote: z.string().trim().min(1).optional(),
  sourceName: z.string().trim().min(1),
}).strict().refine(
  (value) => Boolean(value.evidenceUrl || value.evidenceQuote),
  { message: "verified provenance requires evidenceUrl or evidenceQuote" }
);

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

  const researchNotes = [
    `Prepared from ${row.sourceFile} row ${row.sourceRow}.`,
    `Original vendor/source label: ${row.vendorOrSource}.`,
    `Original price period: ${row.pricePeriod}.`,
    `Original source price unit: ${row.sourcePriceUnit}; normalized unit cost: ${row.normalizedUnitCost}.`,
    provenance.evidenceQuote ? `Verified primary evidence quote: ${provenance.evidenceQuote}.` : undefined,
    "Candidate only: canonical Costbook promotion still requires named-human approval.",
  ].filter((note): note is string => Boolean(note)).join(" ");

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
    researchNotes,
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
