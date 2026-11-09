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
  /**
   * Caller-owned generation identity. When supplied, the entry state is
   * keyed by generation as well as content, so a new generation replays
   * the reveal even when it produces categories identical to the last
   * one. Without it, identical categories stay entered (no replay).
   */
  generationKey?: string;
};

export function ResolveSequence(props: ResolveSequenceProps) {
  // Entry state: categories mount hidden and flip to revealed on the next
  // frame, so the stagger transition actually runs. Mounting already
  // revealed skips the transition entirely (no before-change style).
  // Reduced motion still applies: the CSS override collapses the travel
  // to an instant/<=100ms opacity swap. The entered key tracks which
  // payload entered, so a new Athena payload re-enters from hidden. When
  // the caller supplies a generation key, identical categories from a new
  // generation re-enter too; otherwise identical content stays entered.
  const categoriesKey = props.categories.join("\n");
  const entryKey = props.generationKey === undefined ? categoriesKey : `${props.generationKey}\n${categoriesKey}`;
  const [enteredKey, setEnteredKey] = useState<string | null>(null);
  const entered = enteredKey === entryKey;
  useEffect(() => {
    if (!props.revealed || entered) return undefined;
    const frame = requestAnimationFrame(() => setEnteredKey(entryKey));
    return () => cancelAnimationFrame(frame);
  }, [props.revealed, entered, entryKey]);

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
