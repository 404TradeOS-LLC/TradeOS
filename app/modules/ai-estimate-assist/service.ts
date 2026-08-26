import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { EstimateEngineService } from "../estimate-engine/service";
import { KnowledgeRuntimeService } from "../knowledge-runtime/service";
import { AssembliesDatabaseService } from "../assemblies-database/service";
import { CostDatabaseService } from "../cost-database/service";
import {
  AIEstimateSuggestion,
  AIEstimateSuggestionKind,
  AIEstimateSuggestionTarget,
  ApplyAIEstimateSuggestionsInput,
  AppliedAIEstimateSuggestion,
  GenerateAIEstimateSuggestionsInput,
  SkippedAIEstimateSuggestion,
} from "./types";

const DEFAULT_SCOPE =
  "Tear out and replace 250 sq ft of cracked concrete driveway, 4 inch slab, broom finish, include sawcut edges, haul-off, and final cleanup.";

export class AIEstimateAssistService {
  private readonly knowledgeRuntime = new KnowledgeRuntimeService();
  private readonly estimateEngine = new EstimateEngineService();
  private readonly assembliesDatabase = new AssembliesDatabaseService();
  private readonly costDatabase = new CostDatabaseService();

  async generateSuggestions(input: GenerateAIEstimateSuggestionsInput): Promise<{
    suggestions: AIEstimateSuggestion[];
    scopeOfWork: string;
    knowledgeMatch: ReturnType<KnowledgeRuntimeService["matchScope"]>;
  }> {
    const estimate = await prisma.estimate.findFirst({
      where: { id: input.estimateId, orgId: input.orgId },
      include: { project: true },
    });
    if (!estimate) throw new ApiError(404, `Estimate ${input.estimateId} not found`);

    const scopeOfWork = input.scopeOfWork.trim() || estimate.project.simpleScope?.trim() || DEFAULT_SCOPE;
    const knowledgeMatch = this.knowledgeRuntime.matchScope(scopeOfWork, 4);
    const suggestions = await Promise.all(
      [...knowledgeMatch.matchedAssemblies, ...knowledgeMatch.matchedCostItems]
      .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
      .slice(0, 6)
        .map((candidate) => this.toSuggestion(candidate, scopeOfWork, input.orgId))
    );

    if (suggestions.length === 0) {
      return {
        scopeOfWork,
        knowledgeMatch,
        suggestions: [
          {
            id: "fallback-assembly",
            kind: "assembly",
            code: "AI-DRAFT-001",
            title: "Draft scope package",
            rationale: "No strong org-specific match was found, so this draft keeps the estimate moving while you refine the scope.",
            quantity: this.deriveQuantity(scopeOfWork),
            unit: "job",
            confidence: 42,
            resolution: {
              status: "unresolved",
              reason: "No matching assembly or cost item was found in the active TradeOS estimate database.",
              target: null,
            },
          },
        ],
      };
    }

    return { scopeOfWork, knowledgeMatch, suggestions };
  }

  async applySuggestions(input: ApplyAIEstimateSuggestionsInput): Promise<{
    applied: AppliedAIEstimateSuggestion[];
    skipped: SkippedAIEstimateSuggestion[];
  }> {
    const estimate = await prisma.estimate.findFirst({
      where: { id: input.estimateId, orgId: input.orgId },
    });
    if (!estimate) throw new ApiError(404, `Estimate ${input.estimateId} not found`);

    const applied: AppliedAIEstimateSuggestion[] = [];
    const skipped: SkippedAIEstimateSuggestion[] = [];

    for (const suggestion of input.suggestions) {
      if (suggestion.status !== "accepted") {
        skipped.push({
          suggestionId: suggestion.id,
          title: suggestion.title,
          status: suggestion.status,
          reason:
            suggestion.status === "rejected"
              ? "Rejected during human review."
              : "Left pending during human review.",
        });
        continue;
      }

      if (!suggestion.targetId || !suggestion.targetKind) {
        skipped.push({
          suggestionId: suggestion.id,
          title: suggestion.title,
          status: suggestion.status,
          reason: "No estimate-engine target was selected for this accepted suggestion.",
        });
        continue;
      }

      const lineItem = await this.estimateEngine.addLineItem({
        estimateId: input.estimateId,
        orgId: input.orgId,
        quantity: suggestion.quantity,
        description: suggestion.description?.trim() || suggestion.title,
        ...(suggestion.targetKind === "assembly"
          ? { assemblyId: suggestion.targetId }
          : { costItemId: suggestion.targetId }),
      });

      applied.push({
        suggestionId: suggestion.id,
        lineItemId: lineItem.id,
        title: suggestion.title,
        quantity: suggestion.quantity,
      });
    }

    return { applied, skipped };
  }

  private toSuggestion(
    candidate: { id: string; type: "assembly" | "costItem"; name: string; unitOfMeasure: string | null; confidence: number; rationale: string },
    scope: string,
    orgId: string
  ): Promise<AIEstimateSuggestion> {
    const quantity = this.deriveQuantity(scope);
    const confidence = Math.max(55, Math.min(98, candidate.confidence));
    return this.resolveSuggestionTarget(candidate.type, candidate.id, candidate.name, candidate.unitOfMeasure, orgId).then((resolution) => ({
      id: candidate.id,
      kind: candidate.type,
      code: `KE-${candidate.id.slice(0, 8).toUpperCase()}`,
      title: candidate.name,
      rationale: candidate.rationale,
      quantity: candidate.type === "assembly" ? quantity : Math.max(1, quantity),
      unit: candidate.unitOfMeasure ?? "job",
      confidence,
      resolution,
    }));
  }

