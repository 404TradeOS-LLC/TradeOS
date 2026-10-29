"use client";

/**
 * PriceDelta (spec §05) — the recalculate contract's display shape.
 *
 * Previous stays labelled "Previous" beside the new value, with the delta
 * and the changed input/source when the caller knows them. The numbers
 * swap in one render commit; digits never roll, and financial truth is
 * computed by the caller in integer minor units (see computePriceDelta),
 * never by this component or by any animation.
 */

import { computePriceDelta } from "@/lib/motion/price-delta";
import { cn } from "@/lib/utils";

type PriceDeltaProps = {
  previousMinor: number;
  currentMinor: number;
  currency: string;
  /** Changed input or source that caused the recalculation, when known. */
  reason?: string | null;
  label?: string;
};

export function PriceDelta(props: PriceDeltaProps) {
  const delta = computePriceDelta({
    previousMinor: props.previousMinor,
    currentMinor: props.currentMinor,
    currency: props.currency,
  });
  return (
    <div className="grid gap-1" data-price-delta={delta.direction}>
      {props.label ? (
        <p className="text-xs font-medium text-muted-foreground">{props.label}</p>
      ) : null}
      <p className="text-sm tabular-nums">
        <span className="text-muted-foreground">Previous {delta.previousFormatted}</span>
        <span aria-hidden="true" className="mx-2 text-muted-foreground">→</span>
        <span className="font-semibold text-foreground">{delta.currentFormatted}</span>
        <span
          className={cn(
            "motion-price-delta-value ml-2 text-sm tabular-nums",
            delta.direction === "increase" && "text-foreground",
            delta.direction === "decrease" && "text-foreground",
            delta.direction === "unchanged" && "text-muted-foreground",
          )}
        >
          ({delta.direction === "unchanged" ? "No change" : delta.deltaFormatted})
        </span>
      </p>
      {props.reason ? (
        <p className="text-xs text-muted-foreground">{props.reason}</p>
      ) : null}
    </div>
  );
}
