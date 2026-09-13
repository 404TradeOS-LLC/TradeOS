import { round2 } from "../estimate-engine/formulas";
import type { KnowledgeCostItemRecord } from "../knowledge-runtime/types";
import {
  costbookResearchCandidateSchema,
  type CostbookCandidateConfidence,
  type CostbookResearchCandidate,
} from "./candidateCostItem";
import {
  DEFAULT_COST_DATA_PROVENANCE_STATUS,
  normalizeCostDataProvenanceStatus,
  type CostDataProvenanceStatus,
} from "./provenance";

/**
 * Stage 3 of docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md: the
 * normalization boundary that turns a read-only Knowledge Engine corpus
 * record into a typed Costbook promotion candidate.
 *
 * Deliberate properties, all of which the tests assert:
 *
 * - **Pure.** No Prisma, no organization, no I/O, no clock. Normalizing a
 *   record mutates nothing and is not a Costbook write. The caller decides
 *   whether to persist the result through CostbookCandidateService.create().
 * - **Fails closed.** A record missing any evidence the candidate contract
 *   requires (source, source date, retrieval timestamp, regional basis,
 *   confidence, unit, a usable cost) is reported as blocked with explicit
 *   reasons. It is never "promoted" to candidate-ready by defaulting the
 *   missing field.
 * - **Never fabricates provenance.** Source metadata is copied only when the
 *   record itself asserts it. Nothing here invents a source name, infers one
 *   from a generator filename, or back-dates a retrieval timestamp. A record
 *   whose provenance cannot be established stays "unverified-legacy", per
 *   the 2026-09-08 audit's finding that 1,795 of 1,795 canonical cost items
 *   carry no item-level source trail.
 * - **Never grants review.** The returned draft always carries the
 *   contract's default reviewStatus ("candidate"). Only an authenticated
 *   human reviewer's decision, recorded by CostbookCandidateService.review(),
 *   can advance it.
 */

/** Unit vocabulary the canonical corpus and scripts/costbook-provenance-audit.mjs already share. */
export const KNOWLEDGE_KNOWN_UNITS = ["SF", "LF", "EA", "HR", "CY", "SQ", "CF"] as const;

const KNOWN_UNIT_SET: ReadonlySet<string> = new Set<string>(KNOWLEDGE_KNOWN_UNITS);

/**
 * Why a record cannot become a candidate. Stable machine-readable codes so
 * the review UI and the corpus report can group blocked records without
 * parsing prose.
 */
export const knowledgeCandidateBlockReason = [
  "missing-trade",
  "missing-category",
  "missing-item-name",
  "missing-unit",
  "unsupported-unit",
  "missing-cost",
  "non-finite-cost",
  "negative-cost",
  "missing-source",
  "missing-source-date",
  "missing-retrieved-at",
  "missing-regional-basis",
  "missing-confidence",
  "unverified-provenance",
  "placeholder-pricing",
  "contract-rejected",
] as const;
export type KnowledgeCandidateBlockReason = (typeof knowledgeCandidateBlockReason)[number];

export interface KnowledgeCandidateClassification {
  knowledgeItemId: string;
  itemName: string;
  trade: string | null;
  category: string;
  provenanceStatus: CostDataProvenanceStatus;
  /** True only when every field the candidate contract requires is present and valid. */
  candidateReady: boolean;
  blockReasons: KnowledgeCandidateBlockReason[];
}

export type KnowledgeCandidateNormalization =
  | {
    outcome: "ready";
    classification: KnowledgeCandidateClassification;
    /**
     * A contract-valid candidate draft. Still unreviewed: reviewStatus is
     * "candidate" and no reviewer identity is attached.
     */
    candidate: CostbookResearchCandidate;
  }
  | {
    outcome: "blocked";
    classification: KnowledgeCandidateClassification;
    candidate: null;
  };

function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The Knowledge Engine stores labor/material/equipment cost separately. The
 * candidate contract's materialCostTypical is the single observed unit cost,
 * so the corpus's total unit cost is what a reviewer is actually being asked
 * to judge. round2() is the shared rounding helper cost-database,
 * assemblies-database, and knowledge-runtime already use - normalization
 * does not introduce a third rounding convention.
 */
function resolveTypicalCost(record: KnowledgeCostItemRecord): number {
  return round2(record.metadata.totalUnitCost);
}

/**
 * Classifies a single Knowledge Engine cost item without producing a
 * candidate. Used by the corpus report so counting does not depend on
 * building (and discarding) a draft for all 1,795 records.
 */
export function classifyKnowledgeCostItem(record: KnowledgeCostItemRecord): KnowledgeCandidateClassification {
  return normalizeKnowledgeCostItem(record).classification;
}

