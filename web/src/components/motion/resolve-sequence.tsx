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

import { useEffect, useState } from "react";
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
  // Entry state: categories mount hidden and flip to revealed on the next
  // frame, so the stagger transition actually runs. Mounting already
  // revealed skips the transition entirely (no before-change style).
  // Reduced motion still applies: the CSS override collapses the travel
  // to an instant/<=100ms opacity swap. The entered key tracks which
  // payload entered, so a new Athena payload re-enters from hidden.
  const categoriesKey = props.categories.join("\n");
  const [enteredKey, setEnteredKey] = useState<string | null>(null);
  const entered = enteredKey === categoriesKey;
  useEffect(() => {
    if (!props.revealed || entered) return undefined;
    const frame = requestAnimationFrame(() => setEnteredKey(categoriesKey));
    return () => cancelAnimationFrame(frame);
  }, [props.revealed, entered, categoriesKey]);

  return (
    <div className="grid gap-3">
      <blockquote className="whitespace-pre-wrap border-l-2 border-border pl-3 text-sm text-foreground">
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
              data-state={entered ? "revealed" : "hidden"}
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
