/**
 * Generates app/modules/costbook/abcSkuMaterialActivationBatch.ts — the
 * REVIEW-ONLY operator-gate proposal mapping every seeded ABC Supply
 * product (584 rows of the 47802 corpus) to a candidate canonical Costbook
 * material.
 *
 * This generator is deterministic and reads only checked-in corpus data:
 *   - app/modules/costbook/supplierPrices47802.ts (ABC_SUPPLY rows)
 *   - app/modules/costbook/canonicalMaterialCodes.ts (classification verdicts)
 *   - app/modules/costbook/canonicalProductMatcher.ts (pilot unit reference)
 *
 * It never writes to a database, never calls the ABC API, and never marks a
 * row approved. Activation remains the operator's separate decision through
 * the single-item gate (app/scripts/activate-abc-supply-material.ts).
 *
 * Run: npm run costbook:generate-abc-activation-batch
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SUPPLIER_PRICES_47802 } from "../modules/costbook/supplierPrices47802";
import { CANONICAL_MATERIAL_CODES } from "../modules/costbook/canonicalMaterialCodes";
import {
  COSTBOOK_PILOT_CANONICAL_ITEMS,
  normalizeCostbookUnit,
} from "../modules/costbook/canonicalProductMatcher";
import { normalizeSourceUnit } from "../modules/costbook/supplierPrices47802Seed";

const OUTPUT_PATH = resolve(
  __dirname,
  "../modules/costbook/abcSkuMaterialActivationBatch.ts"
);

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "with", "for", "in", "x", "by", "per",
]);

function stem(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss")
    ? word.slice(0, -1)
    : word;
}

function tokenize(text: string, exclude?: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)) {
    if (!raw) continue;
    const token = stem(raw);
    if (STOPWORDS.has(token)) continue;
    if (exclude?.has(token)) continue;
    out.add(token);
  }
  return out;
}

/** Dice token-overlap between product name and canonical material name. */
function nameMatchScore(productName: string, materialName: string, brand: string): number {
  const productTokens = tokenize(productName, tokenize(brand));
  const materialTokens = tokenize(materialName);
  if (productTokens.size === 0 || materialTokens.size === 0) return 0;
  let hits = 0;
  for (const token of productTokens) if (materialTokens.has(token)) hits++;
  return Math.round(((2 * hits) / (productTokens.size + materialTokens.size)) * 1000) / 1000;
}

interface BatchRow {
  productKey: string;
  sku: string | null;
  productName: string;
  brand: string;
  sourceUnit: string;
  stockingUnit: string;
  workbookCanonicalKey: string;
  candidateCanonicalMaterialKey: string | null;
  candidateMaterialName: string | null;
  nameMatchScore: number;
  nameEvidence: "STRONG" | "MODERATE" | "WEAK";
  classificationStatus: "mapped" | "ambiguous" | "unmapped";
  classificationUnspsc: string | null;
  unitVerdict: "COMPATIBLE" | "CONFLICT" | "UNKNOWN";
  unitEvidence: string;
  disposition: "PROPOSED" | "REVIEW" | "UNMAPPED";
  reviewReasons: string[];
  sourceUrl: string;
}

