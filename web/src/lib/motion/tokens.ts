/**
 * TradeOS Motion tokens (spec §02).
 *
 * Source: the TradeOS Motion System specification (Billy-supplied image,
 * 2026-10-01) reconciled with the existing production token scale in
 * web/src/app/globals.css. Where a spec value already exists in production
 * (--dur-1 = 120ms, --dur-3 = 320ms, --ease-emphasized =
 * cubic-bezier(0.16,1,0.3,1)), motion.css aliases it instead of duplicating
 * the value, so the two scales cannot drift apart.
 *
 * Rules carried by these tokens:
 * - No spring, bounce, or overshoot: every easing is a cubic-bezier.
 * - Figma seconds = engineering milliseconds / 1000.
 * - Motion never governs network time: no duration here is a timeout, a
 *   polling interval, or a condition for persistence.
 * - Reduced motion is 100ms, opacity-only, never travel or stagger.
 */

export const MOTION_DURATIONS_MS = {
  /** Routine micro-interaction (also --dur-1). Range 100–180ms. */
  micro: 120,
  /** Ordinary state transition. Range 180–350ms. */
  state: 240,
  /** Resolve contract: ambiguous input becomes reviewable structure. */
  resolve: 320,
  /** Connect contract: one link in a relationship chain. */
  connect: 280,
  /** Recalculate contract: numeric cause -> effect. */
  recalculate: 220,
  /** Advance contract: lifecycle or dependency step. */
  advance: 280,
  /** Complete contract: meaningful work finished. */
  complete: 240,
  /** Signature chain ceiling. Range 350–900ms total. */
  signature: 640,
  /** Reduced-motion duration: opacity only, no travel or stagger. */
  reduced: 100,
} as const;

export type MotionDurationName = keyof typeof MOTION_DURATIONS_MS;

export const MOTION_EASINGS = {
  /** Settle, matching Entry. Also --ease-emphasized. */
  settle: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** Transit between states. */
  transit: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Exit. */
  exit: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

export type MotionEasingName = keyof typeof MOTION_EASINGS;

/** Stagger between revealed items; capped so a long list never drags. */
export const MOTION_STAGGER_MS = 35;
/** Maximum total stagger across a revealed sequence. */
export const MOTION_STAGGER_CAP_MS = 105;
/** Maximum content displacement for a motion treatment. */
export const MOTION_DISPLACEMENT_PX = 4;

/**
 * Delay for the item at `index` in a staggered reveal. The cap keeps the
 * whole sequence inside one signature beat regardless of list length.
 */
export function staggerDelayMs(index: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.min(Math.floor(index) * MOTION_STAGGER_MS, MOTION_STAGGER_CAP_MS);
}

/** Figma seconds = engineering milliseconds / 1000 (spec §02). */
export function figmaSecondsToMs(seconds: number): number {
  return seconds * 1000;
}

export function msToFigmaSeconds(ms: number): number {
  return ms / 1000;
}
