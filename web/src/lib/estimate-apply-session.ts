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
  isDefinitiveRejection?: (error: unknown) => boolean;
}

/** Known refusal statuses from this route; unknown/transient errors stay conservative. */
export function isDefinitiveEstimateApplyStatus(status: number): boolean {
  return [400, 403, 404, 409].includes(status);
}

/** One explicit write at a time; an unconfirmed attempt retains its exact body. */
export function createEstimateApplySession<Response>() {
  let retained: EstimateApplySnapshot | null = null;
  let pending = false;
  let hadUnconfirmedResponse = false;
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
        hadUnconfirmedResponse = false;
        attempt.onSuccess(response);
        return true;
      } catch (error) {
        // A later rejection cannot prove that an earlier lost response did not commit.
        if (attempt.isDefinitiveRejection?.(error) && !hadUnconfirmedResponse) retained = null;
        else hadUnconfirmedResponse = true;
        if (attempt.isCurrent()) attempt.onError(error);
        return false;
      } finally {
        pending = false;
      }
    },
  };
}
