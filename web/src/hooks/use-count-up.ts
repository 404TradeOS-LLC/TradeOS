"use client";

import { useEffect, useRef, useState } from "react";

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Animates a number from its previous value to `target` over `durationMs`,
 * so a KPI tile registers a changed value as motion instead of a static
 * swap. When the viewer prefers reduced motion, `target` is returned
 * directly every render - no animation state involved for that path at all.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [prefersReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (prefersReducedMotion) {
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    fromRef.current = target;
    if (from === target) return;

    let frame: number;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      setValue(from + (target - from) * easeOutQuad(progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, prefersReducedMotion]);

  return prefersReducedMotion ? target : value;
}
