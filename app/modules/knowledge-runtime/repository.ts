import { getCachedKnowledgeRepositorySnapshot, resetKnowledgeRuntimeCache } from "./cache";
import { loadKnowledgeEngineSnapshot } from "./loader";
import { KnowledgeAssemblyRecord, KnowledgeCostItemRecord, KnowledgeRepositorySnapshot, KnowledgeSearchInput, KnowledgeSearchResult, KnowledgeStats, KnowledgeTrade, RawKnowledgeAssembly, RawKnowledgeCostItem } from "./types";
import { round2 } from "../estimate-engine/formulas";

const TRADE_ALIASES: Record<string, string[]> = {
  "Tree Service": ["tree", "stump", "grind", "grinding", "arborist", "brush", "debris"],
  Concrete: ["concrete", "driveway", "patio", "slab", "flatwork", "broom"],
  Deck: ["deck", "decking", "railing", "stairs", "ledger", "joist", "composite"],
  Roofing: ["roof", "roofing", "shingle", "tear-off", "reroof", "flashing", "ridge", "sheathing"],
  Bathroom: ["bathroom", "bath", "shower", "vanity", "toilet", "tile"],
  Kitchen: ["kitchen", "cabinet", "countertop", "backsplash", "appliance"],
  Landscaping: ["landscape", "mulch", "planting", "sod", "retaining", "paver"],
  Excavation: ["excavate", "grading", "grade", "dig", "site prep", "lot"],
  Siding: ["siding", "soffit", "fascia", "hardie", "smartside"],
};

export function getKnowledgeRepositorySnapshot(): KnowledgeRepositorySnapshot {
  return getCachedKnowledgeRepositorySnapshot(() => {
    const source = loadKnowledgeEngineSnapshot();
    const trades = source.tradeProgress.map((entry) => {
      const normalizedName = normalizeTradeName(entry.category);
      return {
        id: slugify(normalizedName),
        name: normalizedName,
        itemCount: entry.itemCount,
        status: entry.status,
        coverage: entry.coverage,
        notes: entry.notes,
        keywords: buildTradeKeywords(normalizedName, entry.notes),
      } satisfies KnowledgeTrade;
    });

    const schemaRefs = source.schemaFiles;
    const costItems = source.costItems.map((item) => toCostItemRecord(item, trades, schemaRefs));
    const itemById = new Map(costItems.map((item) => [item.id, item]));
    const assemblies = [
      ...source.assemblies.map((assembly) => toAssemblyRecord(assembly, trades, schemaRefs, itemById)),
      ...source.assemblyIndex.map((entry) => toAssemblyIndexRecord(entry.group, entry.category, entry.count, entry.description, trades, schemaRefs)),
    ];
    const taxonomyKeywords = buildTaxonomyKeywords(source.taxonomyText, trades);
    const indexedKeywordCount = new Set(
      [...taxonomyKeywords, ...assemblies.flatMap((assembly) => assembly.keywords), ...costItems.flatMap((item) => item.keywords)]
    ).size;

    const sourceFileCount =
      source.schemaFiles.length +
      source.knowledgeAssemblyFiles.length +
      source.knowledgeCostItemFiles.length +
      4;

    return {
      paths: source.paths,
      stats: {
        readOnly: true,
        assembliesCount: assemblies.length,
        costItemsCount: costItems.length,
        tradesCount: trades.length,
        schemaCount: schemaRefs.length,
        indexedKeywordCount,
        sourceFileCount,
        loadWarnings: source.loadWarnings,
        sources: {
          exportsDir: source.paths.exportsDir,
          knowledgeDir: source.paths.knowledgeDir,
          schemasDir: source.paths.schemasDir,
        },
      } satisfies KnowledgeStats,
      trades,
      assemblies,
      costItems,
      taxonomyKeywords,
    };
  });
}

export function resetKnowledgeRepositoryCache() {
  resetKnowledgeRuntimeCache();
}

export function searchKnowledge(input: KnowledgeSearchInput): KnowledgeSearchResult[] {
  const repository = getKnowledgeRepositorySnapshot();
  const limit = input.limit ?? 10;
  const trade = input.trade?.trim().toLowerCase();
  const records =
    input.type === "assembly"
      ? repository.assemblies
      : input.type === "costItem"
        ? repository.costItems
        : [...repository.assemblies, ...repository.costItems];

  const filteredRecords = trade ? records.filter((record) => record.trade?.toLowerCase() === trade) : records;

  return searchKnowledgeRecords(filteredRecords, input.query, limit);
}