function buildRows(): BatchRow[] {
  const abcRows = SUPPLIER_PRICES_47802.filter((row) => row.supplierCode === "ABC_SUPPLY");

  // Within-key unit consistency across the ABC rows themselves.
  const unitsByKey = new Map<string, Set<string>>();
  for (const row of abcRows) {
    const unit = normalizeSourceUnit(row.unit);
    const set = unitsByKey.get(row.canonicalKey) ?? new Set<string>();
    set.add(unit);
    unitsByKey.set(row.canonicalKey, set);
  }

  // Governed pilot items bridged from a static-corpus key carry a reference unit.
  const pilotByStaticKey = new Map(
    COSTBOOK_PILOT_CANONICAL_ITEMS.filter((item) => item.staticCanonicalKey).map((item) => [
      item.staticCanonicalKey as string,
      item,
    ])
  );

  return abcRows.map((row) => {
    const stockingUnit = normalizeSourceUnit(row.unit);
    const score = nameMatchScore(row.productName, row.materialName, row.brand);
    const nameEvidence = score >= 0.4 ? "STRONG" : score >= 0.25 ? "MODERATE" : "WEAK";

    const classification = CANONICAL_MATERIAL_CODES[row.canonicalKey];
    const classificationStatus = classification?.status ?? "unmapped";
    const classificationUnspsc = classification?.unspsc ?? null;

    const keyUnits = [...(unitsByKey.get(row.canonicalKey) ?? [])].sort();
    const pilot = pilotByStaticKey.get(row.canonicalKey);
    let unitVerdict: BatchRow["unitVerdict"];
    let unitEvidence: string;
    if (keyUnits.length > 1) {
      unitVerdict = "CONFLICT";
      unitEvidence =
        `Seed rows for ${row.canonicalKey} disagree on stocking unit (${keyUnits.join(", ")}); ` +
        "the operator must establish the provider stocking unit before activation.";
    } else if (pilot) {
      const normalized = normalizeCostbookUnit(stockingUnit);
      if (normalized === pilot.normalizedUnit) {
        unitVerdict = "COMPATIBLE";
        unitEvidence =
          `Workbook stocking unit ${stockingUnit} matches the governed pilot unit ` +
          `${pilot.normalizedUnit} for ${pilot.canonicalMaterialKey}; provider verification ` +
          "is still required at activation (PR #708).";
      } else {
        unitVerdict = "CONFLICT";
        unitEvidence =
          `Workbook stocking unit ${stockingUnit} (normalized ${normalized}) differs from the ` +
          `governed pilot unit ${pilot.normalizedUnit} for ${pilot.canonicalMaterialKey}; ` +
          "unit conversion or a different candidate must be resolved by the operator.";
      }
    } else {
      unitVerdict = "UNKNOWN";
      unitEvidence =
        `Workbook stocking unit ${stockingUnit} is consistent across all seed rows for this ` +
        "canonical key, but no governed reference unit exists and the provider stocking unit " +
        "has not been verified against the ABC catalog (PR #708); operator verification required.";
    }

    const reviewReasons: string[] = [];
    let candidateCanonicalMaterialKey: string | null = row.canonicalKey;
    let candidateMaterialName: string | null = row.materialName;
    let disposition: BatchRow["disposition"];

    if (nameEvidence === "WEAK") {
      disposition = "UNMAPPED";
      candidateCanonicalMaterialKey = null;
      candidateMaterialName = null;
      reviewReasons.push(
        `Name evidence is WEAK (token-overlap ${score} < 0.25) between the ABC product name and ` +
          `the workbook material name; no candidate is proposed. Workbook key ${row.canonicalKey} ` +
          "is retained on this row for reviewer context only."
      );
    } else {
      if (nameEvidence === "MODERATE") {
        reviewReasons.push(
          `Name evidence is MODERATE (token-overlap ${score}); identity must be confirmed by the operator.`
        );
      }
      if (!row.sku) {
        reviewReasons.push(
          "No SKU in the seed source; the activation gate requires an exact SKU, so the SKU " +
            "must be confirmed from the ABC catalog before activation."
        );
      }
      if (unitVerdict === "CONFLICT") {
        reviewReasons.push(`Stocking-unit conflict: ${unitEvidence}`);
      }
      disposition = reviewReasons.length > 0 ? "REVIEW" : "PROPOSED";
    }

    return {
      productKey: row.productKey,
      sku: row.sku || null,
      productName: row.productName,
      brand: row.brand,
      sourceUnit: row.unit,
      stockingUnit,
      workbookCanonicalKey: row.canonicalKey,
      candidateCanonicalMaterialKey,
      candidateMaterialName,
      nameMatchScore: score,
      nameEvidence,
      classificationStatus,
      classificationUnspsc,
      unitVerdict,
      unitEvidence,
      disposition,
      reviewReasons,
      sourceUrl: row.sourceUrl,
    };
  });
}

