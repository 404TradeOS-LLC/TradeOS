import { KnowledgeRepositorySnapshot } from "./types";

let cachedSnapshot: KnowledgeRepositorySnapshot | null = null;

export function getCachedKnowledgeRepositorySnapshot(
  buildSnapshot: () => KnowledgeRepositorySnapshot
): KnowledgeRepositorySnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = buildSnapshot();
  }

  return cachedSnapshot;
}

export function resetKnowledgeRuntimeCache() {
  cachedSnapshot = null;
}