export function searchKnowledgeRecords(
  records: Array<KnowledgeAssemblyRecord | KnowledgeCostItemRecord>,
  query: string,
  limit: number
): KnowledgeSearchResult[] {
  const normalizedQuery = normalizeText(query);
  const queryKeywords = tokenize(normalizedQuery);

  return records
    .map((record) => {
      const matchedKeywords = queryKeywords.filter((keyword) => record.keywords.includes(keyword) || normalizeText(record.description).includes(keyword));
      const confidence = scoreRecord(record, normalizedQuery, queryKeywords, matchedKeywords);
      return {
        id: record.id,
        type: "metadata" in record && "lineItemsCount" in record.metadata ? "assembly" : "costItem",
        name: record.name,
        category: record.category,
        trade: record.trade,
        unitOfMeasure: record.unitOfMeasure,
        description: record.description,
        confidence,
        matchedKeywords,
        rationale: buildSearchRationale(record.name, record.trade, matchedKeywords),
        metadata: record.metadata,
      } satisfies KnowledgeSearchResult;
    })
    .filter((result) => result.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function toAssemblyRecord(
  assembly: RawKnowledgeAssembly,
  trades: KnowledgeTrade[],
  schemaRefs: string[],
  itemById: Map<string, KnowledgeCostItemRecord>
): KnowledgeAssemblyRecord {
  const linkedItems = (assembly.lineItems ?? [])
    .map((lineItem) => (lineItem.costBookItemId ? itemById.get(lineItem.costBookItemId) : null))
    .filter((value): value is KnowledgeCostItemRecord => Boolean(value));
  const trade = inferTrade(assembly.name, assembly.category, linkedItems.map((item) => item.trade).filter((value): value is string => Boolean(value)), trades);
  const description = linkedItems.length
    ? `Assembly package in ${assembly.category} covering ${linkedItems.slice(0, 3).map((item) => item.name).join(", ")}.`
    : `Assembly package in ${assembly.category}.`;

  return {
    id: assembly.id,
    name: assembly.name,
    category: assembly.category,
    trade,
    unitOfMeasure: inferAssemblyUnit(assembly.name),
    description,
    keywords: uniqueStrings([
      ...tokenize(assembly.name),
      ...tokenize(assembly.category),
      ...linkedItems.flatMap((item) => item.keywords),
      ...(trade ? buildTradeKeywords(trade) : []),
    ]),
    metadata: {
      source: "knowledge-engine",
      lineItemsCount: assembly.lineItems?.length ?? 0,
      schemaRefs: schemaRefs.filter((schema) => schema.includes("assembly")),
    },
  };
}

function toCostItemRecord(item: RawKnowledgeCostItem, trades: KnowledgeTrade[], schemaRefs: string[]): KnowledgeCostItemRecord {
  const laborCost = toNumber(item.laborCost);
  const materialCost = toNumber(item.materialCost);
  const equipmentCost = toNumber(item.equipmentCost);
  const trade = inferTrade(item.name, item.category, [], trades);

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    trade,
    unitOfMeasure: item.unit ?? null,
    description: item.notes?.trim() || `${item.category} cost item.`,
    keywords: uniqueStrings([
      ...tokenize(item.name),
      ...tokenize(item.category),
      ...tokenize(item.notes ?? ""),
      ...(trade ? buildTradeKeywords(trade) : []),
    ]),
    metadata: {
      source: "knowledge-engine",
      laborCost,
      materialCost,
      equipmentCost,
      totalUnitCost: round2(laborCost + materialCost + equipmentCost),
      schemaRefs: schemaRefs.filter((schema) => schema.includes("cost-item")),
    },
  };
}

function toAssemblyIndexRecord(
  group: string,
  category: string,
  count: number,
  description: string,
  trades: KnowledgeTrade[],
  schemaRefs: string[]
): KnowledgeAssemblyRecord {
  const trade = inferTrade(group, `${category} ${description}`, [], trades) ?? normalizeTradeName(group);

  return {
    id: `assembly-index:${slugify(group)}`,
    name: `${group} Assembly Group`,
    category,
    trade,
    unitOfMeasure: "job",
    description,
    keywords: uniqueStrings([
      ...tokenize(group),
      ...tokenize(category),
      ...tokenize(description),
      ...buildTradeKeywords(trade),
    ]),
    metadata: {
      source: "knowledge-engine",
      lineItemsCount: count,
      schemaRefs: schemaRefs.filter((schema) => schema.includes("assembly")),
    },
  };
}

function normalizeTradeName(value: string) {
  return value === "Flatwork" ? "Concrete" : value;
}

/**
 * Deterministic, word-boundary/token-aware trade classifier.
 *
 * Replaces a prior raw-substring implementation that matched trade names
 * and aliases anywhere inside the input text, including inside unrelated
 * words (e.g. trade "Trim" matched inside "trimming"), and picked
 * whichever trade happened to appear earliest in trades.find()'s array
 * order when more than one trade's name/alias matched - an
 * order-dependent result with no relationship to which match was more
 * specific. See docs/reports/KNOWLEDGE_TRADE_INFERENCE_AUDIT_2026-09-08.md
 * for the full before/after corpus audit this rewrite was built against.
 *
 * Strategy:
 *   1. Tokenize the input into whole words (same tokenizer used for
 *      search keywords), so matching is case-insensitive and punctuation
 *      cannot join or split words unexpectedly.
 *   2. A trade or alias phrase (itself tokenized) "matches" only when its
 *      exact token sequence appears contiguously in the input tokens -
 *      never a raw substring test, so "trim" cannot match inside
 *      "trimming" and multi-word names like "Tree Service" or
 *      "General Conditions" require both words adjacent, not merely
 *      present anywhere in the text.
 *   3. Every trade is checked (not just the first in array order); the
 *      trade's own name is a higher-priority match than one of its
 *      aliases, and a longer (more specific) phrase outranks a shorter
 *      one at the same priority level.
 *   4. `category` is checked before `name` and, if it names any trade at
 *      all, wins outright (uniquely or ambiguously) without ever
 *      consulting `name`. For the canonical corpus, `category` is
 *      curated ground truth (it already equals a real trade name for
 *      essentially every legacy cost item), while `name` is a free-text
 *      description that can incidentally contain a different trade's
 *      word (e.g. "Wall Straightening And Plumbing" filed under category
 *      "Framing"). `name` is consulted only when `category` names no
 *      trade at all - the situation for every assembly, whose `category`
 *      is a descriptive label like "Assemblies - Bathroom", not a trade.
 *   5. If candidateTrades (the actual trades of an assembly's own linked
 *      cost items) has a single most-common value, that outranks both
 *      of the above - it is grounded in real linked data, not inference.
 *   6. When more than one trade ties for the single highest-ranked
 *      match within whichever field was consulted, the result is
 *      ambiguous: return null rather than guess. A record with no match
 *      at all also returns null. Callers already treat a null trade as
 *      "could not be determined" (see resolveTradeProvenanceStatus and
 *      every trade?/trade === null check in this file and matcher.ts) -
 *      this function has never guaranteed a non-null result, so
 *      returning null more often is a safe, compatible change in the
 *      failure direction.
 */
export function inferTrade(name: string, category: string, candidateTrades: string[], trades: KnowledgeTrade[]): string | null {
  const dominantCandidateTrade = pickDominantCandidateTrade(candidateTrades);
  if (dominantCandidateTrade) return dominantCandidateTrade;

  // `category` is curated ground truth for the canonical Knowledge Engine
  // corpus - for every legacy cost item it already equals a real trade
  // name exactly - while `name` is a free-text description that can
  // incidentally contain another trade's word (e.g. "Wall Straightening
  // And Plumbing" filed under category "Framing"). Resolving against
  // category first, and only falling through to name when category
  // itself named no trade at all, uses the more authoritative field
  // instead of treating both as one undifferentiated bag of words.
  const categoryMatch = resolveTextMatch(category, trades);
  if (categoryMatch.status !== "none") {
    return categoryMatch.status === "unique" ? categoryMatch.tradeName : null;
  }

  const nameMatch = resolveTextMatch(name, trades);
  return nameMatch.status === "unique" ? nameMatch.tradeName : null;
}

type TextMatchResult = { status: "none" } | { status: "ambiguous" } | { status: "unique"; tradeName: string };

function resolveTextMatch(text: string, trades: KnowledgeTrade[]): TextMatchResult {
  const inputTokens = tokenizeToWords(text);
  if (inputTokens.length === 0) return { status: "none" };

  type Match = { tradeName: string; priority: 1 | 0; phraseLength: number };
  const matches: Match[] = [];

  for (const trade of trades) {
    const nameTokens = tokenizeToWords(trade.name);
    if (nameTokens.length > 0 && containsSubsequence(inputTokens, nameTokens)) {
      matches.push({ tradeName: trade.name, priority: 1, phraseLength: nameTokens.length });
    }

    for (const alias of TRADE_ALIASES[trade.name] ?? []) {
      const aliasTokens = tokenizeToWords(alias);
      if (aliasTokens.length > 0 && containsSubsequence(inputTokens, aliasTokens)) {
        matches.push({ tradeName: trade.name, priority: 0, phraseLength: aliasTokens.length });
      }
    }
  }

  if (matches.length === 0) return { status: "none" };

  const bestByTrade = new Map<string, Match>();
  for (const match of matches) {
    const existing = bestByTrade.get(match.tradeName);
    if (!existing || match.priority > existing.priority || (match.priority === existing.priority && match.phraseLength > existing.phraseLength)) {
      bestByTrade.set(match.tradeName, match);
    }
  }

  const ranked = [...bestByTrade.values()].sort(
    (a, b) => b.priority - a.priority || b.phraseLength - a.phraseLength || a.tradeName.localeCompare(b.tradeName)
  );
  const [best, runnerUp] = ranked;
  const isAmbiguous = runnerUp != null && runnerUp.priority === best.priority && runnerUp.phraseLength === best.phraseLength;

  return isAmbiguous ? { status: "ambiguous" } : { status: "unique", tradeName: best.tradeName };
}

/**
 * candidateTrades are the actual, already-resolved trades of an
 * assembly's own linked cost items - real linked data, not text
 * inference. A single trade with strictly more occurrences than every
 * other is a reliable, order-independent signal; a tie (including a
 * tie among all-distinct single occurrences) is ambiguous and falls
 * through to text-based matching instead of picking arbitrarily.
 */
function pickDominantCandidateTrade(candidateTrades: string[]): string | null {
  const nonEmpty = candidateTrades.filter(Boolean);
  if (nonEmpty.length === 0) return null;

  const counts = new Map<string, number>();
  for (const trade of nonEmpty) counts.set(trade, (counts.get(trade) ?? 0) + 1);

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [[topTrade, topCount], second] = ranked;
  return !second || topCount > second[1] ? topTrade : null;
}

function containsSubsequence(haystack: string[], needle: string[]): boolean {
  if (needle.length > haystack.length) return false;
  outer: for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}

function tokenizeToWords(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 0);
}

