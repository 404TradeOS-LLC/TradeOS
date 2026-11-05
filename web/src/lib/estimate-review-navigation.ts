interface ReviewNavigation {
  scope: string;
  persistedScope: string;
  isDraft: boolean;
  saveScope: (scope: string) => Promise<unknown>;
  navigate: () => void;
  onPendingChange: (pending: boolean) => void;
  isCurrent: () => boolean;
}

/** One acknowledged Project save may precede navigation; failed saves never navigate. */
export function createEstimateReviewNavigator() {
  let pending = false;
  return async (request: ReviewNavigation): Promise<boolean> => {
    if (pending || !request.isCurrent()) return false;
    pending = true;
    request.onPendingChange(true);
    try {
      const scope = request.scope.trim();
      if (request.isDraft && scope !== request.persistedScope.trim()) {
        await request.saveScope(scope);
      }
      if (!request.isCurrent()) return false;
      request.navigate();
      return true;
    } catch {
      // The existing save mutation owns the visible error and retained editor value.
      return false;
    } finally {
      pending = false;
      request.onPendingChange(false);
    }
  };
}

interface ProjectScopeForReview {
  id: string;
  simpleScope?: string | null;
  estimates: ReadonlyArray<{ id: string; projectId: string }>;
}

/** The authorized Project response must own the requested Estimate before exposing scope. */
export function savedScopeForEstimateReview(
  project: ProjectScopeForReview,
  projectId: string,
  estimateId: string,
): string | null {
  if (project.id !== projectId || !project.estimates.some(
    (estimate) => estimate.id === estimateId && estimate.projectId === projectId,
  )) return null;
  return project.simpleScope ?? "";
}