  private async resolveSuggestionTarget(
    kind: AIEstimateSuggestionKind,
    sourceId: string,
    title: string,
    unitOfMeasure: string | null,
    orgId: string
  ) {
    const directMatch = await this.findDirectMatch(kind, sourceId, orgId);
    if (directMatch) {
      return {
        status: "resolved" as const,
        reason: "Matched directly to an existing TradeOS estimate target by ID.",
        target: directMatch,
      };
    }

    const rankedResults = await this.searchPotentialTargets(kind, title, orgId);
    const bestTarget = rankedResults.find((target) => target.matchScore >= 75 && (!unitOfMeasure || target.unitOfMeasure === unitOfMeasure));

    if (bestTarget) {
      return {
        status: "resolved" as const,
        reason: "Matched to an existing TradeOS estimate target by reviewed name similarity.",
        target: bestTarget,
      };
    }

    return {
      status: "unresolved" as const,
      reason: "No close existing estimate target was found. Pick an assembly or cost item manually during review.",
      target: null,
    };
  }

  private async findDirectMatch(kind: AIEstimateSuggestionKind, id: string, orgId: string): Promise<AIEstimateSuggestionTarget | null> {
    try {
      if (kind === "assembly") {
        const assembly = await this.assembliesDatabase.getById(id, orgId);
        return {
          id: assembly.id,
          kind: "assembly",
          code: assembly.code,
          name: assembly.name,
          unitOfMeasure: assembly.unitOfMeasure,
          matchMethod: "id",
          matchScore: 100,
        };
      }

      const costItem = await this.costDatabase.getById(id, orgId);
      return {
        id: costItem.id,
        kind: "costItem",
        code: costItem.code,
        name: costItem.name,
        unitOfMeasure: costItem.unitOfMeasure,
        matchMethod: "id",
        matchScore: 100,
      };
    } catch {
      return null;
    }
  }

  private async searchPotentialTargets(kind: AIEstimateSuggestionKind, title: string, orgId: string): Promise<AIEstimateSuggestionTarget[]> {
    const queries = buildSearchQueries(title);
    const targets: AIEstimateSuggestionTarget[] = [];

    for (const query of queries) {
      if (kind === "assembly") {
        const rows = await this.assembliesDatabase.search(query, orgId);
        targets.push(
          ...rows.map((row) => ({
            id: row.id,
            kind: "assembly" as const,
            code: row.code,
            name: row.name,
            unitOfMeasure: row.unitOfMeasure,
            matchMethod: normalizeText(row.name) === normalizeText(title) ? ("exact-name" as const) : ("contains-name" as const),
            matchScore: scoreNameMatch(title, row.name),
          }))
        );
      } else {
        const rows = await this.costDatabase.search(query, orgId);
        targets.push(
          ...rows.map((row) => ({
            id: row.id,
            kind: "costItem" as const,
            code: row.code,
            name: row.name,
            unitOfMeasure: row.unitOfMeasure,
            matchMethod: normalizeText(row.name) === normalizeText(title) ? ("exact-name" as const) : ("contains-name" as const),
            matchScore: scoreNameMatch(title, row.name),
          }))
        );
      }
    }

    return dedupeTargets(targets).sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name));
  }

  private deriveQuantity(scope: string): number {
    const sqftMatch = scope.match(/(\d+(?:\.\d+)?)\s*(?:sq\s*ft|square\s*feet|sf)\b/);
    if (sqftMatch) return Number(sqftMatch[1]);

    const linearMatch = scope.match(/(\d+(?:\.\d+)?)\s*(?:lf|linear\s*ft|linear\s*feet)\b/);
    if (linearMatch) return Number(linearMatch[1]);

    const countMatch = scope.match(/(\d+(?:\.\d+)?)\s*(?:each|ea|units?|items?)\b/);
    if (countMatch) return Number(countMatch[1]);

    return 1;
  }
}

function buildSearchQueries(title: string) {
  const normalized = title.trim();
  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9/-]/gi, ""))
    .filter((token) => token.length >= 3);
  const compact = tokens.slice(0, 5).join(" ");

  return [...new Set([normalized, compact].filter(Boolean))];
}

function dedupeTargets(targets: AIEstimateSuggestionTarget[]) {
  const seen = new Map<string, AIEstimateSuggestionTarget>();
  for (const target of targets) {
    const existing = seen.get(target.id);
    if (!existing || target.matchScore > existing.matchScore) {
      seen.set(target.id, target);
    }
  }
  return [...seen.values()];
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreNameMatch(source: string, target: string) {
  const sourceNormalized = normalizeText(source);
  const targetNormalized = normalizeText(target);
  if (sourceNormalized === targetNormalized) return 100;
  if (targetNormalized.includes(sourceNormalized) || sourceNormalized.includes(targetNormalized)) return 84;

  const sourceTokens = new Set(sourceNormalized.split(" ").filter(Boolean));
  const targetTokens = new Set(targetNormalized.split(" ").filter(Boolean));
  const overlap = [...sourceTokens].filter((token) => targetTokens.has(token)).length;
  const denominator = Math.max(sourceTokens.size, targetTokens.size, 1);

  return Math.round((overlap / denominator) * 100);
}
