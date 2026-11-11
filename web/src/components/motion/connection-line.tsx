"use client";

/**
 * ConnectionLine (spec §04) — the connect contract's display shape.
 *
 * A fixed SVG datum travels once from source to destination while the
 * relationship is genuinely pending, then rests at full span when the
 * caller confirms it. There is no ambient loop: the datum stops when the
 * process resolves. On failure the link is marked failed, the source is
 * kept, and a scoped retry renders only when the caller supplies one —
 * the retry action itself stays with the caller.
 *
 * Reduced motion renders a static line with both endpoint labels
 * (motion.css); the datum never travels.
 */

import { cn } from "@/lib/utils";

export type ConnectionStatus = "pending" | "confirmed" | "failed";

type ConnectionLineProps = {
  sourceLabel: string;
  destinationLabel: string;
  status: ConnectionStatus;
  /** Scoped retry owned by the caller; rendered only when provided. */
  onRetry?: () => void;
};

export function ConnectionLine(props: ConnectionLineProps) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2" role="img" aria-label={`${props.sourceLabel} to ${props.destinationLabel}: ${props.status}`}>
        <span className="shrink-0 text-sm text-foreground">{props.sourceLabel}</span>
        <svg
          aria-hidden="true"
          className="h-4 min-w-12 flex-1 text-primary"
          viewBox="0 0 100 4"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="2" x2="100" y2="2" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <line
            x1="0"
            y1="2"
            x2="100"
            y2="2"
            stroke="currentColor"
            strokeWidth="2"
            className={cn(
              "motion-connect-datum",
              props.status === "failed" && "text-destructive",
            )}
            data-state={props.status}
          />
        </svg>
        <span className="shrink-0 text-sm text-foreground">{props.destinationLabel}</span>
      </div>
      {props.status === "failed" ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Connection failed. The source was kept.</span>
          {props.onRetry ? (
            <button
              type="button"
              onClick={props.onRetry}
              className="font-medium text-primary underline underline-offset-2"
            >
              Retry
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
