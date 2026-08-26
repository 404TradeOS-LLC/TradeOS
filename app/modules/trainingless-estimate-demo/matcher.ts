import { loadAssemblyIndex, loadKnowledgeBook } from "./knowledgeLoader";
import type { DraftLineItem, KnowledgeMatch, ParsedScope, TraininglessEstimateDraft } from "./types";

const TREE_SERVICE_SCOPE = "Remove a 60 foot oak tree, grind the stump, and haul away debris.";

export function parseScope(rawText: string): ParsedScope {
  const normalized = rawText.toLowerCase();
  const treeCount = normalized.includes("tree") ? 1 : null;
  const treeDiameterInches = extractNumberBefore(normalized, ["foot", "ft"], 60) > 0 ? 18 : null;
  const stumpGrindingDiameterInches = normalized.includes("stump") ? 24 : null;
  const confidence =
    0.55 +
    (normalized.includes("tree") ? 0.15 : 0) +
    (normalized.includes("stump") ? 0.1 : 0) +
    (normalized.includes("haul") ? 0.1 : 0) +
    (normalized.includes("debris") ? 0.1 : 0);

  return {
    rawText,
    trade: normalized.includes("tree") ? "Tree Service" : "General Contracting",
    scopeType: "removal",
    action: "removal + stump grinding + haul-away",
    quantities: {
      treeCount,
      treeDiameterInches,
      stumpGrindingDiameterInches,
    },
    confidence: Math.min(0.98, Number(confidence.toFixed(2))),
  };
}

export function buildTraininglessEstimateDemo(rawText = TREE_SERVICE_SCOPE): TraininglessEstimateDraft {
  const parsedScope = parseScope(rawText);
  const knowledgeBook = loadKnowledgeBook();
  const assemblyIndex = loadAssemblyIndex();
  const matches = matchKnowledge(parsedScope, knowledgeBook, assemblyIndex);
  const lineItems = buildLineItems(parsedScope, matches);

  return {
    parsedScope,
    knowledgeMatches: matches,
    lineItems,
    assumptions: [
      "Truck access is available for removal and haul-away.",
      "No buried utility conflicts or special permit constraints were identified in the source scope.",
      "The stump grinder can reach the target area without protected-surface restrictions.",
    ],
    exclusions: [
      "Lawn restoration and reseeding are excluded unless separately added.",
      "Utility locating, permit fees, and arborist certification paperwork are excluded from this draft.",
      "Hidden rot, fence removal, and concrete repair are excluded unless discovered during review.",
    ],
    safetyNotes: [
      "Large-tree removal should be reviewed for fall zone and rigging risk.",
      "Stump grinding requires clearance around underground utilities before execution.",
    ],
    missingInformation: [
      "Tree diameter at breast height (DBH) is assumed from the 60 foot height cue.",
      "Access width and power/rigging constraints are not provided.",
      "Whether the stump should be ground below grade is not explicitly stated.",
    ],
    nextHumanAction: "Confirm DBH, access, utility clearance, and desired grind depth before committing line items to the estimate.",
  };
}

function matchKnowledge(
  parsedScope: ParsedScope,
  book: ReturnType<typeof loadKnowledgeBook>,
  assemblyIndex: ReturnType<typeof loadAssemblyIndex>
): KnowledgeMatch[] {
  const allEntries = [
    ...assemblyIndex.map((entry) => ({
      id: entry.source,
      name: `${entry.group} Package`,
      category: entry.category,
      unitOfMeasure: null,
      matchType: "assembly" as const,
      relevance: entry.group === "Tree Service" ? 10 : 2,
      rationale: `${entry.description} (from the knowledge engine assembly index).`,
    })),
    ...book.assemblies.map((entry) => ({ ...entry, matchType: "assembly" as const })),
    ...book.items.map((entry) => ({ ...entry, matchType: "costItem" as const })),
  ];

  const normalized = parsedScope.rawText.toLowerCase();

  return allEntries
    .map((entry) => {
      const indexedEntry = entry as (typeof entry & { source?: string; relevance?: number; rationale?: string });
      const baseRelevance = indexedEntry.source ? indexedEntry.relevance ?? 0 : scoreEntry(entry.name, normalized, parsedScope);
      const rationale = indexedEntry.source ? indexedEntry.rationale ?? buildRationale(entry.name, normalized) : buildRationale(entry.name, normalized);
      return {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        unitOfMeasure: entry.unitOfMeasure ?? null,
        matchType: entry.matchType,
        relevance: baseRelevance + (entry.matchType === "assembly" && parsedScope.trade === "Tree Service" ? 6 : 0),
        rationale,
      };
    })
    .filter((entry) => entry.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || a.name.localeCompare(b.name))
    .slice(0, 8);
}

