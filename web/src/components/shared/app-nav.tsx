"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  LayoutGrid,
  MoreHorizontal,
  Palette,
  Plus,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { CommandPaletteTrigger } from "@/components/shared/global-command-palette";
import { Button } from "@/components/ui/button";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { clientFetch } from "@/lib/clientApi";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  shortLabel: string;
}

const PRIMARY_NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutGrid },
  { href: "/dispatch", label: "Dispatch", shortLabel: "Dispatch", icon: CalendarDays },
  { href: "/projects", label: "Projects", shortLabel: "Projects", icon: BriefcaseBusiness },
  { href: "/customers", label: "Customers", shortLabel: "Customers", icon: Users },
  { href: "/costbook", label: "Costbook", shortLabel: "Costbook", icon: BookOpen },
];

const SECONDARY_NAV_LINKS: NavLink[] = [
  { href: "/brand-studio", label: "Brand Studio", shortLabel: "Brand", icon: Palette },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings },
];

const ATHENA_NAV_LINK: NavLink = {
  href: "/athena",
  label: "Athena",
  shortLabel: "Athena",
  icon: Sparkles,
};

const CREATE_LINK = { href: "/projects/new", label: "Create project" };

// The 404TradeOS Control Dock keeps five thumb-reachable slots on mobile:
// Today, Dispatch, Create, Work, and More (everything else, unchanged routes).
const DOCK_LEFT_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Today", shortLabel: "Today", icon: LayoutGrid },
  { href: "/dispatch", label: "Dispatch", shortLabel: "Dispatch", icon: CalendarDays },
];
const DOCK_RIGHT_LINK: NavLink = { href: "/projects", label: "Work", shortLabel: "Work", icon: BriefcaseBusiness };

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

function formatBadgeCount(count: number) {
  return count > 9 ? "9+" : String(count);
}

/**
 * Small attention badge - real counts only (the Dispatch needsAttention
 * total the Dispatch page itself already surfaces), never a decorative dot.
 * The subtle pulse ring is the Control Dock's one "expand when something
 * needs attention" moment from the design brief; it's inert under
 * prefers-reduced-motion via the existing global override in globals.css.
 */
function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex" aria-hidden="true">
      <span className="absolute inline-flex size-full animate-pulse rounded-full bg-warning/60" />
      <span className="relative inline-flex min-w-3.5 items-center justify-center rounded-full bg-warning px-1 py-0.5 text-[9px] leading-none font-semibold text-warning-foreground">
        {formatBadgeCount(count)}
      </span>
    </span>
  );
}

function NavPill({
  link,
  pathname,
  onNavigate,
  badgeCount = 0,
}: {
  link: NavLink;
  pathname: string;
  onNavigate?: () => void;
  badgeCount?: number;
}) {
  const active = isActive(pathname, link.href);
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      aria-label={badgeCount > 0 ? `${link.label} — ${badgeCount} need attention` : undefined}
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]",
        active
          ? "border-primary/20 bg-primary/10 text-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--primary)_25%,transparent)]"
          : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-background hover:text-foreground"
      )}
    >
      <span className="relative flex">
        <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
        <NavBadge count={badgeCount} />
      </span>
      <span>{link.label}</span>
    </Link>
  );
}

