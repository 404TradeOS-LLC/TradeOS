import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { basePrisma, prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import { ApiError } from "../../backend/middleware/errorHandler";
import { normalizeEstimateStatus } from "../../domain";
import { round2 } from "../estimate-engine/formulas";
import { EstimateEngineService } from "../estimate-engine/service";
import { ActivityTimelineService } from "../intelligence/service";
import { KnowledgeRuntimeService } from "../knowledge-runtime/service";
import { CostDatabaseService } from "../cost-database/service";
import { AssembliesDatabaseService } from "../assemblies-database/service";
import { createAthenaGenerationRecord, createAthenaGenerationReview, findAthenaGenerationRecord } from "../athena-generation/store";
import {
  AIEstimateSuggestionKind,
  AIEstimateSuggestionTarget,
  AIEstimatorToolRun,
  ApplyStructuredEstimateInput,
  GenerateStructuredEstimateInput,
  ParsedContractorScope,
  ParsedScopeQuantity,
  StructuredEstimateDraft,
  StructuredEstimateDraftLineItem,
} from "./types";

const DEFAULT_DRAFT_LIMIT = 6;
const MIN_TARGET_MATCH_SCORE = 75;
const ENGINE_VERSION = "structured-ai-estimator.v1";
const REVIEW_TOKEN_VERSION = "v1";
const DEFAULT_REVIEW_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_REVIEW_QUANTITY = 1_000_000;

export class StructuredAIEstimatorService {
  private readonly knowledgeRuntime = new KnowledgeRuntimeService();
  private readonly estimateEngine = new EstimateEngineService();
  private readonly activityService = new ActivityTimelineService();
  private readonly costDatabase = new CostDatabaseService();
  private readonly assembliesDatabase = new AssembliesDatabaseService();

  async generateDraft(input: GenerateStructuredEstimateInput): Promise<StructuredEstimateDraft> {
    const generationStartedAt = Date.now();
    const estimate = await prisma.estimate.findFirst({
      where: { id: input.estimateId, orgId: input.orgId },
      include: { project: true },
    });
    if (!estimate) throw new ApiError(404, `Estimate ${input.estimateId} not found`);

    const scopeOfWork = input.scopeOfWork.trim() || estimate.project.simpleScope?.trim() || "";
    if (!scopeOfWork) {
      throw new ApiError(400, "scopeOfWork is required when the project does not already have a simple scope");
    }

    const toolRuns: AIEstimatorToolRun[] = [];
    let knowledgeMatch: ReturnType<KnowledgeRuntimeService["matchScope"]>;
    try {
      knowledgeMatch = this.knowledgeRuntime.matchScope(scopeOfWork, input.limit ?? DEFAULT_DRAFT_LIMIT);
    } catch {
      throw new ApiError(503, "Knowledge Runtime is unavailable for AI estimator draft generation");
    }
    const parsedScope = parseContractorScope(scopeOfWork, knowledgeMatch.detectedTrade, knowledgeMatch.missingInformation);
    toolRuns.push({
      name: "scope.parse",
      status: parsedScope.quantities.length > 0 ? "passed" : "warning",
      summary:
        parsedScope.quantities.length > 0
          ? `Extracted ${parsedScope.quantities.length} quantity signal(s) from contractor language.`
          : "No explicit quantity was found; default job quantities require review.",
      metadata: { quantities: parsedScope.quantities },
    });
    toolRuns.push({
      name: "knowledge.match",
      status: knowledgeMatch.matchedAssemblies.length + knowledgeMatch.matchedCostItems.length > 0 ? "passed" : "warning",
      summary: `Detected ${knowledgeMatch.detectedTrade ?? "unknown trade"} with ${knowledgeMatch.confidenceScore}% confidence.`,
      metadata: {
        matchedAssemblies: knowledgeMatch.matchedAssemblies.length,
        matchedCostItems: knowledgeMatch.matchedCostItems.length,
      },
    });

    const candidateResults = [...knowledgeMatch.matchedAssemblies, ...knowledgeMatch.matchedCostItems]
      .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
      .slice(0, input.limit ?? DEFAULT_DRAFT_LIMIT);

    const lineItems: StructuredEstimateDraftLineItem[] = [];
    for (const candidate of candidateResults) {
      const lineItem = await this.toDraftLineItem(candidate, parsedScope, input.estimateId, input.orgId);
      lineItems.push(lineItem);
    }

    const resolvedCount = lineItems.filter((lineItem) => lineItem.targetId).length;
    toolRuns.push({
      name: "costbook.resolve-targets",
      status: resolvedCount > 0 ? "passed" : "failed",
      summary: `Resolved ${resolvedCount} of ${lineItems.length} candidate(s) to existing TradeOS estimate targets.`,
    });
    toolRuns.push({
      name: "costbook.retrieve-pricing",
      status: lineItems.some((lineItem) => lineItem.costBreakdown) ? "passed" : "warning",
      summary: "Retrieved pricing only from existing costbook and assembly services.",
    });

    const warnings = [
      ...knowledgeMatch.reviewWarnings,
      ...lineItems.flatMap((lineItem) => lineItem.reviewWarnings),
      ...(resolvedCount === 0 ? ["No generated line item is currently tied to an existing estimate target."] : []),
    ];
    const missingInformation = [...new Set([...parsedScope.missingInformation, ...knowledgeMatch.missingInformation])];
    const validationStatus = resolvedCount === 0 ? "blocked" : missingInformation.length > 0 || warnings.length > 0 ? "needs_review" : "ready_for_review";
    toolRuns.push({
      name: "estimate.validate",
      status: validationStatus === "blocked" ? "failed" : validationStatus === "needs_review" ? "warning" : "passed",
      summary: validationStatus === "blocked" ? "Draft cannot be applied until at least one target is resolved." : "Draft is staged for human review.",
    });

    const generationRecord = input.actorUserId
      ? await createAthenaGenerationRecord({
          orgId: input.orgId,
          actorUserId: input.actorUserId,
          requestId: `ai-estimate-assist:${estimate.id}:${randomUUID()}`,
          traceId: randomUUID(),
          provider: "knowledge-runtime",
          model: ENGINE_VERSION,
          status: "succeeded",
          latencyMs: Date.now() - generationStartedAt,
          toolNames: toolRuns.map((tool) => tool.name),
          provenance: {
            source: "ai_estimate_assist",
            engineVersion: ENGINE_VERSION,
            estimateId: estimate.id,
            validationStatus,
          },
          retentionExpiresAt: new Date(Date.now() + resolveGenerationRetentionDays() * 24 * 60 * 60 * 1000),
          completedAt: new Date(),
        })
      : null;

    const draft: StructuredEstimateDraft = {
      generationId: generationRecord?.id,
      estimateId: estimate.id,
      orgId: input.orgId,
      projectId: estimate.projectId,
      scopeOfWork,
      parsedScope,
      detectedTrade: knowledgeMatch.detectedTrade,
      confidenceScore: knowledgeMatch.confidenceScore,
      lineItems,
      subtotalCost: round2(lineItems.reduce((sum, lineItem) => sum + lineItem.lineCost, 0)),
      validation: {
        status: validationStatus,
        reviewRequired: true,
        missingInformation,
        warnings: [...new Set(warnings)],
      },
      toolRuns,
    };

    await this.activityService.record({
      orgId: input.orgId,
      entityType: "estimate",
      entityId: estimate.id,
      eventType: "estimate.ai_estimator_draft_generated",
      title: "AI estimator draft generated",
      description: "Structured estimator staged review-only estimate suggestions.",
      actorUserId: input.actorUserId,
      metadata: {
        engineVersion: ENGINE_VERSION,
        validationStatus,
        lineItemCount: lineItems.length,
        resolvedCount,
        unresolvedCount: lineItems.length - resolvedCount,
        missingInformationCount: missingInformation.length,
        warningCount: warnings.length,
        scopeCharacterCount: scopeOfWork.length,
      },
    });

    return draft;
  }

  async applyReviewedDraft(input: ApplyStructuredEstimateInput): Promise<{
    applied: Array<{ draftLineItemId: string; lineItemId: string; quantity: number }>;
    skipped: Array<{ draftLineItemId: string; status: string; reason: string }>;
  }> {
    return runInDatabaseTransaction(basePrisma, () => this.applyReviewedDraftInTransaction(input));
  }

  private async applyReviewedDraftInTransaction(input: ApplyStructuredEstimateInput): Promise<{
    applied: Array<{ draftLineItemId: string; lineItemId: string; quantity: number }>;
    skipped: Array<{ draftLineItemId: string; status: string; reason: string }>;
  }> {
    const estimate = await prisma.estimate.findFirst({ where: { id: input.estimateId, orgId: input.orgId } });
    if (!estimate) throw new ApiError(404, `Estimate ${input.estimateId} not found`);

    if (input.generationId) {
      if (!input.actorUserId) throw new ApiError(401, "Authenticated reviewer is required");
      const generation = await findAthenaGenerationRecord(input.orgId, input.generationId);
      const generationEstimateId = typeof generation?.provenance.estimateId === "string" ? generation.provenance.estimateId : null;
      if (
        !generation ||
        generation.provenance.source !== "ai_estimate_assist" ||
        generationEstimateId !== input.estimateId
      ) {
        throw new ApiError(400, "Generation record does not match the reviewed estimate");
      }
    }

    const hasAcceptedLines = input.lineItems.some((lineItem) => lineItem.status === "accepted");
    if (hasAcceptedLines && normalizeEstimateStatus(estimate.status) !== "draft") {
      throw new ApiError(409, `Estimate ${input.estimateId} is not in draft status and can no longer be modified`);
    }
    if (hasAcceptedLines) {
      await lockEstimateApply(input.orgId, input.estimateId);
    }

    const applied: Array<{ draftLineItemId: string; lineItemId: string; quantity: number }> = [];
    const skipped: Array<{ draftLineItemId: string; status: string; reason: string }> = [];
    const seenDraftLineItemIds = new Set<string>();
    const seenAcceptedLineKeys = new Set<string>();
    const pendingApplies: Array<{
      draftLineItemId: string;
      targetKind: AIEstimateSuggestionKind;
      targetId: string;
      quantity: number;
      description: string;
      sourceKey: string;
    }> = [];

    for (const lineItem of input.lineItems) {
      if (seenDraftLineItemIds.has(lineItem.draftLineItemId)) {
        skipped.push({
          draftLineItemId: lineItem.draftLineItemId,
          status: lineItem.status,
          reason: "Duplicate draft line item in review payload.",
        });
        continue;
      }
      seenDraftLineItemIds.add(lineItem.draftLineItemId);

      if (lineItem.status !== "accepted") {
        skipped.push({
          draftLineItemId: lineItem.draftLineItemId,
          status: lineItem.status,
          reason: lineItem.status === "rejected" ? "Rejected during human review." : "Left pending during human review.",
        });
        continue;
      }

      if (!lineItem.targetId || !lineItem.targetKind) {
        skipped.push({
          draftLineItemId: lineItem.draftLineItemId,
          status: lineItem.status,
          reason: "Accepted line item is missing a validated estimate target.",
        });
        continue;
      }

      const tokenStatus = validateReviewToken(lineItem.reviewToken, {
        estimateId: input.estimateId,
        orgId: input.orgId,
        draftLineItemId: lineItem.draftLineItemId,
        targetKind: lineItem.targetKind,
        targetId: lineItem.targetId,
      });
      if (!tokenStatus.valid) {
        skipped.push({
          draftLineItemId: lineItem.draftLineItemId,
          status: lineItem.status,
          reason: tokenStatus.reason,
        });
        continue;
      }

      const target = await this.validateReviewedTarget(lineItem.targetKind, lineItem.targetId, input.orgId);
      if (!target) {
        skipped.push({
          draftLineItemId: lineItem.draftLineItemId,
          status: lineItem.status,
          reason: "Accepted line item target does not exist in this organization.",
        });
        continue;
      }

      const description = lineItem.description?.trim() || target.name;
      const sourceKey = buildReviewedLineSourceKey(lineItem.draftLineItemId, lineItem.targetKind, lineItem.targetId, lineItem.quantity, description);
      const acceptedLineKey = buildAcceptedLineKey(lineItem.targetKind, lineItem.targetId, lineItem.quantity, description);
      if (seenAcceptedLineKeys.has(acceptedLineKey)) {
        skipped.push({
          draftLineItemId: lineItem.draftLineItemId,
          status: lineItem.status,
          reason: "Duplicate accepted target in review payload.",
        });
        continue;
      }
      seenAcceptedLineKeys.add(acceptedLineKey);

      if (await this.estimateAlreadyHasReviewedSourceKey(input.estimateId, input.orgId, sourceKey)) {
        skipped.push({
          draftLineItemId: lineItem.draftLineItemId,
          status: lineItem.status,
          reason: "Matching reviewed line already exists; skipped for idempotency.",
        });
        continue;
      }

      if (await this.estimateAlreadyHasReviewedLine(input.estimateId, input.orgId, lineItem.targetKind, lineItem.targetId, lineItem.quantity, description)) {
        skipped.push({
          draftLineItemId: lineItem.draftLineItemId,
          status: lineItem.status,
          reason: "Matching estimate line already exists; skipped for idempotency.",
        });
        continue;
      }

      pendingApplies.push({
        draftLineItemId: lineItem.draftLineItemId,
        targetKind: lineItem.targetKind,
        targetId: lineItem.targetId,
        quantity: lineItem.quantity,
        description,
        sourceKey,
      });
    }

    for (const lineItem of pendingApplies) {
      const created = await this.estimateEngine.addLineItem({
        estimateId: input.estimateId,
        orgId: input.orgId,
        quantity: lineItem.quantity,
        description: lineItem.description,
        sourceKey: lineItem.sourceKey,
        ...(lineItem.targetKind === "assembly" ? { assemblyId: lineItem.targetId } : { costItemId: lineItem.targetId }),
      });

      applied.push({ draftLineItemId: lineItem.draftLineItemId, lineItemId: created.id, quantity: lineItem.quantity });
    }

    await this.activityService.record({
      orgId: input.orgId,
      entityType: "estimate",
      entityId: input.estimateId,
      eventType: "estimate.ai_estimator_review_applied",
      title: "AI estimator reviewed lines applied",
      description: "Structured estimator applied human-accepted lines through the Estimate Engine.",
      actorUserId: input.actorUserId,
      metadata: {
        engineVersion: ENGINE_VERSION,
        appliedCount: applied.length,
        skippedCount: skipped.length,
        rejectedCount: input.lineItems.filter((lineItem) => lineItem.status === "rejected").length,
        unresolvedCount: skipped.filter((lineItem) => lineItem.reason.includes("missing") || lineItem.reason.includes("does not exist")).length,
        duplicateCount: skipped.filter((lineItem) => lineItem.reason.includes("Duplicate") || lineItem.reason.includes("idempotency")).length,
        lineItemIds: applied.map((lineItem) => lineItem.lineItemId),
      },
    });

    if (input.generationId && input.actorUserId) {
      const acceptedCount = input.lineItems.filter((lineItem) => lineItem.status === "accepted").length;
      const rejectedCount = input.lineItems.filter((lineItem) => lineItem.status === "rejected").length;
      const outcome = acceptedCount > 0 && rejectedCount > 0
        ? "amended"
        : acceptedCount > 0
          ? "accepted"
          : "rejected";

      await createAthenaGenerationReview({
        orgId: input.orgId,
        generationId: input.generationId,
        reviewerUserId: input.actorUserId,
        outcome,
        provenance: {
          source: "ai_estimate_assist",
          engineVersion: ENGINE_VERSION,
          appliedCount: applied.length,
          skippedCount: skipped.length,
        },
        reviewedAt: new Date(),
      });
    }

    return { applied, skipped };
  }

  private async validateReviewedTarget(kind: AIEstimateSuggestionKind, targetId: string, orgId: string): Promise<AIEstimateSuggestionTarget | null> {
    return this.findDirectTarget(kind, targetId, orgId);
  }

  private async estimateAlreadyHasReviewedLine(
    estimateId: string,
    orgId: string,
    targetKind: AIEstimateSuggestionKind,
    targetId: string,
    quantity: number,
    description: string
  ): Promise<boolean> {
    const existingLine = await prisma.estimateLineItem.findFirst({
      where: {
        estimateId,
        description,
        quantity,
        ...(targetKind === "assembly" ? { assemblyId: targetId } : { costItemId: targetId }),
        estimate: { orgId },
      },
      select: { id: true },
    });

    return Boolean(existingLine);
  }

  private async estimateAlreadyHasReviewedSourceKey(estimateId: string, orgId: string, sourceKey: string): Promise<boolean> {
    const existingLine = await prisma.estimateLineItem.findFirst({
      where: {
        estimateId,
        sourceKey,
        estimate: { orgId },
      },
      select: { id: true },
    });

    return Boolean(existingLine);
  }

  private async toDraftLineItem(
    candidate: {
      id: string;
      type: "assembly" | "costItem";
      name: string;
      unitOfMeasure: string | null;
      confidence: number;
      rationale: string;
    },
    parsedScope: ParsedContractorScope,
    estimateId: string,
    orgId: string
  ): Promise<StructuredEstimateDraftLineItem> {
    const targetResolution = await this.resolveTarget(candidate.type, candidate.id, candidate.name, candidate.unitOfMeasure, orgId);
    const target = targetResolution.target;
    const unitOfMeasure = target?.unitOfMeasure ?? candidate.unitOfMeasure ?? "EA";
    const quantity = deriveQuantityForUnit(parsedScope.quantities, unitOfMeasure);
    const reviewWarnings: string[] = [];

    if (!target) {
      reviewWarnings.push("No existing costbook target was resolved for this candidate.");
    }
    if (quantity === 1 && !["EA", "JOB"].includes(unitOfMeasure.toUpperCase())) {
      reviewWarnings.push(`Quantity defaulted to 1 ${unitOfMeasure}; confirm measurement before applying.`);
    }

    const pricing = target ? await this.safeRetrievePricing(target.kind, target.id, quantity, orgId) : { costBreakdown: null, warning: null };
    const costBreakdown = pricing.costBreakdown;
    if (pricing.warning) {
      reviewWarnings.push(pricing.warning);
    }
    const unitCost = costBreakdown?.totalUnitCost ?? 0;

    return {
      draftLineItemId: `${candidate.type}-${candidate.id}`,
      source: "knowledge-runtime",
      reviewToken: target
        ? buildReviewToken({
            estimateId,
            orgId,
            draftLineItemId: `${candidate.type}-${candidate.id}`,
            targetKind: target.kind,
            targetId: target.id,
          })
        : null,
      targetKind: candidate.type,
      targetId: target?.id ?? null,
      targetCode: target?.code ?? null,
      targetName: target?.name ?? null,
      targetResolution,
      description: candidate.name,
      quantity,
      unitOfMeasure,
      unitCost,
      lineCost: round2(unitCost * quantity),
      confidence: candidate.confidence,
      rationale: candidate.rationale,
      reviewWarnings,
      costBreakdown,
    };
  }

  private async retrievePricing(kind: AIEstimateSuggestionKind, targetId: string, quantity: number, orgId: string) {
    if (kind === "assembly") {
      const assemblyCost = await this.assembliesDatabase.getAssemblyUnitCost(targetId, undefined, new Set(), orgId);
      return {
        laborCostPerUnit: 0,
        materialCostPerUnit: 0,
        equipmentCostPerUnit: 0,
        totalUnitCost: assemblyCost.unitCost,
        componentCount: assemblyCost.componentCount,
      };
    }

    return this.costDatabase.getUnitCost(targetId, quantity, undefined, orgId);
  }

  private async safeRetrievePricing(kind: AIEstimateSuggestionKind, targetId: string, quantity: number, orgId: string) {
    try {
      return { costBreakdown: await this.retrievePricing(kind, targetId, quantity, orgId), warning: null };
    } catch {
      return {
        costBreakdown: null,
        warning: "Authoritative pricing could not be retrieved for this target; regenerate or select a different costbook item before applying.",
      };
    }
  }

  private async resolveTarget(
    kind: AIEstimateSuggestionKind,
    sourceId: string,
    title: string,
    unitOfMeasure: string | null,
    orgId: string
  ) {
    const directTarget = await this.findDirectTarget(kind, sourceId, orgId);
    if (directTarget) {
      return {
        status: "resolved" as const,
        reason: "Matched directly to an existing TradeOS estimate target by ID.",
        target: directTarget,
      };
    }

    const rankedTargets = await this.searchTargets(kind, title, orgId);
    const bestTarget = rankedTargets.find((target) => target.matchScore >= MIN_TARGET_MATCH_SCORE && (!unitOfMeasure || target.unitOfMeasure === unitOfMeasure));
    if (bestTarget) {
      return {
        status: "resolved" as const,
        reason: "Matched to an existing TradeOS estimate target by reviewed name similarity.",
        target: bestTarget,
      };
    }

    return {
      status: "unresolved" as const,
      reason: "No close existing estimate target was found. Human review must pick a cost item or assembly before apply.",
      target: null,
    };
  }

  private async findDirectTarget(kind: AIEstimateSuggestionKind, id: string, orgId: string): Promise<AIEstimateSuggestionTarget | null> {
    try {
      if (kind === "assembly") {
        const assembly = await this.assembliesDatabase.getById(id, orgId);
        if (!assembly.isActive) return null;
        return {
          id: assembly.id,
          kind,
          code: assembly.code,
          name: assembly.name,
          unitOfMeasure: assembly.unitOfMeasure,
          matchMethod: "id",
          matchScore: 100,
        };
      }

      const costItem = await this.costDatabase.getById(id, orgId);
      if (!costItem.isActive) return null;
      return {
        id: costItem.id,
        kind,
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

  private async searchTargets(kind: AIEstimateSuggestionKind, title: string, orgId: string): Promise<AIEstimateSuggestionTarget[]> {
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
}

function parseContractorScope(scope: string, detectedTrade: string | null, runtimeMissingInformation: string[]): ParsedContractorScope {
  const normalizedText = scope.replace(/\s+/g, " ").trim();
  const quantities = extractQuantities(normalizedText);
  const lower = normalizedText.toLowerCase();

  return {
    normalizedText,
    detectedTrade,
    quantities,
    materials: extractKnownWords(lower, ["concrete", "cedar", "wood", "composite", "asphalt", "shingle", "oak", "tile", "drywall", "mulch"]),
    siteConstraints: extractKnownWords(lower, ["haul", "haul-off", "cleanup", "power line", "narrow", "access", "two-story", "stump", "sawcut"]),
    missingInformation: quantities.length > 0 ? runtimeMissingInformation : [...runtimeMissingInformation, "Confirm dimensions or count for pricing."],
  };
}

function extractQuantities(scope: string): ParsedScopeQuantity[] {
  const quantities: ParsedScopeQuantity[] = [];
  const lower = scope.toLowerCase();

  collectMatches(quantities, lower, /(\d+(?:\.\d+)?)\s*(?:sq\s*ft|square\s*feet|sf)\b/g, "area", "SF");
  collectMatches(quantities, lower, /(\d+(?:\.\d+)?)\s*(?:linear\s*ft|linear\s*feet|lf)\b/g, "length", "LF");
  collectMatches(quantities, lower, /(\d+(?:\.\d+)?)\s*(?:cubic\s*yards?|cy)\b/g, "volume", "CY");
  collectMatches(quantities, lower, /(\d+(?:\.\d+)?)\s*(?:squares?|\bsq\b(?!\s*ft))/g, "squares", "SQ");
  collectMatches(quantities, lower, /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/g, "hours", "HR");
  collectMatches(quantities, lower, /(\d+(?:\.\d+)?)\s*(?:each|ea|units?|items?)\b/g, "count", "EA");

  for (const match of lower.matchAll(/\b(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\b/g)) {
    const width = parseBoundedQuantity(match[1]);
    const length = parseBoundedQuantity(match[2]);
    quantities.push({ type: "dimension", value: parseBoundedQuantity(round2(width * length)), unit: "SF", sourceText: match[0] });
  }

  const thickness = lower.match(/(\d+(?:\.\d+)?)\s*(?:inch|in|")\s*(?:thick|slab)?/);
  const area = quantities.find((quantity) => quantity.unit === "SF");
  if (area && thickness) {
    const thicknessInches = parseBoundedQuantity(thickness[1]);
    quantities.push({
      type: "volume",
      value: parseBoundedQuantity(round2((area.value * (thicknessInches / 12)) / 27)),
      unit: "CY",
      sourceText: `${area.sourceText} at ${thickness[0]}`,
    });
  }

  return dedupeQuantities(quantities);
}

function collectMatches(
  quantities: ParsedScopeQuantity[],
  scope: string,
  pattern: RegExp,
  type: ParsedScopeQuantity["type"],
  unit: ParsedScopeQuantity["unit"]
) {
  for (const match of scope.matchAll(pattern)) {
    quantities.push({ type, value: parseBoundedQuantity(match[1]), unit, sourceText: match[0] });
  }
}

function parseBoundedQuantity(value: string | number) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_REVIEW_QUANTITY) {
    throw new ApiError(400, `Parsed quantities must be finite, positive, and no greater than ${MAX_REVIEW_QUANTITY}`);
  }
  return quantity;
}

function deriveQuantityForUnit(quantities: ParsedScopeQuantity[], unitOfMeasure: string): number {
  const normalizedUnit = unitOfMeasure.toUpperCase();
  const matching = quantities.find((quantity) => quantity.unit === normalizedUnit);
  if (matching) return matching.value;
  if (normalizedUnit === "CY") return quantities.find((quantity) => quantity.unit === "CY")?.value ?? 1;
  if (normalizedUnit === "SF") return quantities.find((quantity) => quantity.unit === "SF")?.value ?? 1;
  if (normalizedUnit === "LF") return quantities.find((quantity) => quantity.unit === "LF")?.value ?? 1;
  if (normalizedUnit === "SQ") {
    const squareQuantity = quantities.find((quantity) => quantity.unit === "SQ")?.value;
    const areaQuantity = quantities.find((quantity) => quantity.unit === "SF")?.value;
    return squareQuantity ?? (areaQuantity ? round2(areaQuantity / 100) : 1);
  }
  if (normalizedUnit === "HR") return quantities.find((quantity) => quantity.unit === "HR")?.value ?? 1;
  return quantities.find((quantity) => quantity.unit === "EA")?.value ?? 1;
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

function scoreNameMatch(source: string, target: string) {
  const sourceTokens = new Set(normalizeText(source).split(" ").filter(Boolean));
  const targetTokens = new Set(normalizeText(target).split(" ").filter(Boolean));
  if (normalizeText(source) === normalizeText(target)) return 100;
  if (normalizeText(target).includes(normalizeText(source)) || normalizeText(source).includes(normalizeText(target))) return 84;
  const overlap = [...sourceTokens].filter((token) => targetTokens.has(token)).length;
  return Math.round((overlap / Math.max(sourceTokens.size, targetTokens.size, 1)) * 100);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildAcceptedLineKey(kind: AIEstimateSuggestionKind, targetId: string, quantity: number, description: string) {
  return `${kind}:${targetId}:${quantity}:${normalizeText(description)}`;
}

function buildReviewedLineSourceKey(draftLineItemId: string, kind: AIEstimateSuggestionKind, targetId: string, quantity: number, description: string) {
  const fingerprint = createHash("sha256")
    .update([draftLineItemId, kind, targetId, normalizeQuantity(quantity), normalizeText(description)].join("|"))
    .digest("hex");
  return `ai-estimator:v1:${fingerprint}`;
}

interface ReviewTokenPayload {
  version: typeof REVIEW_TOKEN_VERSION;
  engineVersion: typeof ENGINE_VERSION;
  estimateId: string;
  orgId: string;
  draftLineItemId: string;
  targetKind: AIEstimateSuggestionKind;
  targetId: string;
  issuedAt: number;
}

function buildReviewToken(input: Omit<ReviewTokenPayload, "version" | "engineVersion" | "issuedAt">) {
  const payload: ReviewTokenPayload = {
    ...input,
    version: REVIEW_TOKEN_VERSION,
    engineVersion: ENGINE_VERSION,
    issuedAt: Date.now(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signReviewTokenPayload(encodedPayload);
  return `${REVIEW_TOKEN_VERSION}.${encodedPayload}.${signature}`;
}

function validateReviewToken(
  token: string | undefined,
  expected: Pick<ReviewTokenPayload, "estimateId" | "orgId" | "draftLineItemId" | "targetKind" | "targetId">
): { valid: true } | { valid: false; reason: string } {
  if (!token) {
    return { valid: false, reason: "Accepted line item is missing a server-issued review token." };
  }

  const [version, encodedPayload, signature] = token.split(".");
  if (version !== REVIEW_TOKEN_VERSION || !encodedPayload || !signature) {
    return { valid: false, reason: "Accepted line item review token is invalid." };
  }

  const expectedSignature = signReviewTokenPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) {
    return { valid: false, reason: "Accepted line item review token is invalid." };
  }

  let payload: ReviewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as ReviewTokenPayload;
  } catch {
    return { valid: false, reason: "Accepted line item review token is invalid." };
  }

  if (
    payload.version !== REVIEW_TOKEN_VERSION ||
    payload.engineVersion !== ENGINE_VERSION ||
    payload.estimateId !== expected.estimateId ||
    payload.orgId !== expected.orgId ||
    payload.draftLineItemId !== expected.draftLineItemId ||
    payload.targetKind !== expected.targetKind ||
    payload.targetId !== expected.targetId
  ) {
    return { valid: false, reason: "Accepted line item review token does not match the reviewed target." };
  }

  const maxAgeMs = parseReviewTokenTtl();
  if (!Number.isFinite(payload.issuedAt) || Date.now() - payload.issuedAt > maxAgeMs) {
    return { valid: false, reason: "Accepted line item review token has expired; regenerate the structured estimate draft." };
  }

  return { valid: true };
}

function signReviewTokenPayload(encodedPayload: string) {
  return createHmac("sha256", reviewTokenSecret()).update(encodedPayload).digest("base64url");
}

function reviewTokenSecret() {
  const secret = process.env.AI_ESTIMATOR_REVIEW_TOKEN_SECRET || process.env.AUTH_JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(500, "AI estimator review token signing secret is not configured");
  }
  return "development-ai-estimator-review-token-secret";
}

function parseReviewTokenTtl() {
  const configured = Number(process.env.AI_ESTIMATOR_REVIEW_TOKEN_TTL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REVIEW_TOKEN_TTL_MS;
}

function resolveGenerationRetentionDays() {
  const configured = Number(process.env.ATHENA_GENERATION_RETENTION_DAYS);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 90;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function lockEstimateApply(orgId: string, estimateId: string) {
  const lockKey = `ai-estimator-apply:${orgId}:${estimateId}`;
  await prisma.$queryRaw(Prisma.sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
}

function normalizeQuantity(quantity: number) {
  return Number(quantity).toFixed(4);
}

function dedupeTargets(targets: AIEstimateSuggestionTarget[]) {
  const seen = new Map<string, AIEstimateSuggestionTarget>();
  for (const target of targets) {
    const existing = seen.get(target.id);
    if (!existing || target.matchScore > existing.matchScore) seen.set(target.id, target);
  }
  return [...seen.values()];
}

function dedupeQuantities(quantities: ParsedScopeQuantity[]) {
  const seen = new Set<string>();
  return quantities.filter((quantity) => {
    const key = `${quantity.type}:${quantity.unit}:${quantity.value}:${quantity.sourceText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractKnownWords(scope: string, words: string[]) {
  return words.filter((word) => scope.includes(word));
}
