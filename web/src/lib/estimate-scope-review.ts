export interface EstimateScopeReview {
  projectId: string;
  estimateId: string;
  scope: string;
}

/** A response reviews one scope in one estimate; it cannot approve a later edit. */
export function isEstimateScopeReviewCurrent(
  reviewed: EstimateScopeReview | null,
  current: EstimateScopeReview,
): boolean {
  return reviewed !== null && current.scope.trim().length > 0 &&
    reviewed.projectId === current.projectId && reviewed.estimateId === current.estimateId &&
    reviewed.scope.trim() === current.scope.trim();
}
