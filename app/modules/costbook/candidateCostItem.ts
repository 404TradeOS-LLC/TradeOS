import { z } from "zod";
import { costDataProvenanceStatus } from "./provenance";

/**
 * The first governed contract for a researched cost-item candidate on its
 * way toward the relational Costbook, per the target architecture:
 *
 *   research/source evidence -> candidate -> normalization -> provenance +
 *   timestamp + confidence -> validation/review -> approved production
 *   Costbook item -> Knowledge Engine index/export
 *
 * This module is a validation/type contract only. It defines no database
 * model, no Prisma schema, no route, and no service that writes anything.
 * A candidate becomes eligible for promotion into the live `CostItem`
 * catalog (app/modules/cost-database, app/prisma/schema.prisma) only
 * through a separate, explicitly reviewed implementation that calls
 * isEligibleForCostbookPromotion() below as its gate — nothing in this
 * module can mark a candidate "approved" on its own, by AI generation or
 * otherwise. See docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md
 * for the full pipeline this contract is the first slice of.
 */

/**
 * candidate -> needs-review -> approved | rejected. Every candidate starts
 * as "candidate"; nothing in this module advances that status. A caller
 * (a future reviewed ingestion service, never this contract) is
 * responsible for recording reviewedBy/reviewedAt alongside any
 * "approved"/"rejected" transition, and costbookResearchCandidateSchema
 * enforces that pairing at parse time.
 */
export const costbookCandidateReviewStatus = ["candidate", "needs-review", "approved", "rejected"] as const;
export type CostbookCandidateReviewStatus = (typeof costbookCandidateReviewStatus)[number];

/**
 * Qualitative confidence bucket for a researched value, distinct from the
 * Knowledge Engine's existing numeric confidenceScore (schemas/cost-item.schema.json,
 * a 0-1 float). A candidate is a research artifact, not yet a scored
 * corpus entry, so a coarser bucket avoids implying false numeric
 * precision about a number nobody has reviewed yet.
 */
export const costbookCandidateConfidence = ["low", "medium", "high"] as const;
export type CostbookCandidateConfidence = (typeof costbookCandidateConfidence)[number];

const costOptional = z.number().finite().nonnegative().optional();

const isoCalendarDate = z.string().trim().refine(
  (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  },
  "must be a valid ISO calendar date"
);

const isoTimestamp = z.string().trim().datetime({ offset: true });

export const costbookResearchCandidateSchema = z
  .object({
    // --- What the item is ---
    trade: z.string().trim().min(1, "trade is required"),
    category: z.string().trim().min(1, "category is required"),
    itemName: z.string().trim().min(1, "itemName is required"),
    description: z.string().trim().min(1).optional(),
    unitOfMeasure: z.string().trim().min(1, "unitOfMeasure is required"),

    // --- Observed cost, as a range where the source supports one ---
    materialCostLow: costOptional,
    materialCostTypical: z.number().finite().nonnegative(),
    materialCostHigh: costOptional,
    laborHours: costOptional,
    laborRateAssumption: costOptional,
    equipmentCost: z.number().finite().nonnegative().default(0),

    // --- Provenance: every candidate must be traceable to something ---
    sourceName: z.string().trim().min(1, "sourceName is required"),
    sourceUrl: z.string().trim().url().optional(),
    sourceIdentifier: z.string().trim().min(1).optional(),
    sourceDate: isoCalendarDate,
    retrievedAt: isoTimestamp,
    regionalBasis: z.string().trim().min(1, "regionalBasis is required"),
    confidence: z.enum(costbookCandidateConfidence),
    researchNotes: z.string().trim().optional(),

    // --- Trust/lifecycle state ---
    provenanceStatus: z.enum(costDataProvenanceStatus).default("unverified-legacy"),
    reviewStatus: z.enum(costbookCandidateReviewStatus).default("candidate"),
    reviewedBy: z.string().trim().min(1).optional(),
    reviewedAt: isoTimestamp.optional(),
    reviewNotes: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.sourceUrl && !data.sourceIdentifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A candidate must carry either sourceUrl or sourceIdentifier so the price is traceable.",
        path: ["sourceUrl"],
      });
    }

    if (data.materialCostLow !== undefined && data.materialCostLow > data.materialCostTypical) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "materialCostLow must not exceed materialCostTypical.",
        path: ["materialCostLow"],
      });
    }
    if (data.materialCostHigh !== undefined && data.materialCostHigh < data.materialCostTypical) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "materialCostHigh must not be below materialCostTypical.",
        path: ["materialCostHigh"],
      });
    }

    if (
      (data.reviewStatus === "approved" || data.reviewStatus === "rejected") &&
      (!data.reviewedBy || !data.reviewedAt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An approved or rejected candidate must record reviewedBy and reviewedAt.",
        path: ["reviewedBy"],
      });
    }
  });

export type CostbookResearchCandidate = z.infer<typeof costbookResearchCandidateSchema>;

export function parseCostbookResearchCandidate(input: unknown): CostbookResearchCandidate {
  return costbookResearchCandidateSchema.parse(input);
}

export function safeParseCostbookResearchCandidate(input: unknown) {
  return costbookResearchCandidateSchema.safeParse(input);
}

/**
 * The single gate a future ingestion service must call before copying a
 * candidate's fields into a real Prisma CostItem/Material/LaborRate write.
 * Returns true only when a named human reviewer recorded an "approved"
 * outcome — never because a candidate merely exists, was AI-generated, or
 * has high confidence/documented provenance. Confidence and provenance
 * describe the research; they are not a substitute for review.
 */
export function isEligibleForCostbookPromotion(candidate: CostbookResearchCandidate): boolean {
  const validatedCandidate = costbookResearchCandidateSchema.safeParse(candidate);
  if (!validatedCandidate.success) return false;

  return (
    validatedCandidate.data.reviewStatus === "approved" &&
    Boolean(validatedCandidate.data.reviewedBy && validatedCandidate.data.reviewedBy.trim().length > 0) &&
    Boolean(validatedCandidate.data.reviewedAt && validatedCandidate.data.reviewedAt.trim().length > 0)
  );
}
