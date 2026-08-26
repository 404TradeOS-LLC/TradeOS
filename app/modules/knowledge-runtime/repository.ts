import { getCachedKnowledgeRepositorySnapshot, resetKnowledgeRuntimeCache } from "./cache";
import { loadKnowledgeEngineSnapshot } from "./loader";
import { KnowledgeAssemblyRecord, KnowledgeCostItemRecord, KnowledgeRepositorySnapshot, KnowledgeSearchInput, KnowledgeSearchResult, KnowledgeStats, KnowledgeTrade, RawKnowledgeAssembly, RawKnowledgeCostItem } from "./types";
import { round2 } from "../estimate-engine/formulas";

const TRADE_ALIASES: Record<string, string[]> = {
  "Tree Service": ["tree", "stump", "grind", "arborist", "brush", "debris"],
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

function inferTrade(name: string, category: string, candidateTrades: string[], trades: KnowledgeTrade[]): string | null {
  const normalized = normalizeText(`${name} ${category} ${candidateTrades.join(" ")}`);

  for (const candidate of candidateTrades) {
    if (candidate && normalized.includes(normalizeText(candidate))) {
      return candidate;
    }
  }

  const exactTrade = trades.find((trade) => normalized.includes(normalizeText(trade.name)));
  if (exactTrade) return exactTrade.name;

  const aliasTrade = trades.find((trade) => buildTradeKeywords(trade.name).some((keyword) => normalized.includes(keyword)));
  return aliasTrade?.name ?? null;
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
