"use client";

/**
 * Client hook for the motion preference (spec §16).
 *
 * Listens to the OS reduced-motion media query and to the optional stored
 * user preference. Server-rendered output defaults to "full" and corrects on
 * mount; nothing in this hook reads or writes business state.
 */

import { useCallback, useEffect, useState } from "react";
import {
  MOTION_PREFERENCE_STORAGE_KEY,
  parseStoredMotionPreference,
  resolveMotionPreference,
  type MotionPreference,
} from "./preference";

function readPreference(): MotionPreference {
  if (typeof window === "undefined") return "full";
  const prefersReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let stored = null;
  try {
    stored = parseStoredMotionPreference(
      window.localStorage.getItem(MOTION_PREFERENCE_STORAGE_KEY),
    );
  } catch {
    stored = null;
  }
  return resolveMotionPreference({ prefersReducedMotion: prefersReduced, storedPreference: stored });
}

export function useMotionPreference(): {
  preference: MotionPreference;
  reduced: boolean;
  setPreference: (preference: MotionPreference | null) => void;
} {
  // Lazy initializer reads the live value on the client and defaults to
  // "full" during server rendering (readPreference guards window).
  const [preference, setPreferenceState] = useState<MotionPreference>(() => readPreference());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPreferenceState(readPreference());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Mirror the preference onto <html data-motion> so motion.css can honor
  // the stored user preference on surfaces that do not use this hook.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.motion = preference;
    }
  }, [preference]);

  const setPreference = useCallback((next: MotionPreference | null) => {
    if (typeof window !== "undefined") {
      try {
        if (next === null) {
          window.localStorage.removeItem(MOTION_PREFERENCE_STORAGE_KEY);
        } else {
          window.localStorage.setItem(MOTION_PREFERENCE_STORAGE_KEY, next);
        }
      } catch {
        // Storage unavailable: the media query still governs.
      }
    }
    setPreferenceState(readPreference());
  }, []);

  return { preference, reduced: preference === "reduced", setPreference };
}
