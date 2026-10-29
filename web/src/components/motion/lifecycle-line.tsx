"use client";

/**
 * LifecycleLine (spec §13) — contextual lifecycle orientation only.
 *
 * Not navigation: stages render as plain list items, never links or
 * buttons. Advance is purely presentational: the caller passes already
 * acknowledged state (see mapLifecycleStates), and this component never
 * promotes a pending stage. Blocked and changed stages show visible text
 * labels, not color alone; the current stage uses the copper marker.
 * Reduced motion renders the same states statically (motion.css).
 */

import { mapLifecycleStates, type LifecycleStageState } from "@/lib/motion/lifecycle";
import { cn } from "@/lib/utils";

export type LifecycleLineStage<Stage extends string> = {
  id: Stage;
  label: string;
};

type LifecycleLineProps<Stage extends string> = {
  /** Accessible name for the list, e.g. "Estimate workflow". */
  label: string;
  stages: ReadonlyArray<LifecycleLineStage<Stage>>;
  /** The server-confirmed current stage, or null. */
  current: Stage | null;
  completed: ReadonlyArray<Stage>;
  blocked?: ReadonlyArray<Stage>;
  changed?: ReadonlyArray<Stage>;
};

const STATE_TEXT: Record<LifecycleStageState, string | null> = {
  completed: null,
  current: "Current",
  upcoming: null,
  blocked: "Blocked",
  changed: "Changed",
};

export function LifecycleLine<Stage extends string>(props: LifecycleLineProps<Stage>) {
  const states = mapLifecycleStates(
    props.stages.map((stage) => stage.id),
    {
      current: props.current,
      completed: props.completed,
      blocked: props.blocked,
      changed: props.changed,
    },
  );
  return (
    <ol aria-label={props.label} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {props.stages.map((stage) => {
        const state = states[stage.id];
        const stateText = STATE_TEXT[state];
        return (
          <li key={stage.id} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "inline-block size-2 rounded-full",
                state === "current" && "bg-primary",
                state === "completed" && "bg-muted-foreground",
                state === "upcoming" && "border border-muted-foreground bg-transparent",
                state === "blocked" && "bg-destructive",
                state === "changed" && "bg-warning",
              )}
            />
            <span
              className={cn(
                "text-sm",
                state === "current" ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {stage.label}
            </span>
            {stateText ? (
              <span className="text-xs font-medium text-muted-foreground">({stateText})</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
