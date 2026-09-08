"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import { CHANGELOG, LATEST_CHANGELOG_ID } from "@/lib/changelog";
import { cn } from "@/lib/utils";

const SEEN_KEY = "tradeos-whats-new-seen";
const SEEN_EVENT = "tradeos-whats-new-seen-change";

function getLastSeen(): string {
  try {
    return window.localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, LATEST_CHANGELOG_ID);
    window.dispatchEvent(new Event(SEEN_EVENT));
  } catch {
    // No persistence available; the dot just won't stay dismissed.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(SEEN_EVENT, onChange);
  return () => window.removeEventListener(SEEN_EVENT, onChange);
}

function getServerSnapshot() {
  return "";
}

/** Bell-style trigger + panel surfacing real shipped changes, so contractors
 *  discover improvements instead of finding them by accident. */
export function WhatsNewPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const lastSeen = useSyncExternalStore(subscribe, getLastSeen, getServerSnapshot);
  const hasUnseen = lastSeen !== LATEST_CHANGELOG_ID;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    markSeen();
    const onClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={hasUnseen ? "What's new (unread updates)" : "What's new"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((value) => !value)}
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        {hasUnseen ? (
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-info" aria-hidden="true" />
        ) : null}
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="What's new"
          className="absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-(--elev-4) animate-in fade-in-0 zoom-in-95 duration-(--dur-2) ease-(--ease-emphasized)"
        >
          <h2 className="text-sm font-semibold text-foreground">What&apos;s new</h2>
          <div className="mt-3 max-h-80 space-y-4 overflow-y-auto">
            {CHANGELOG.map((entry) => (
              <div key={entry.id}>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{entry.date}</p>
                <ul className="mt-1.5 space-y-1">
                  {entry.items.map((item) => (
                    <li key={item} className={cn("text-sm text-foreground before:mr-2 before:text-info before:content-['•']")}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
