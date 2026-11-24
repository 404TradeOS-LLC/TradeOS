"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media-query hook.
 *
 * Server rendering and the first client render both report false, so content
 * gated on the query never hydrates mismatched; the live value is applied
 * after mount and follows viewport changes. Unmounting gated content releases
 * any effects it owns (scroll locks, keyboard handlers) — CSS hiding alone
 * (e.g. `md:hidden`) does not.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [query]);

  return matches;
}
