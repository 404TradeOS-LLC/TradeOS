"use client";

/**
 * StatusRegion (spec §16) — the single accessible announcement channel.
 *
 * One meaningful result is announced politely; errors assertively. The
 * region renders text only (visually hidden) and never announces counters
 * or repeated identical messages as new events: callers pass a new message
 * only when something meaningful actually changed.
 */

type StatusRegionProps = {
  message: string | null;
  assertive?: boolean;
};

export function StatusRegion(props: StatusRegionProps) {
  return (
    <div
      role="status"
      aria-live={props.assertive ? "assertive" : "polite"}
      aria-atomic="true"
      className="sr-only"
    >
      {props.message ?? ""}
    </div>
  );
}
