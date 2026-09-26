type ReviewableDraftLine = {
  draftLineItemId: string;
  targetId: string | null;
  reviewToken: string | null;
};

export function toggleDraftLineSelection(currentIds: readonly string[], draftLineItemId: string, included: boolean): string[] {
  if (included) return currentIds.includes(draftLineItemId) ? [...currentIds] : [...currentIds, draftLineItemId];
  return currentIds.filter((id) => id !== draftLineItemId);
}

export function selectAcceptedDraftLines<T extends ReviewableDraftLine>(lines: readonly T[], acceptedIds: readonly string[]): T[] {
  return lines.filter((line) => acceptedIds.includes(line.draftLineItemId) && line.targetId && line.reviewToken);
}

export function generationIdForReviewer(role: string | null, generationId: string | undefined): { generationId?: string } {
  return (role === "owner" || role === "admin") && generationId ? { generationId } : {};
}
