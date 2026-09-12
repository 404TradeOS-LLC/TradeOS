"use client";

import { useEffect, useRef, useState } from "react";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "⌘ / Ctrl + K", label: "Open search" },
  { keys: "?", label: "Show this shortcuts list" },
  { keys: "Esc", label: "Close a dialog or menu" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Global "?" -> keyboard shortcuts reference, mounted once in the app shell.
 * Lists the shortcuts that work on every page; the estimate builder's own
 * richer local set (search-picker navigation) stays documented inline there
 * rather than duplicated here, where it would drift out of sync.
 */
export function KeyboardShortcutsOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        setIsOpen(true);
      } else if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm animate-in fade-in-0 duration-(--dur-2)"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-overlay-title"
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-(--elev-4) animate-in fade-in-0 zoom-in-95 duration-(--dur-3) ease-(--ease-emphasized)"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="shortcuts-overlay-title" className="text-base font-semibold text-foreground">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Close
          </button>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.label} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{shortcut.label}</span>
              <kbd className="rounded border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs text-foreground">{shortcut.keys}</kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Some pages, like the estimate builder, have their own additional shortcuts shown inline.</p>
      </div>
    </div>
  );
}
