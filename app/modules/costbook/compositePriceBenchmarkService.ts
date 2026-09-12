import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db/client";
import type { AuthContext } from "../../backend/auth/context";

export const compositeBenchmarkReviewStatuses = ["reference", "needs-review", "reviewed", "rejected"] as const;

const finiteNonNegative = z.number().finite().nonnegative();

export const compositePriceBenchmarkInputSchema = z.object({
  sourceName: z.string().trim().min(1).max(300),
  sourceIdentifier: z.string().trim().min(1).max(400).optional(),
  sourceYear: z.number().int().min(1900).max(2200),
  sourceUrl: z.string().trim().url().optional(),
  sourceFile: z.string().trim().min(1).max(500).optional(),
  sourceRow: z.number().int().positive().optional(),
  retrievedAt: z.string().trim().datetime({ offset: true }).optional(),
  section: z.string().trim().min(1).max(120).optional(),
  itemCode: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  unitOfMeasure: z.string().trim().min(1).max(40),
  lowPrice: finiteNonNegative.optional(),
  weightedAvgPrice: finiteNonNegative,
  highPrice: finiteNonNegative.optional(),
  sourceQuantity: finiteNonNegative.optional(),
  totalExtended: finiteNonNegative.optional(),
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
    .slice(0, 80);
  return `${sourceKey}-${row.sourceYear}-${row.itemCode}`;
}

/**
 * Persists composite installed-price evidence as reference/history only.
 * This service intentionally has no path to Material, LaborRate, Equipment,
 * CostItem, estimate, proposal, invoice, or customer bill-rate tables.
 */
export class CompositePriceBenchmarkService {
  async importRows(auth: AuthContext, inputRows: unknown[]): Promise<CompositeBenchmarkImportResult> {
    const rows = inputRows.map((row) => compositePriceBenchmarkInputSchema.parse(row));
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
