import fs from "node:fs";
import path from "node:path";

export interface KnowledgeBookEntry {
  id: string;
  name: string;
  category: string;
  unitOfMeasure?: string | null;
  lineItems?: Array<{
    name?: string;
    quantity?: number;
    unitOfMeasure?: string | null;
  }>;
}

export interface KnowledgeBook {
  assemblies: KnowledgeBookEntry[];
  items: KnowledgeBookEntry[];
}

export interface AssemblyIndexEntry {
  group: string;
  category: string;
  count: number;
  source: string;
  description: string;
}

const COSTBOOK_PATH = path.resolve(process.cwd(), "..", "packages", "knowledge-engine", "exports", "json", "costbook.json");
const ASSEMBLY_INDEX_PATH = path.resolve(process.cwd(), "..", "packages", "knowledge-engine", "knowledge", "knowledge", "assembly-index.json");

export function loadKnowledgeBook(): KnowledgeBook {
  const raw = fs.readFileSync(COSTBOOK_PATH, "utf8");
  const parsed = JSON.parse(raw) as KnowledgeBook;
  return {
    assemblies: Array.isArray(parsed.assemblies) ? parsed.assemblies : [],
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

export function loadAssemblyIndex(): AssemblyIndexEntry[] {
  const raw = fs.readFileSync(ASSEMBLY_INDEX_PATH, "utf8");
  const parsed = JSON.parse(raw) as { assemblies?: AssemblyIndexEntry[] };
  return Array.isArray(parsed.assemblies) ? parsed.assemblies : [];
}