function buildLineItems(
  parsedScope: ParsedScope,
  matches: KnowledgeMatch[]
): DraftLineItem[] {
  const knowledgeBook = loadKnowledgeBook();
  const largeTree = matches.find((match) => match.name.includes("Tree Removal - Over 18 Inch Diameter"));
  const mediumTree = matches.find((match) => match.name.includes("Tree Removal - 6 To 18 Inch Diameter"));
  const stump =
    matches.find((match) => match.name.includes("Stump Grinding")) ??
    knowledgeBook.items
      .filter((item) => item.name.toLowerCase().includes("stump grinding"))
      .sort((a, b) => a.name.localeCompare(b.name))[0];
  const haulAway = matches.find((match) => match.name.includes("Tree Disposal")) ?? matches.find((match) => match.name.includes("Debris Haul Away"));

  const lineItems: DraftLineItem[] = [];

  const treePackage = loadAssemblyIndex().find((entry) => entry.group === "Tree Service");
  if (treePackage) {
    lineItems.push({
      name: "Tree Service Assembly Package",
      sourceId: treePackage.source,
      sourceType: "assembly",
      quantity: 1,
      unitOfMeasure: "job",
      confidence: 0.9,
      rationale: "Assembly index groups the current scope under the tree service package.",
      reviewFlags: ["Review access width and rigging constraints"],
    });
  }

  if (largeTree || mediumTree) {
    const source = largeTree ?? mediumTree!;
    lineItems.push({
      name: source.name,
      sourceId: source.id,
      sourceType: source.matchType,
      quantity: 1,
      unitOfMeasure: "EA",
      confidence: largeTree ? 0.91 : 0.78,
      rationale: "Matched tree removal assembly using tree height and oak-removal cues.",
      reviewFlags: parsedScope.quantities.treeDiameterInches == null ? ["Assumed tree diameter from height cue"] : [],
    });
  }

  if (stump) {
    lineItems.push({
      name: stump.name,
      sourceId: stump.id,
      sourceType: "costItem",
      quantity: 1,
      unitOfMeasure: "EA",
      confidence: 0.84,
      rationale: "Stump grinding matched directly from the scope.",
      reviewFlags: ["Grinding depth not provided"],
    });
  }

  if (haulAway) {
    lineItems.push({
      name: haulAway.name,
      sourceId: haulAway.id,
      sourceType: haulAway.matchType,
      quantity: 1,
      unitOfMeasure: "Load",
      confidence: 0.81,
      rationale: "Haul-away and debris removal matched directly from the request.",
      reviewFlags: ["Haul volume not specified"],
    });
  }

  return lineItems;
}

function scoreEntry(name: string, normalized: string, parsedScope: ParsedScope): number {
  const lower = name.toLowerCase();
  let score = 0;
  if (normalized.includes("tree") && lower.includes("tree")) score += 4;
  if (normalized.includes("stump") && lower.includes("stump")) score += 4;
  if (normalized.includes("haul") && (lower.includes("haul") || lower.includes("disposal"))) score += 3;
  if (normalized.includes("debris") && (lower.includes("debris") || lower.includes("disposal"))) score += 2;
  if (parsedScope.trade === "Tree Service" && lower.includes("tree")) score += 2;
  if (normalized.includes("oak") && (lower.includes("oak") || lower.includes("tree"))) score += 1;
  return score;
}

function buildRationale(name: string, normalized: string): string {
  const lower = name.toLowerCase();
  const matched: string[] = [];
  if (normalized.includes("tree") && lower.includes("tree")) matched.push("tree removal");
  if (normalized.includes("stump") && lower.includes("stump")) matched.push("stump grinding");
  if (normalized.includes("haul") && lower.includes("haul")) matched.push("haul-away");
  if (normalized.includes("debris") && (lower.includes("debris") || lower.includes("disposal"))) matched.push("debris disposal");
  return matched.length ? `Matched on ${matched.join(", ")}.` : "Closest knowledge-book keyword match.";
}

function extractNumberBefore(text: string, tokens: string[], fallback: number): number {
  for (const token of tokens) {
    const match = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${token}`));
    if (match) return Number(match[1]);
  }
  return fallback;
}
