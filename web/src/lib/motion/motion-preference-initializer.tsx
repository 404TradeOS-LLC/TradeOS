"use client";

/**
 * App-root motion preference initializer (spec §16).
 *
 * Mounts useMotionPreference once so the stored `tradeos-motion-preference`
 * is mirrored onto <html data-motion> on every surface, including ones
 * where no motion component mounts. Without this, a stored "reduced"
 * preference is never applied when the OS setting is full, and the
 * estimate stage marker still travels for 280ms.
 *
 * A separate component (rather than calling the hook in Providers) keeps
 * preference-change re-renders scoped to this null render.
 */
import { useMotionPreference } from "./use-motion-preference";

export function MotionPreferenceInitializer() {
  useMotionPreference();
  return null;
}
