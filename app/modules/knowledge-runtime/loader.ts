import fs from "node:fs";
import path from "node:path";
import { KnowledgeEnginePaths, KnowledgeRuntimeSourceFiles, KnowledgeSourceSnapshot, RawAssemblyIndexEntry, RawKnowledgeAssembly, RawKnowledgeCostItem, RawKnowledgeTradeProgressEntry } from "./types";

const REPO_MARKERS = ["packages/knowledge-engine/exports/json/costbook.json", "app/package.json"];

// Vercel's `tradeos-costbook` project deploys with Root Directory "app", so
// only files inside app/ end up in the deployed Lambda's filesystem —
// packages/knowledge-engine/, a sibling of app/ at the repo root, is never
// reachable there at runtime. scripts/vendor-knowledge-engine.js copies the
// three data directories this loader needs into app/vendor/knowledge-engine/
// as a build step. Vercel may execute this module from the source-style
// app/modules/... layout, while npm start executes the compiled dist/modules/...
// layout, so resolve against the project root first and retain the compiled
// relative candidate as a compatibility fallback.
export function vendoredKnowledgeEngineRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), "vendor", "knowledge-engine"),
    path.resolve(__dirname, "../../vendor/knowledge-engine"),
    path.resolve(__dirname, "../../../vendor/knowledge-engine"),
  ];

  return candidates.find(hasVendoredKnowledgeEngine) ?? candidates[0];
}

function hasVendoredKnowledgeEngine(root: string): boolean {
  return fs.existsSync(path.join(root, "exports", "json", "costbook.json"));
}

export function resolveKnowledgeEnginePaths(): KnowledgeEnginePaths {
  const vendoredRoot = vendoredKnowledgeEngineRoot();
  if (hasVendoredKnowledgeEngine(vendoredRoot)) {
    return {
      repoRoot: vendoredRoot,
      exportsDir: path.join(vendoredRoot, "exports"),
      knowledgeDir: path.join(vendoredRoot, "knowledge"),
      schemasDir: path.join(vendoredRoot, "schemas"),
    };
  }

  const candidates = new Set<string>([
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(__dirname, "../../.."),
    path.resolve(__dirname, "../../../.."),
  ]);

  for (const candidate of candidates) {
    if (hasRepoMarkers(candidate)) {
      return {
        repoRoot: candidate,
        exportsDir: path.join(candidate, "packages", "knowledge-engine", "exports"),
        knowledgeDir: path.join(candidate, "packages", "knowledge-engine", "knowledge"),
        schemasDir: path.join(candidate, "packages", "knowledge-engine", "schemas"),
      };
    }
  }

  throw new Error("Unable to locate the TradeOS repository root for Knowledge Engine loading.");
}

export function buildKnowledgeSourceFiles(paths: KnowledgeEnginePaths): KnowledgeRuntimeSourceFiles {
  return {
    costbookPath: path.join(paths.exportsDir, "json", "costbook.json"),
    assemblyIndexPath: path.join(paths.knowledgeDir, "knowledge", "assembly-index.json"),
    tradeProgressPath: path.join(paths.knowledgeDir, "knowledge", "trade-progress.json"),
    taxonomyPath: path.join(paths.knowledgeDir, "knowledge", "trade-taxonomy", "taxonomy.md"),
    knowledgeAssembliesDir: path.join(paths.knowledgeDir, "knowledge", "assemblies"),
    knowledgeCostItemsDir: path.join(paths.knowledgeDir, "knowledge", "cost-items"),
  };
}

export function loadKnowledgeEngineSnapshot(paths = resolveKnowledgeEnginePaths()): KnowledgeSourceSnapshot {
  const sourceFiles = buildKnowledgeSourceFiles(paths);
  const loadWarnings: string[] = [];

  const costbook = readRequiredJsonFile<{ assemblies?: RawKnowledgeAssembly[]; items?: RawKnowledgeCostItem[] }>(sourceFiles.costbookPath);
  const assemblyIndex = readOptionalJsonFile<{ assemblies?: RawAssemblyIndexEntry[] }>(sourceFiles.assemblyIndexPath, loadWarnings, "assembly index");
  const tradeProgress = readOptionalJsonFile<{ trades?: RawKnowledgeTradeProgressEntry[] }>(sourceFiles.tradeProgressPath, loadWarnings, "trade progress");
  const taxonomyText = readOptionalTextFile(sourceFiles.taxonomyPath, loadWarnings, "taxonomy");

  return {
    paths,
    sourceFiles,
    assemblies: Array.isArray(costbook.assemblies) ? costbook.assemblies : [],
    costItems: Array.isArray(costbook.items) ? costbook.items : [],
    tradeProgress: Array.isArray(tradeProgress?.trades) ? tradeProgress.trades : [],
    assemblyIndex: Array.isArray(assemblyIndex?.assemblies) ? assemblyIndex.assemblies : [],
    schemaFiles: listJsonFiles(paths.schemasDir),
    taxonomyText,
    knowledgeAssemblyFiles: listJsonFiles(sourceFiles.knowledgeAssembliesDir),
    knowledgeCostItemFiles: listJsonFiles(sourceFiles.knowledgeCostItemsDir),
    loadWarnings,
  };
}

function hasRepoMarkers(candidate: string) {
  return REPO_MARKERS.every((marker) => fs.existsSync(path.join(candidate, marker)));
}

function readRequiredJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function readOptionalJsonFile<T>(filePath: string, loadWarnings: string[], label: string): T | null {
  if (!fs.existsSync(filePath)) {
    loadWarnings.push(`Missing ${label} file at ${filePath}.`);
    return null;
  }

  return readRequiredJsonFile<T>(filePath);
}

function readOptionalTextFile(filePath: string, loadWarnings: string[], label: string): string {
  if (!fs.existsSync(filePath)) {
    loadWarnings.push(`Missing ${label} file at ${filePath}.`);
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

function listJsonFiles(directoryPath: string) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs.readdirSync(directoryPath).filter((file) => file.endsWith(".json")).sort();
}