export function normalizeKnowledgeCostItem(record: KnowledgeCostItemRecord): KnowledgeCandidateNormalization {
  const blockReasons: KnowledgeCandidateBlockReason[] = [];

  const provenanceStatus = normalizeCostDataProvenanceStatus(record.metadata.provenanceStatus);

  const trade = trimmedOrNull(record.trade);
  const category = trimmedOrNull(record.category);
  const itemName = trimmedOrNull(record.name);
  const unitOfMeasure = trimmedOrNull(record.unitOfMeasure);

  if (!trade) blockReasons.push("missing-trade");
  if (!category) blockReasons.push("missing-category");
  if (!itemName) blockReasons.push("missing-item-name");

  if (!unitOfMeasure) {
    blockReasons.push("missing-unit");
  } else if (!KNOWN_UNIT_SET.has(unitOfMeasure.toUpperCase())) {
    // An unrecognized unit is not silently mapped onto a known one; a
    // reviewer must decide what "RM" or "per tree" means for this catalog.
    blockReasons.push("unsupported-unit");
  }

  const typicalCost = resolveTypicalCost(record);
  if (!Number.isFinite(typicalCost)) {
    blockReasons.push("non-finite-cost");
  } else if (typicalCost < 0) {
    blockReasons.push("negative-cost");
  } else if (typicalCost === 0) {
    // A zero total unit cost carries no priceable information; promoting it
    // would put a $0 line into a tenant's catalog.
    blockReasons.push("missing-cost");
  }

  // --- Provenance. Copied only where the record actually asserts it. ---
  const sourceName = trimmedOrNull(record.metadata.sourceName);
  const sourceUrl = trimmedOrNull(record.metadata.sourceUrl);
  const sourceIdentifier = trimmedOrNull(record.metadata.sourceIdentifier);
  const sourceDate = trimmedOrNull(record.metadata.sourceDate);
  const retrievedAt = trimmedOrNull(record.metadata.retrievedAt);
  const confidence = record.metadata.confidence;

  // The contract requires a traceable source: a name plus at least one of
  // url/identifier. Nothing here substitutes the corpus file path, the
  // generator that wrote the record, or the Knowledge Engine itself for a
  // real citation.
  if (!sourceName || (!sourceUrl && !sourceIdentifier)) blockReasons.push("missing-source");
  if (!sourceDate) blockReasons.push("missing-source-date");
  if (!retrievedAt) blockReasons.push("missing-retrieved-at");
  if (!confidence) blockReasons.push("missing-confidence");

  if (provenanceStatus === "placeholder") {
    // The source itself says the number is a stand-in (Knowledge Engine Tree
    // Service items self-label pricingStatus: "PLACEHOLDER").
    blockReasons.push("placeholder-pricing");
  } else if (provenanceStatus !== "documented") {
    blockReasons.push("unverified-provenance");
  }

  const classificationBase = {
    knowledgeItemId: record.id,
    itemName: record.name,
    trade: record.trade,
    category: record.category,
    provenanceStatus,
  };

  if (blockReasons.length > 0) {
    return {
      outcome: "blocked",
      classification: { ...classificationBase, candidateReady: false, blockReasons },
      candidate: null,
    };
  }

  // A record reaching here asserted every required field. Re-validate through
  // the contract itself rather than trusting the checks above, so the two can
  // never drift apart: the schema is the authority on what a candidate is.
  const draft = {
    trade,
    category,
    itemName,
    description: trimmedOrNull(record.description) ?? undefined,
    unitOfMeasure: unitOfMeasure!.toUpperCase(),
    materialCostTypical: typicalCost,
    laborHours: undefined,
    laborRateAssumption: undefined,
    equipmentCost: round2(record.metadata.equipmentCost),
    sourceName: sourceName!,
    sourceUrl: sourceUrl ?? undefined,
    sourceIdentifier: sourceIdentifier ?? undefined,
    sourceDate: sourceDate!,
    retrievedAt: retrievedAt!,
    // The corpus carries no per-item market/geography field. Rather than
    // presenting national research as local pricing, the basis is recorded
    // as explicitly unspecified for a reviewer to correct.
    regionalBasis: "national/default (Knowledge Engine corpus; no market specified)",
    confidence: confidence as CostbookCandidateConfidence,
    researchNotes: `Normalized from Knowledge Engine cost item ${record.id}.`,
    provenanceStatus,
    // Never carried over from the corpus: normalization cannot review.
    reviewStatus: "candidate" as const,
  };

  const parsed = costbookResearchCandidateSchema.safeParse(draft);
  if (!parsed.success) {
    return {
      outcome: "blocked",
      classification: {
        ...classificationBase,
        candidateReady: false,
        blockReasons: ["contract-rejected"],
      },
      candidate: null,
    };
  }

  return {
    outcome: "ready",
    classification: { ...classificationBase, candidateReady: true, blockReasons: [] },
    candidate: parsed.data,
  };
}

export interface KnowledgeCorpusReport {
  totalItems: number;
  documented: number;
  unverifiedLegacy: number;
  placeholder: number;
  candidateReady: number;
  blocked: number;
  /** Count of blocked records per reason; a record may contribute to several. */
  blockReasonCounts: Record<KnowledgeCandidateBlockReason, number>;
}

function emptyBlockReasonCounts(): Record<KnowledgeCandidateBlockReason, number> {
  const counts = {} as Record<KnowledgeCandidateBlockReason, number>;
  for (const reason of knowledgeCandidateBlockReason) counts[reason] = 0;
  return counts;
}

/**
 * Deterministic classification report over the corpus. Every number is
 * derived by running the same normalizer the ingestion endpoint uses, so the
 * report can never claim a record is candidate-ready that ingestion would
 * then reject.
 */
export function buildKnowledgeCorpusReport(records: readonly KnowledgeCostItemRecord[]): KnowledgeCorpusReport {
  const report: KnowledgeCorpusReport = {
    totalItems: records.length,
    documented: 0,
    unverifiedLegacy: 0,
    placeholder: 0,
    candidateReady: 0,
    blocked: 0,
    blockReasonCounts: emptyBlockReasonCounts(),
  };

  for (const record of records) {
    const classification = classifyKnowledgeCostItem(record);

    switch (classification.provenanceStatus) {
      case "documented":
        report.documented += 1;
        break;
      case "placeholder":
        report.placeholder += 1;
        break;
      default:
        report.unverifiedLegacy += 1;
        break;
    }

    if (classification.candidateReady) {
      report.candidateReady += 1;
    } else {
      report.blocked += 1;
      for (const reason of classification.blockReasons) {
        report.blockReasonCounts[reason] += 1;
      }
    }
  }

  return report;
}

export { DEFAULT_COST_DATA_PROVENANCE_STATUS };