export function AppNav({
  email,
  canViewAthena = false,
  dispatchAttentionCount = null,
}: {
  email?: string | null;
  canViewAthena?: boolean;
  dispatchAttentionCount?: number | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clientDispatchAttentionCount, setClientDispatchAttentionCount] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dockMoreButtonRef = useRef<HTMLButtonElement>(null);
  const effectiveDispatchAttentionCount = clientDispatchAttentionCount ?? dispatchAttentionCount;
  const dispatchBadgeCount = Math.max(effectiveDispatchAttentionCount ?? 0, 0);

  const primaryLinks = useMemo(
    () => (canViewAthena ? [...PRIMARY_NAV_LINKS, ATHENA_NAV_LINK] : PRIMARY_NAV_LINKS),
    [canViewAthena]
  );

  useBodyScrollLock(mobileOpen);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void clientFetch<{ needsAttention?: unknown }>("/api/v1/jobs/dispatch-summary", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((summary) => {
        if (!cancelled && typeof summary.needsAttention === "number") {
          setClientDispatchAttentionCount(Math.max(summary.needsAttention, 0));
        }
      })
      .catch(() => {
        // The badge is advisory; the Dispatch page remains the source of truth.
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const closeSheetOnHistoryNavigation = () => setMobileOpen(false);
    window.addEventListener("popstate", closeSheetOnHistoryNavigation);
    return () => window.removeEventListener("popstate", closeSheetOnHistoryNavigation);
  }, []);

  // Standard dialog behavior the sheet was missing: trap focus inside while
  // open, close on Escape, block the page behind from scrolling, and return
  // focus to the dock's More button on close so keyboard/screen-reader users
  // don't lose their place.
  useEffect(() => {
    if (!mobileOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const fallbackFocusTarget = dockMoreButtonRef.current;
    sheetRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      const focusOutsideSheet = !sheetRef.current.contains(activeElement);
      if (event.shiftKey && (focusOutsideSheet || activeElement === sheetRef.current || activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (focusOutsideSheet || activeElement === sheetRef.current || activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (previouslyFocused ?? fallbackFocusTarget)?.focus();
    };
  }, [mobileOpen]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-[96rem] flex-col px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-(--elev-1)">
                <ChevronRight className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-heading text-[1rem] font-semibold leading-none text-foreground">TradeOS</div>
                <div className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Contractor command center</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-1.5 2xl:flex" aria-label="Primary">
              {primaryLinks.map((link) => (
                <NavPill
                  key={link.href}
                  link={link}
                  pathname={pathname}
                  badgeCount={link.href === "/dispatch" ? dispatchBadgeCount : 0}
                />
              ))}
              <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
              {SECONDARY_NAV_LINKS.map((link) => (
                <NavPill key={link.href} link={link} pathname={pathname} />
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden 2xl:block">
              <CommandPaletteTrigger />
            </div>

            <div className="hidden min-w-0 rounded-lg border border-border/70 bg-card/80 px-3 py-2 2xl:block">
              <div className="max-w-[14rem] truncate text-sm font-medium text-foreground">{email ?? "Signed in"}</div>
              <div className="text-xs text-muted-foreground">Secure workspace</div>
            </div>

            <form action={logoutAction} className="hidden 2xl:block">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </div>
    </header>

    {mobileOpen ? (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
        className="fixed inset-0 z-50 2xl:hidden"
      >
        <button
          type="button"
          aria-label="Close more menu"
          className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px] animate-in fade-in-0 duration-(--dur-2)"
          onClick={() => setMobileOpen(false)}
        />
        <div
          ref={sheetRef}
          tabIndex={-1}
          className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-border/70 bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] shadow-(--elev-4) outline-none animate-in slide-in-from-bottom duration-(--dur-3) ease-(--ease-emphasized)"
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
          <div className="grid gap-4">
            <CommandPaletteTrigger onBeforeOpen={() => setMobileOpen(false)} />

            <div className="grid gap-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
              <nav className="grid gap-2" aria-label="More: workspace">
                {primaryLinks.map((link) => (
                  <NavPill
                    key={link.href}
                    link={link}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                    badgeCount={link.href === "/dispatch" ? dispatchBadgeCount : 0}
                  />
                ))}
              </nav>
            </div>

            <div className="grid gap-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tools & admin</div>
              <nav className="grid gap-2" aria-label="More: tools and administration">
                {SECONDARY_NAV_LINKS.map((link) => (
                  <NavPill key={link.href} link={link} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                ))}
              </nav>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/80 px-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{email ?? "Signed in"}</div>
                <div className="text-xs text-muted-foreground">Secure workspace</div>
              </div>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    ) : null}

    <nav
      aria-label="404TradeOS Control Dock"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] 2xl:hidden"
    >
      <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-(--elev-3) backdrop-blur-xl supports-[backdrop-filter]:bg-card/85">
        {DOCK_LEFT_LINKS.map((link) => (
          <DockLink
            key={link.href}
            link={link}
            pathname={pathname}
            badgeCount={link.href === "/dispatch" ? dispatchBadgeCount : 0}
          />
        ))}

        <Link
          href={CREATE_LINK.href}
          aria-label={CREATE_LINK.label}
          className="mx-1 flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-(--elev-1) outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
        >
          <Plus className="size-5" aria-hidden="true" />
        </Link>

        <DockLink link={DOCK_RIGHT_LINK} pathname={pathname} />

        <button
          ref={dockMoreButtonRef}
          type="button"
          aria-label={mobileOpen ? "Close more menu" : "Open more menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
          className={cn(
            "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
            mobileOpen ? "bg-primary/10 text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <MoreHorizontal className={cn("size-5", mobileOpen ? "text-accent-foreground" : "text-muted-foreground")} aria-hidden="true" />
          <span>More</span>
        </button>
      </div>
    </nav>
    </>
  );
}

function DockLink({ link, pathname, badgeCount = 0 }: { link: NavLink; pathname: string; badgeCount?: number }) {
  const active = isActive(pathname, link.href);
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      aria-label={badgeCount > 0 ? `${link.shortLabel} — ${badgeCount} need attention` : undefined}
      className={cn(
        "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95",
        // text-accent-foreground, not text-primary/text-copper: copper itself
        // is only 3.74:1 as text on this surface (fails WCAG AA's 4.5:1) -
        // accent-foreground is a darker copper shade chosen to pass as text
        // while staying in the same brand-copper family. bg-primary/10 stays
        // as-is since a 10%-opacity fill isn't a text-contrast concern.
        active ? "bg-primary/10 text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="relative flex">
        <Icon className={cn("size-5", active ? "text-accent-foreground" : "text-muted-foreground")} aria-hidden="true" />
        <NavBadge count={badgeCount} />
      </span>
      <span>{link.shortLabel}</span>
    </Link>
  );
}
