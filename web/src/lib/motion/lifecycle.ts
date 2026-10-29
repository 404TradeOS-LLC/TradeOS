/**
 * Lifecycle state mapping (spec §§06, 13).
 *
 * Contextual lifecycle only — never navigation. A stage's visual state is
 * derived exclusively from acknowledged state: the caller passes what the
 * server has confirmed, and this mapper never promotes a pending, predicted,
 * or in-flight stage to current or completed. Invalidation restores the
 * last confirmed state because the caller simply re-passes it.
 *
 * Precedence (explicit states stay visible): blocked > changed > current >
 * completed > upcoming. Blocked and changed use labels as well as copper,
 * so meaning never rides on color alone.
 *
 * The marker geometry helper is the advance contract's FLIP measurement:
 * given the active segment's box and the track's box, it returns the
 * marker's left offset and width in pixels. Components animate the marker
 * with transform/width; measurement happens once per acknowledged change,
 * not per frame.
 */

export type LifecycleStageState =
  | "completed"
  | "current"
  | "upcoming"
  | "blocked"
  | "changed";

export type AcknowledgedLifecycle<Stage extends string> = {
  /** The confirmed current stage, or null when nothing is current. */
  current: Stage | null;
  /** Stages the server has confirmed as completed. */
  completed: ReadonlyArray<Stage>;
  /** Stages blocked by an unresolved prerequisite. */
  blocked?: ReadonlyArray<Stage>;
  /** Stages whose confirmed content changed after completion. */
  changed?: ReadonlyArray<Stage>;
};

export function mapLifecycleStates<Stage extends string>(
  stages: ReadonlyArray<Stage>,
  acknowledged: AcknowledgedLifecycle<Stage>,
): Record<Stage, LifecycleStageState> {
  const blocked = new Set(acknowledged.blocked ?? []);
  const changed = new Set(acknowledged.changed ?? []);
  const completed = new Set(acknowledged.completed);
  const result = {} as Record<Stage, LifecycleStageState>;
  for (const stage of stages) {
    if (blocked.has(stage)) result[stage] = "blocked";
    else if (changed.has(stage)) result[stage] = "changed";
    else if (acknowledged.current === stage) result[stage] = "current";
    else if (completed.has(stage)) result[stage] = "completed";
    else result[stage] = "upcoming";
  }
  return result;
}

export type MarkerGeometry = { left: number; width: number };

/**
 * Marker box relative to its track. Returns null when either box has no
 * width (unmeasured layout); callers keep the previous geometry in that
 * case instead of jumping the marker to zero.
 */
export function markerGeometry(
  segment: { left: number; width: number },
  track: { left: number; width: number },
): MarkerGeometry | null {
  if (segment.width <= 0 || track.width <= 0) return null;
  return { left: segment.left - track.left, width: segment.width };
}