function buildTaxonomyKeywords(taxonomyText: string, trades: KnowledgeTrade[]) {
  return uniqueStrings([
    ...tokenize(taxonomyText),
    ...trades.flatMap((trade) => trade.keywords),
  ]);
}

function buildTradeKeywords(trade: string, notes?: string) {
  const normalized = normalizeTradeName(trade);
  return uniqueStrings([
    ...tokenize(normalized),
    ...tokenize(notes ?? ""),
    ...(TRADE_ALIASES[normalized] ?? []),
  ]);
}

function scoreRecord(
  record: KnowledgeAssemblyRecord | KnowledgeCostItemRecord,
  normalizedQuery: string,
  queryKeywords: string[],
  matchedKeywords: string[]
) {
  if (!normalizedQuery.trim()) {
    return 0;
  }

  let score = matchedKeywords.length * 14;
  if (normalizeText(record.name).includes(normalizedQuery)) score += 30;
  if (normalizeText(record.category).includes(normalizedQuery)) score += 12;
  if (record.trade != null) {
    const trade = record.trade;
    if (queryKeywords.some((keyword) => buildTradeKeywords(trade).includes(keyword))) score += 10;
  }
  if (queryKeywords.some((keyword) => normalizeText(record.description).includes(keyword))) score += 6;

  return Math.min(99, score);
}

function buildSearchRationale(name: string, trade: string | null, matchedKeywords: string[]) {
  if (matchedKeywords.length > 0) {
    return `Matched ${name} on ${matchedKeywords.join(", ")}${trade ? ` within ${trade}` : ""}.`;
  }

  return trade ? `Closest deterministic ${trade} match from the read-only Knowledge Engine.` : "Closest deterministic match from the read-only Knowledge Engine.";
}

function inferAssemblyUnit(name: string) {
  const normalized = normalizeText(name);
  if (normalized.includes(" sf") || normalized.includes(" square foot")) return "SF";
  if (normalized.includes(" lf") || normalized.includes(" linear foot")) return "LF";
  if (normalized.includes(" package")) return "job";
  return null;
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tokenize(value: string) {
  return uniqueStrings(
    normalizeText(value)
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length >= 3)
  );
}

function normalizeText(value: string) {
  return value.toLowerCase();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
