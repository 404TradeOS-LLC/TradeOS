"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  /** Accessible name for the dialog (aria-label). */
  label: string;
  /** Accessible label for the backdrop close button. */
  closeLabel: string;
  /** Called on backdrop click, Escape, or any in-sheet close control. */
  onClose: () => void;
  /** Extra classes merged onto the sheet panel (tailwind-merge: later wins). */
  panelClassName?: string;
  /** Control that opened the sheet; focus returns here on close when the
   *  previously focused element is gone. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * The production bottom sheet (DESIGN.md §11 Bottom Sheet contract), promoted
 * from the AppNav Create/More sheets rather than invented a second time.
 *
 * Behavior, kept identical to the AppNav sheets this was extracted from:
 * safe-area padding, body-scroll lock, backdrop close, Escape close, focus
 * trap while open, and focus restoration on close. The panel is a bottom
 * sheet by default; callers may override its geometry through
 * panelClassName (e.g. a floating card that ends above the Control Dock).
 *
 * Rendered only while open; mounting focuses the panel.
 */
export function BottomSheet({
  label,
  closeLabel,
  onClose,
  panelClassName,
  returnFocusRef,
  children,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(true);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const fallbackFocusTarget = returnFocusRef?.current ?? null;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      const focusOutsideSheet = !panelRef.current.contains(activeElement);
      if (event.shiftKey && (focusOutsideSheet || activeElement === panelRef.current || activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (focusOutsideSheet || activeElement === panelRef.current || activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      } else {
        fallbackFocusTarget?.focus();
      }
    };
    // onClose/returnFocusRef are stable by contract in the two callers
    // (AppNav setState wrappers and the job sheet's router navigation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px] animate-in fade-in-0 duration-(--dur-2)"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-2xl border-t border-border/70 bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] shadow-(--elev-4) outline-none animate-in slide-in-from-bottom duration-(--dur-3) ease-(--ease-emphasized)",
          panelClassName
        )}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
