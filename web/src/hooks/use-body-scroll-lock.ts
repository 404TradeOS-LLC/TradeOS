import { useEffect } from "react";

let activeLockCount = 0;
let previousBodyOverflow: string | null = null;

export function acquireBodyScrollLock(): () => void {
  if (typeof document === "undefined") return () => {};

  if (activeLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  activeLockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeLockCount = Math.max(0, activeLockCount - 1);
    if (activeLockCount === 0) {
      document.body.style.overflow = previousBodyOverflow ?? "";
      previousBodyOverflow = null;
    }
  };
}

export function useBodyScrollLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    return acquireBodyScrollLock();
  }, [enabled]);
}
