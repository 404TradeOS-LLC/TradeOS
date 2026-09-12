import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db/client";
import type { AuthContext } from "../../backend/auth/context";

export const compositeBenchmarkReviewStatuses = ["reference", "needs-review", "reviewed", "rejected"] as const;

const MAX_NUMERIC_14_4 = 9_999_999_999.9999;
const MAX_NUMERIC_18_4 = 99_999_999_999_999.9999;
const MAX_INT32 = 2_147_483_647;

function hasAtMostFourDecimalPlaces(value: number): boolean {
  const scaled = value * 10_000;
  return Math.abs(scaled - Math.round(scaled)) < 1e-7;
}

function boundedNumeric(max: number) {
  return z
    .number()
    .finite()
    .nonnegative()
    .max(max)
    .refine(hasAtMostFourDecimalPlaces, "must have at most four decimal places");
}

const finiteNonNegativeNumeric14_4 = boundedNumeric(MAX_NUMERIC_14_4);
const finiteNonNegativeNumeric18_4 = boundedNumeric(MAX_NUMERIC_18_4);

export const compositePriceBenchmarkInputSchema = z.object({
  sourceName: z.string().trim().min(1).max(300),
  sourceIdentifier: z.string().trim().min(1).max(400).optional(),
  sourceYear: z.number().int().min(1900).max(2200),
  sourceUrl: z.string().trim().url().optional(),
  sourceFile: z.string().trim().min(1).max(500).optional(),
  sourceRow: z.number().int().positive().max(MAX_INT32).optional(),
  retrievedAt: z.string().trim().datetime({ offset: true }).optional(),
  section: z.string().trim().min(1).max(120).optional(),
  itemCode: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  unitOfMeasure: z.string().trim().min(1).max(40),
  lowPrice: finiteNonNegativeNumeric14_4.optional(),
  weightedAvgPrice: finiteNonNegativeNumeric14_4,
  highPrice: finiteNonNegativeNumeric14_4.optional(),
  sourceQuantity: finiteNonNegativeNumeric18_4.optional(),
  totalExtended: finiteNonNegativeNumeric18_4.optional(),
  geography: z.string().trim().min(1).max(300),
  priceBasis: z.string().trim().min(1).max(500),
  catalogStatus: z.string().trim().min(1).max(120).optional(),
  reviewStatus: z.enum(compositeBenchmarkReviewStatuses).default("reference"),
}).strict().superRefine((row, ctx) => {
  if (row.lowPrice != null && row.highPrice != null && row.lowPrice > row.highPrice) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lowPrice"], message: "lowPrice must be <= highPrice" });
  }
  if (row.lowPrice != null && row.weightedAvgPrice < row.lowPrice) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weightedAvgPrice"], message: "weightedAvgPrice must be >= lowPrice" });
  }
  if (row.highPrice != null && row.weightedAvgPrice > row.highPrice) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["weightedAvgPrice"], message: "weightedAvgPrice must be <= highPrice" });
  }
});

export type CompositePriceBenchmarkInput = z.infer<typeof compositePriceBenchmarkInputSchema>;

export interface CompositeBenchmarkImportResult {
  received: number;
  upserted: number;
  batches: number;
}

const MAX_ROWS_PER_BATCH = 500;

export function buildCompositeBenchmarkSourceIdentifier(row: Pick<CompositePriceBenchmarkInput, "sourceName" | "sourceYear" | "itemCode">): string {
  const sourceKey = row.sourceName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "SOURCE";
  const sourceHash = createHash("sha256").update(row.sourceName, "utf8").digest("hex").slice(0, 12).toUpperCase();
  return `${sourceKey}-${sourceHash}-${row.sourceYear}-${row.itemCode}`;
}

function assertNoDuplicateUpsertKeys(rows: CompositePriceBenchmarkInput[]): void {
  const firstSeen = new Map<string, number>();
  rows.forEach((row, index) => {
    const key = JSON.stringify([row.sourceName, row.sourceYear, row.itemCode]);
    const prior = firstSeen.get(key);
    if (prior != null) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: [index],
          message: `duplicate composite benchmark upsert key also present at row ${prior + 1}: ${row.sourceName} / ${row.sourceYear} / ${row.itemCode}`,
        },
      ]);
    }
    firstSeen.set(key, index);
  });
}

/**
 * Persists composite installed-price evidence as reference/history only.
 * This service intentionally has no path to Material, LaborRate, Equipment,
 * CostItem, estimate, proposal, invoice, or customer bill-rate tables.
 */
export class CompositePriceBenchmarkService {
  async importRows(auth: AuthContext, inputRows: unknown[]): Promise<CompositeBenchmarkImportResult> {
    const rows = inputRows.map((row) => compositePriceBenchmarkInputSchema.parse(row));
    assertNoDuplicateUpsertKeys(rows);

    let upserted = 0;
    let batches = 0;

    for (let offset = 0; offset < rows.length; offset += MAX_ROWS_PER_BATCH) {
      const batch = rows.slice(offset, offset + MAX_ROWS_PER_BATCH);
      if (batch.length === 0) continue;

      const values = batch.map((row) => Prisma.sql`(
        ${auth.orgId}::uuid,
        ${row.sourceName},
        ${row.sourceIdentifier ?? buildCompositeBenchmarkSourceIdentifier(row)},
        ${row.sourceYear},
        ${row.sourceUrl ?? null},
        ${row.sourceFile ?? null},
        ${row.sourceRow ?? null},
        ${row.retrievedAt ? new Date(row.retrievedAt) : new Date()},
        ${row.section ?? null},
        ${row.itemCode},
        ${row.description},
        ${row.unitOfMeasure},
        ${row.lowPrice ?? null},
        ${row.weightedAvgPrice},
        ${row.highPrice ?? null},
        ${row.sourceQuantity ?? null},
        ${row.totalExtended ?? null},
        ${row.geography},
        ${row.priceBasis},
        ${row.catalogStatus ?? null},
        ${row.reviewStatus},
        ${auth.userId}::uuid
      )`);

      const affected = await prisma.$executeRaw(Prisma.sql`
        insert into costbook_composite_price_benchmarks (
          org_id,
          source_name,
          source_identifier,
          source_year,
          source_url,
          source_file,
          source_row,
          retrieved_at,
          section,
          item_code,
          description,
          unit_of_measure,
          low_price,
          weighted_avg_price,
          high_price,
          source_quantity,
          total_extended,
          geography,
          price_basis,
          catalog_status,
          review_status,
          imported_by_user_id
        ) values ${Prisma.join(values)}
        on conflict (org_id, source_name, source_year, item_code)
        do update set
          source_identifier = excluded.source_identifier,
          source_url = excluded.source_url,
          source_file = excluded.source_file,
          source_row = excluded.source_row,
          retrieved_at = excluded.retrieved_at,
          section = excluded.section,
          description = excluded.description,
          unit_of_measure = excluded.unit_of_measure,
          low_price = excluded.low_price,
          weighted_avg_price = excluded.weighted_avg_price,
          high_price = excluded.high_price,
          source_quantity = excluded.source_quantity,
          total_extended = excluded.total_extended,
          geography = excluded.geography,
          price_basis = excluded.price_basis,
          catalog_status = excluded.catalog_status,
          review_status = excluded.review_status,
          imported_by_user_id = excluded.imported_by_user_id,
          imported_at = now(),
          updated_at = now()
      `);

      upserted += Number(affected);
      batches += 1;
    }

    return { received: rows.length, upserted, batches };
  }
}
