"use client";

/**
 * ChangeDiff (spec §05/§18) — the before/after preservation shape.
 *
 * The animation, if any, never replaces readable text: previous, current,
 * and the reason/source (when available) are always rendered as text.
 * This component performs no transition of its own; it exists so every
 * before/after surface uses one sanctioned shape.
 */

type ChangeDiffProps = {
  label: string;
  previous: string;
  current: string;
  reason?: string | null;
};

export function ChangeDiff(props: ChangeDiffProps) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium text-muted-foreground">{props.label}</p>
      <dl className="grid gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-muted-foreground">Previous</dt>
          <dd className="text-foreground">{props.previous}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-muted-foreground">Current</dt>
          <dd className="font-medium text-foreground">{props.current}</dd>
        </div>
        {props.reason ? (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-muted-foreground">Reason</dt>
            <dd className="text-muted-foreground">{props.reason}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
