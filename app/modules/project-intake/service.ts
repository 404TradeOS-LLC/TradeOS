import { ProposalDraftInput, ProposalDraftResult, SiteVisitAnalysisInput, SiteVisitAnalysisResult, IntakeResult } from "./types";
import { classifyScope } from "./classifier";
import { getFollowUpQuestions, getMissingInformation } from "./questions";
import { calculateConfidence } from "./confidence";
import { buildProposalDraft as buildIntakeProposalDraft } from "./proposalDraft";

// Sprint 002: deterministic scope → structured intake result.
// Classify scope → determine missing info → generate follow-up questions → calculate confidence → draft proposal.
export function buildProjectIntake(scope: string): IntakeResult {
  const { trade, projectType, category } = classifyScope(scope);
  const missingInformation = getMissingInformation(scope, trade);
  const followUpQuestions = getFollowUpQuestions(scope, trade);
  const confidenceScore = calculateConfidence(trade, missingInformation);
  const proposalDraft = buildIntakeProposalDraft(scope, trade);

  return { trade, projectType, category, missingInformation, followUpQuestions, confidenceScore, proposalDraft };
}

const JOB_TYPE_KEYWORDS: Array<{ jobType: string; keywords: string[] }> = [
  { jobType: "roofing", keywords: ["roof", "shingle", "leak", "flashing"] },
  { jobType: "siding", keywords: ["siding", "vinyl", "hardie", "soffit", "fascia"] },
  { jobType: "deck", keywords: ["deck", "railing", "stairs", "composite"] },
  { jobType: "concrete", keywords: ["concrete", "slab", "driveway", "patio", "footing"] },
  { jobType: "painting", keywords: ["paint", "painting", "primer", "drywall finish"] },
  { jobType: "flooring", keywords: ["floor", "tile", "lvp", "hardwood", "carpet"] },
  { jobType: "kitchen remodel", keywords: ["kitchen", "cabinet", "countertop", "backsplash"] },
  { jobType: "bathroom remodel", keywords: ["bathroom", "shower", "tub", "vanity"] },
  { jobType: "electrical", keywords: ["electrical", "panel", "circuit", "lighting", "outlet"] },
  { jobType: "plumbing", keywords: ["plumbing", "water heater", "fixture", "drain", "supply line"] },
];

const PRICE_BANDS_PER_SQFT: Record<string, { low: number; high: number }> = {
  roofing: { low: 4.5, high: 8.5 },
  siding: { low: 8, high: 15 },
  painting: { low: 2, high: 4 },
  flooring: { low: 6, high: 12 },
  concrete: { low: 9, high: 14 },
};

const TIMELINES: Record<string, string> = {
  roofing: "Most projects of this size are planned as a 2 to 5 day field schedule once materials are approved and weather cooperates.",
  siding: "Typical siding work is scheduled in phases across 4 to 10 working days depending on repair findings and material lead times.",
  deck: "A typical deck scope is usually planned across 1 to 3 weeks including demolition, framing, decking, rails, and punch work.",
  concrete: "Concrete work is usually staged across 2 to 7 days with additional cure time before full use.",
  painting: "Painting schedules usually run 2 to 6 working days depending on prep, coats, and drying windows.",
  flooring: "Flooring work is commonly completed in 2 to 5 working days depending on prep and finish details.",
};

const DEFAULT_ASSUMPTIONS = [
  "Pricing is based on the currently documented scope and visible site conditions.",
  "Hidden damage, code corrections, and owner-requested changes are handled separately if discovered.",
  "The proposal may be refined after final field verification and product selections.",
];

const DEFAULT_EXCLUSIONS = [
  "Permit fees unless specifically listed",
  "Engineering or design services unless specifically listed",
  "Repairs for concealed conditions discovered after work begins",
];

export class ProjectIntakeService {
  analyzeScope(scope: string): IntakeResult {
    return buildProjectIntake(scope);
  }

  analyzeSiteVisit(input: SiteVisitAnalysisInput): SiteVisitAnalysisResult {
    const normalizedJobType = this.inferJobType(input);
    const missingInfo = this.buildMissingInfo(input, normalizedJobType);
    const aiQuestions = this.buildQuestions(input, normalizedJobType, missingInfo);
    const confidenceScore = this.calculateConfidenceScore(input, normalizedJobType);

    return {
      normalizedJobType,
      aiQuestions,
      missingInfo,
      confidenceScore,
    };
  }

