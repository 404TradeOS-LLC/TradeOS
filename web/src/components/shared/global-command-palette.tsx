"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CommandPaletteContext, useCommandPalette } from "@/hooks/use-command-palette";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { CommandAction, commandPaletteActions, listRecentItems, recordRecentItem, searchIntelligence, SearchResult } from "@/lib/intelligence";

type PaletteItem =
  | ({ kind: "action" } & CommandAction)
  | ({ kind: "recent" } & {
      id: string;
      title: string;
      subtitle?: string | null;
      href: string;
      entityType: SearchResult["entityType"];
      entityId: string;
      keywords?: string[];
      updatedAt?: string | null;
    })
  | ({ kind: "result" } & SearchResult);

function matchesAction(query: string, action: CommandAction) {
  if (!query) return action.favorite;
  const haystack = [action.title, action.subtitle, ...action.keywords].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function getPaletteItemKey(item: PaletteItem) {
  if (item.kind === "result") {
    return `${item.kind}-${item.entityType}-${item.entityId}`;
  }
  return `${item.kind}-${item.id}`;
}

export function GlobalCommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [completedSearchQuery, setCompletedSearchQuery] = useState("");
  const [recentItems, setRecentItems] = useState<PaletteItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const closePalette = useCallback(() => {
    // Guard against a no-op close (e.g. Escape pressed while already closed,
    // in an unrelated field) reusing a stale previouslyFocusedRef and
    // yanking focus back to wherever the palette was last opened from.
    if (!isOpen) return;
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(0);
  }, [isOpen]);

  const openPalette = useCallback(() => {
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsOpen(true);
    setActiveIndex(0);
  }, []);

  const togglePalette = () => {
    if (isOpen) {
      closePalette();
      return;
    }
    openPalette();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (isOpen) {
          closePalette();
        } else {
          openPalette();
        }
      }
      if (event.key === "Escape") {
        closePalette();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closePalette, openPalette]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsSearchLoading(true);
      setSearchError(false);
      try {
        setResults(await searchIntelligence(trimmedQuery));
        setCompletedSearchQuery(trimmedQuery);
        setSearchError(false);
      } catch {
        setResults([]);
        setCompletedSearchQuery(trimmedQuery);
        setSearchError(true);
      } finally {
        setIsSearchLoading(false);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isOpen, query]);

  useEffect(() => {
    if (!isOpen) return;
    void listRecentItems()
      .then((items) =>
        setRecentItems(
          items.map((item) => ({
            kind: "recent" as const,
            id: item.id,
            title: item.title,
            subtitle: item.subtitle,
            href: item.href,
            entityType: item.entityType,
            entityId: item.entityId,
            keywords: item.keywords,
            updatedAt: item.updatedAt,
          }))
        )
      )
      .catch(() => setRecentItems([]));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    const previouslyFocused = previouslyFocusedRef.current;
    previouslyFocusedRef.current = null;
    previouslyFocused?.focus();
  }, [isOpen]);

  // Coordinate with the More sheet so closing either overlay cannot restore
  // body scrolling while the other overlay is still open.
  useBodyScrollLock(isOpen);

  const visibleActions = useMemo(
    () => commandPaletteActions.filter((action) => matchesAction(query, action)).map((action) => ({ ...action, kind: "action" as const })),
    [query]
  );

  const items = useMemo<PaletteItem[]>(() => {
    if (!query.trim()) {
      return [...visibleActions, ...recentItems];
    }
    return [...visibleActions, ...results.map((result) => ({ ...result, kind: "result" as const }))];
  }, [query, recentItems, results, visibleActions]);

  const effectiveActiveIndex = items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1);
  const announceNoMatches =
    Boolean(query.trim()) && completedSearchQuery === query.trim() && items.length === 0 && !isSearchLoading && !searchError;

  const navigateToItem = async (item: PaletteItem) => {
    closePalette();
    if (item.kind !== "action") {
      void recordRecentItem({
        entityType: item.entityType,
        entityId: item.entityId,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
        keywords: item.keywords,
        updatedAt: item.updatedAt,
      });
    }
    router.push(item.href);
  };

  return (
    <CommandPaletteContext.Provider
      value={{
        isOpen,
        open: openPalette,
        close: closePalette,
        toggle: togglePalette,
      }}
    >
      {children}
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 px-4 pt-[12vh] backdrop-blur-sm animate-in fade-in-0 duration-(--dur-2)"
          onClick={closePalette}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card shadow-(--elev-4) animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-(--dur-3) ease-(--ease-emphasized)"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((value) => (items.length === 0 ? 0 : (value + 1) % items.length));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((value) => (items.length === 0 ? 0 : (value - 1 + items.length) % items.length));
              } else if (event.key === "Enter" && items[effectiveActiveIndex]) {
                event.preventDefault();
                void navigateToItem(items[effectiveActiveIndex]);
              } else if (event.key === "Tab") {
                // Keep keyboard focus contained to the dialog while it's open.
                const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
                  'input:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [href], [tabindex]:not([tabindex="-1"])'
                );
                if (!focusable || focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const activeElement = document.activeElement;
                const focusOutsidePanel = !panelRef.current?.contains(activeElement);
                if (event.shiftKey && (focusOutsidePanel || activeElement === first)) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && (focusOutsidePanel || activeElement === last)) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-4">
              <Search className="size-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search customers, projects, estimates, invoices, or jump to an action"
                className="h-10 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-listbox"
                aria-autocomplete="list"
                aria-activedescendant={items[effectiveActiveIndex] ? `cmdk-option-${getPaletteItemKey(items[effectiveActiveIndex])}` : undefined}
              />
              <div className="hidden rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground md:block">Esc</div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-3">
              {!query.trim() ? (
                <SectionLabel label="Favorite actions" />
              ) : (
                <SectionLabel label="Results" />
              )}

              <div id="command-palette-listbox" role="listbox" aria-label="Command palette results" className="space-y-1">
                {items.length === 0 ? (
                  <div role="option" aria-selected="false" aria-disabled="true" className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    No matches yet. Try a customer name, project address, or a quick action like “create project”.
                  </div>
                ) : (
                  items.map((item, index) => (
                    <button
                      key={getPaletteItemKey(item)}
                      id={`cmdk-option-${getPaletteItemKey(item)}`}
                      type="button"
                      role="option"
                      aria-selected={index === effectiveActiveIndex}
                      tabIndex={-1}
                      onClick={() => void navigateToItem(item)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors",
                        index === effectiveActiveIndex ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/60"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {item.kind === "action" && item.favorite ? <Star className="size-3.5 text-warning" /> : null}
                          <span className="truncate">{item.title}</span>
                        </div>
                        {item.subtitle ? <div className="mt-1 truncate text-xs text-muted-foreground">{item.subtitle}</div> : null}
                      </div>
                      <div className="ml-4 shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {item.kind === "action" ? "Action" : item.entityType.replaceAll("_", " ")}
                      </div>
                    </button>
                  ))
                )}
              </div>
              {announceNoMatches ? (
                <div role="status" aria-live="polite" className="sr-only">
                  No command palette matches found.
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <div>Use arrows to navigate and Enter to open.</div>
              <div className="hidden gap-2 md:flex">
                <span className="rounded border border-border px-1.5 py-0.5">↑</span>
                <span className="rounded border border-border px-1.5 py-0.5">↓</span>
                <span className="rounded border border-border px-1.5 py-0.5">↵</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </CommandPaletteContext.Provider>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</div>;
}

export function CommandPaletteTrigger({ onBeforeOpen }: { onBeforeOpen?: () => void } = {}) {
  const { isOpen, toggle } = useCommandPalette();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2 text-muted-foreground"
      onClick={() => {
        if (!isOpen) onBeforeOpen?.();
        toggle();
      }}
    >
      <Search className="size-4" />
      <span className="hidden sm:inline">Search</span>
      <span className="hidden rounded border border-border px-1.5 py-0.5 text-[11px] sm:inline">⌘K</span>
    </Button>
  );
}
