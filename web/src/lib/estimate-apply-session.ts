export interface EstimateApplySnapshot {
  readonly projectId: string;
  readonly estimateId: string;
  readonly body: string;
}

/** Serialize once: retry identity must not depend on later editor objects. */
export function snapshotEstimateApply(projectId: string, estimateId: string, payload: unknown): EstimateApplySnapshot {
  return Object.freeze({ projectId, estimateId, body: JSON.stringify(payload) });
}

interface ApplyAttempt<Response> {
  snapshot: EstimateApplySnapshot;
  isCurrent: () => boolean;
  send: (snapshot: EstimateApplySnapshot) => Promise<Response>;
  onPending: () => void;
  onSuccess: (response: Response) => void;
  onError: (error: unknown) => void;
}

/** One explicit write at a time; an unconfirmed attempt retains its exact body. */
export function createEstimateApplySession<Response>() {
  let retained: EstimateApplySnapshot | null = null;
  let pending = false;
  return {
    get isLocked() { return retained !== null; },
    async apply(attempt: ApplyAttempt<Response>): Promise<boolean> {
      if (pending || !attempt.isCurrent()) return false;
      if (retained && (retained.projectId !== attempt.snapshot.projectId || retained.estimateId !== attempt.snapshot.estimateId)) return false;
      const snapshot = retained ?? attempt.snapshot;
      retained = snapshot;
      pending = true;
      attempt.onPending();
      try {
        const response = await attempt.send(snapshot);
        if (!attempt.isCurrent()) return false;
        retained = null;
        attempt.onSuccess(response);
        return true;
      } catch (error) {
        if (attempt.isCurrent()) attempt.onError(error);
        return false;
      } finally {
        pending = false;
      }
    },
  };
}