  buildProposalDraft(input: ProposalDraftInput): ProposalDraftResult {
    const analysis = this.analyzeSiteVisit(input);
    const scopeParts = [
      `${input.companyName} will provide labor, coordination, and material planning for the ${analysis.normalizedJobType ?? "project"} at ${input.projectAddress ?? "the project site"}.`,
      input.simpleScope?.trim() || input.notes?.trim() || "Final scope will be confirmed from the site visit notes and follow-up answers.",
      analysis.missingInfo.length
        ? `This draft is based on currently available information and will be refined after the following items are clarified: ${analysis.missingInfo.join(", ")}.`
        : "This draft reflects the currently documented site conditions and owner priorities.",
    ];

    const assumptions = DEFAULT_ASSUMPTIONS.join("\n");
    const exclusions = this.buildExclusions(analysis.normalizedJobType).join("\n");
    const timeline =
      TIMELINES[analysis.normalizedJobType ?? ""] ??
      "Scheduling will be confirmed after scope approval, final measurements, and material lead-time review.";

    const { low, high } = this.estimateRange(analysis.normalizedJobType, input.measurements);

    return {
      normalizedJobType: analysis.normalizedJobType,
      scopeOfWork: scopeParts.join("\n\n"),
      assumptions,
      exclusions,
      timeline,
      priceLow: low,
      priceHigh: high,
      paymentSchedule: [
        { label: "Deposit", amountPercent: 30, notes: "Due at scheduling to secure labor and materials." },
        { label: "Progress payment", amountPercent: 40, notes: "Due once the main field work is underway." },
        { label: "Final payment", amountPercent: 30, notes: "Due at substantial completion and walkthrough." },
      ],
    };
  }

  private inferJobType(input: SiteVisitAnalysisInput): string | null {
    if (input.jobType?.trim()) return input.jobType.trim().toLowerCase();

    const text = `${input.projectName} ${input.simpleScope ?? ""} ${input.notes ?? ""} ${input.transcript ?? ""}`.toLowerCase();
    const match = JOB_TYPE_KEYWORDS.find((entry) => entry.keywords.some((keyword) => text.includes(keyword)));
    return match?.jobType ?? null;
  }

  private buildMissingInfo(input: SiteVisitAnalysisInput, normalizedJobType: string | null): string[] {
    const missing: string[] = [];

    if (!input.projectAddress?.trim()) missing.push("project address");
    if (!input.simpleScope?.trim()) missing.push("simple scope of work");

    const measurements = input.measurements ?? {};
    if (!Object.keys(measurements).length) missing.push("field measurements");

    if (!input.notes?.trim() && !input.transcript?.trim()) missing.push("site visit notes");
    if (!normalizedJobType) missing.push("confirmed project type");

    return missing;
  }

  private buildQuestions(input: SiteVisitAnalysisInput, normalizedJobType: string | null, missingInfo: string[]): string[] {
    const questions: string[] = [];

    if (missingInfo.includes("field measurements")) {
      questions.push("What are the key field measurements for this job, such as square footage, linear footage, or fixture counts?");
    }

    if (missingInfo.includes("project address")) {
      questions.push("What is the full jobsite address for this proposal?");
    }

    if (normalizedJobType === "roofing") {
      questions.push("Are there any known leaks, decking repairs, or ventilation issues that should be included?");
      questions.push("Will tear-off and disposal be included in the base proposal?");
    } else if (normalizedJobType === "deck") {
      questions.push("What decking material and railing style should the draft assume?");
    } else if (normalizedJobType === "painting") {
      questions.push("Should the draft include surface prep, patching, and primer, or only finish coats?");
    } else if (normalizedJobType === "flooring") {
      questions.push("Does the existing flooring need demo and disposal, and what underlayment assumptions should be used?");
    }

    if (!input.simpleScope?.trim()) {
      questions.push("How would you describe the job in one or two plain-language sentences for the customer-facing proposal?");
    }

    return Array.from(new Set(questions));
  }

  private calculateConfidenceScore(input: SiteVisitAnalysisInput, normalizedJobType: string | null): number {
    let score = 20;

    if (input.simpleScope?.trim()) score += 20;
    if (input.notes?.trim() || input.transcript?.trim()) score += 20;
    if (input.measurements && Object.keys(input.measurements).length) score += 20;
    if (normalizedJobType) score += 20;
    if (input.projectAddress?.trim()) score += 10;

    return Math.min(score, 95);
  }

  private buildExclusions(jobType: string | null): string[] {
    const exclusions = [...DEFAULT_EXCLUSIONS];
    if (jobType === "roofing") exclusions.push("Structural deck replacement beyond isolated spot repairs unless specifically listed");
    if (jobType === "painting") exclusions.push("Color changes or additional coats beyond the listed system unless specifically listed");
    if (jobType === "deck") exclusions.push("Permit revisions or survey work unless specifically listed");
    return exclusions;
  }

  private estimateRange(jobType: string | null, measurements?: Record<string, unknown> | null) {
    if (!jobType || !measurements) return { low: null, high: null };

    const pricing = PRICE_BANDS_PER_SQFT[jobType];
    if (!pricing) return { low: null, high: null };

    const area = this.extractArea(measurements);
    if (!area) return { low: null, high: null };

    return {
      low: roundCurrency(area * pricing.low),
      high: roundCurrency(area * pricing.high),
    };
  }

  private extractArea(measurements: Record<string, unknown>): number | null {
    const candidates = ["squareFeet", "sqFt", "areaSqFt", "area", "roofAreaSqFt"];
    for (const key of candidates) {
      const value = measurements[key];
      if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    }
    return null;
  }
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