function render(rows: BatchRow[]): string {
  const count = (d: BatchRow["disposition"]) => rows.filter((r) => r.disposition === d).length;
  const unitCount = (v: BatchRow["unitVerdict"]) => rows.filter((r) => r.unitVerdict === v).length;
  const header = `/**
 * ABC SKU -> canonical Costbook material ACTIVATION PROPOSAL BATCH.
 *
 * REVIEW-ONLY. Nothing in this file activates a Material, creates database
 * rows, or approves a price. It is the operator-gate proposal for the 584
 * seeded ABC Supply products in the Terre Haute 47802 corpus: the supplier
 * price sync proposes nothing today because no Material rows carry ABC SKUs,
 * and PR #705 established that new Materials require explicit reviewed
 * activation. Activation stays a separate operator decision per product
 * through the single-item gate (app/scripts/activate-abc-supply-material.ts).
 *
 * GENERATED by app/scripts/generate-abc-activation-batch.ts from checked-in
 * corpus data only. Do not edit rows by hand; regenerate instead.
 *
 * Method (deterministic, no invented data):
 * - Candidate = the workbook canonicalKey/materialName each ABC product
 *   already carries in supplierPrices47802.ts. A candidate is proposed only
 *   when name evidence supports it; otherwise the row is UNMAPPED and the
 *   workbook key is kept for reviewer context.
 * - Name evidence = Dice token-overlap between the ABC product name (brand
 *   tokens removed) and the canonical material name, with light stemming.
 *   STRONG >= 0.4 (the acceptance band used for pricedAssemblies matching),
 *   MODERATE 0.25-0.4, WEAK < 0.25.
 * - Classification = CANONICAL_MATERIAL_CODES verdict for the candidate key
 *   (UNSPSC v8.1201 where mapped). Codes narrow candidates; they never alone
 *   establish identity.
 * - Unit verdict follows PR #708: a stocking unit counts as verified only
 *   against a governed reference or the live provider response. Workbook
 *   units are unverified, so most rows are UNKNOWN (consistent within their
 *   canonical key, but not provider-verified); disagreements are CONFLICT.
 *
 * Provenance: every row derives from app/modules/costbook/
 * supplierPrices47802.ts (Billy's supplier costbook workbooks, Google Drive,
 * observed 2026-09-13; row observations dated 2026-09-14), Terre Haute
 * 47802, retail tier. These are dated workbook observations, NOT live ABC
 * API pricing; refresh before any quoting use.
 *
 * Batch counts: ${rows.length} rows — PROPOSED ${count("PROPOSED")}, REVIEW ${count("REVIEW")}, UNMAPPED ${count("UNMAPPED")};
 * unit verdicts — COMPATIBLE ${unitCount("COMPATIBLE")}, CONFLICT ${unitCount("CONFLICT")}, UNKNOWN ${unitCount("UNKNOWN")}.
 * Every row is approvalStatus "UNAPPROVED".
 */
export type AbcActivationDisposition = "PROPOSED" | "REVIEW" | "UNMAPPED";
export type AbcActivationUnitVerdict = "COMPATIBLE" | "CONFLICT" | "UNKNOWN";
export type AbcActivationNameEvidence = "STRONG" | "MODERATE" | "WEAK";

export interface AbcSkuMaterialActivationRow {
  /** Seeded supplier product key (join key to SUPPLIER_PRICES_47802 and the DB seed). */
  productKey: string;
  /** Exact ABC SKU from the seed source, or null when the source carries none. */
  sku: string | null;
  productName: string;
  brand: string;
  /** Price/stocking unit exactly as recorded in the seed source (e.g. "$/SQ"). */
  sourceUnit: string;
  /** Stocking unit with the price prefix removed (e.g. "SQ"). */
  stockingUnit: string;
  /** Canonical key the source workbook assigned; provenance, not identity proof. */
  workbookCanonicalKey: string;
  /** Proposed candidate canonical material key, or null when UNMAPPED. */
  candidateCanonicalMaterialKey: string | null;
  candidateMaterialName: string | null;
  /** Dice token-overlap score (0-1) between product name and material name. */
  nameMatchScore: number;
  nameEvidence: AbcActivationNameEvidence;
  /** CANONICAL_MATERIAL_CODES verdict for the candidate key. */
  classificationStatus: "mapped" | "ambiguous" | "unmapped";
  classificationUnspsc: string | null;
  /** PR #708 stocking-unit verdict; UNKNOWN means not provider-verified. */
  unitVerdict: AbcActivationUnitVerdict;
  unitEvidence: string;
  disposition: AbcActivationDisposition;
  /** Blocking or cautionary reasons the operator must resolve; empty for PROPOSED. */
  reviewReasons: readonly string[];
  sourceUrl: string;
  /** Proposal state only. Activation is a separate operator decision. */
  approvalStatus: "UNAPPROVED";
  /** Where this row came from; dated workbook observation, not live pricing. */
  provenance: string;
}

export const ABC_ACTIVATION_BATCH_PROVENANCE =
  "app/modules/costbook/supplierPrices47802.ts (ABC_SUPPLY, Terre Haute 47802, retail tier); " +
  "workbook observation dated 2026-09-14; NOT live ABC API pricing";

export const ABC_SKU_MATERIAL_ACTIVATION_SUMMARY = {
  totalRows: ${rows.length},
  proposed: ${count("PROPOSED")},
  review: ${count("REVIEW")},
  unmapped: ${count("UNMAPPED")},
  unitCompatible: ${unitCount("COMPATIBLE")},
  unitConflict: ${unitCount("CONFLICT")},
  unitUnknown: ${unitCount("UNKNOWN")},
} as const;

export const ABC_SKU_MATERIAL_ACTIVATION_BATCH: readonly AbcSkuMaterialActivationRow[] = [
`;
  const body = rows
    .map((row) => {
      const { sourceUrl, ...rest } = row;
      const fields = Object.entries({ ...rest, sourceUrl })
        .map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`)
        .join(",\n");
      return `  {\n${fields},\n    approvalStatus: "UNAPPROVED",\n    provenance: ABC_ACTIVATION_BATCH_PROVENANCE,\n  }`;
    })
    .join(",\n");
  return `${header}${body},\n];\n`;
}

const rows = buildRows();
writeFileSync(OUTPUT_PATH, render(rows));
const byDisposition = (d: BatchRow["disposition"]) => rows.filter((r) => r.disposition === d).length;
console.log(
  `Wrote ${rows.length} rows: PROPOSED=${byDisposition("PROPOSED")} REVIEW=${byDisposition("REVIEW")} UNMAPPED=${byDisposition("UNMAPPED")}`
);
