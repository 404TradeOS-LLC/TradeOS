/**
 * Reduced-motion preference resolution (spec §16).
 *
 * Engineering rule: `matchMedia("(prefers-reduced-motion: reduce)")` plus an
 * optional user preference. Reduced motion always wins when either source
 * asks for it. The pure resolver below is unit-tested; the React hook in
 * use-motion-preference.ts only wires it to matchMedia / localStorage.
 *
 * Reduced motion never removes meaning: labels, deltas, reasons, and error
 * text stay on screen. It only removes travel, stagger, path animation, and
 * layout reordering, replacing them with an instant state swap or a
 * <=100ms opacity change (see motion.css).
 */

export type MotionPreference = "full" | "reduced";
export type StoredMotionPreference = MotionPreference | null;

export const MOTION_PREFERENCE_STORAGE_KEY = "tradeos-motion-preference";

/**
 * Reduced wins: either the OS-level reduced-motion media query or an
 * explicit stored user preference of "reduced" resolves to reduced. A stored
 * "full" preference never overrides the OS reduced-motion setting.
 */
export function resolveMotionPreference(input: {
  prefersReducedMotion: boolean;
  storedPreference: StoredMotionPreference;
}): MotionPreference {
  if (input.prefersReducedMotion) return "reduced";
  if (input.storedPreference === "reduced") return "reduced";
  return "full";
}

export function parseStoredMotionPreference(
  value: string | null,
): StoredMotionPreference {
  if (value === "reduced" || value === "full") return value;
  return null;
}
