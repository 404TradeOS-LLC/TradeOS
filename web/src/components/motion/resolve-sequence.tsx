"use client";

/**
 * ResolveSequence (spec §03) — the resolve contract's display shape.
 *
 * Ambiguous input becomes reviewable structure. The raw input is always
 * retained verbatim; categories reveal whole (never typed out) with the
 * capped stagger from staggerDelayMs. Interruption is the caller's to
 * signal: passing revealed=false returns the surface to the neutral
 * "Interpreting scope…" state and invalidates the prior generation —
 * this component never renders invented intermediate stages.
 */

import { staggerDelayMs } from "@/lib/motion/tokens";

type ResolveSequenceProps = {
  /** The submitted input, retained verbatim. */
  rawInput: string;
  /** Work categories produced by the interpretation, when revealed. */
  categories: string[];
  /** True once an interpretation payload has been received. */
  revealed: boolean;
};

export function ResolveSequence(props: ResolveSequenceProps) {
  return (
    <div className="grid gap-3">
      <blockquote className="border-l-2 border-border pl-3 text-sm text-foreground">
        {props.rawInput}
      </blockquote>
      {!props.revealed ? (
        <p className="text-sm text-muted-foreground" role="status">
          Interpreting scope…
        </p>
      ) : (
        <ul className="grid gap-1.5" aria-label="Interpreted work categories">
          {props.categories.map((category, index) => (
            <li
              key={`${category}-${index}`}
              className="motion-resolve-item text-sm text-foreground"
              data-state="revealed"
              style={{ ["--motion-delay" as string]: `${staggerDelayMs(index)}ms` }}
            >
              {category}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
