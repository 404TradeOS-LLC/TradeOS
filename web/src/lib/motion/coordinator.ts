/**
 * Interrupt coordinator (spec §17).
 *
 * One event-driven coordinator per presentation surface. It is keyed by
 * organization + entity + request/revision so that:
 * - an AbortController cancels obsolete in-flight work when a newer request
 *   for the same entity starts;
 * - version guards reject stale arrivals (an older revision arriving after a
 *   newer one is dropped, never rendered);
 * - repeated events (same request + revision) are deduplicated.
 *
 * This coordinator owns REQUEST state only: which revision is current and
 * which signals are aborted. Presentation state (what is on screen) stays in
 * the component; the coordinator never mutates UI, performs business
 * actions, or decides persistence. A caller must still check
 * `signal.aborted` / `isLatest()` before applying a result.
 */

export type MotionRequestKey = {
  orgId: string;
  entity: string;
  requestId: string;
  revision: number;
};

type EntityState = {
  revision: number;
  controller: AbortController;
  lastAcceptedEvent: string | null;
};

function entityKey(orgId: string, entity: string): string {
  return `${orgId}::${entity}`;
}

function eventKey(requestId: string, revision: number): string {
  return `${requestId}::${revision}`;
}

export class MotionCoordinator {
  private readonly states = new Map<string, EntityState>();

  /**
   * Start a request. Aborts the previous in-flight request for the same
   * organization + entity (if any) and returns the new request's signal.
   * Starting an older revision than the stored one is refused: the returned
   * signal is already aborted and `isLatest` will be false.
   */
  start(key: MotionRequestKey): { signal: AbortSignal; accepted: boolean } {
    const k = entityKey(key.orgId, key.entity);
    const previous = this.states.get(k);
    if (previous && key.revision < previous.revision) {
      const refused = new AbortController();
      refused.abort();
      return { signal: refused.signal, accepted: false };
    }
    previous?.controller.abort();
    const controller = new AbortController();
    this.states.set(k, {
      revision: key.revision,
      controller,
      lastAcceptedEvent: previous?.lastAcceptedEvent ?? null,
    });
    return { signal: controller.signal, accepted: true };
  }

  /** True only when this revision is still the newest for its entity. */
  isLatest(key: MotionRequestKey): boolean {
    const state = this.states.get(entityKey(key.orgId, key.entity));
    return state !== undefined && key.revision >= state.revision;
  }

  /**
   * Deduplicate repeated events and reject stale arrivals. Returns true
   * only the first time a given request + revision is accepted while it is
   * still the latest revision for its entity.
   */
  acceptEvent(key: MotionRequestKey): boolean {
    const k = entityKey(key.orgId, key.entity);
    const state = this.states.get(k);
    if (!state || key.revision < state.revision) return false;
    const event = eventKey(key.requestId, key.revision);
    if (state.lastAcceptedEvent === event) return false;
    state.lastAcceptedEvent = event;
    return true;
  }

  /** Abort the current request for an entity, if any. */
  cancel(orgId: string, entity: string): void {
    const k = entityKey(orgId, entity);
    const state = this.states.get(k);
    if (state) {
      state.controller.abort();
      this.states.delete(k);
    }
  }
}

export function createMotionCoordinator(): MotionCoordinator {
  return new MotionCoordinator();
}
