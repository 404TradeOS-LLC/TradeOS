"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  ChevronRight,
  LayoutGrid,
  Menu,
  PanelsTopLeft,
  Settings,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { CommandPaletteTrigger } from "@/components/shared/global-command-palette";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  shortLabel: string;
}

const PRIMARY_NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutGrid },
  { href: "/dispatch", label: "Dispatch", shortLabel: "Dispatch", icon: PanelsTopLeft },
  { href: "/projects", label: "Projects", shortLabel: "Projects", icon: Wrench },
  { href: "/customers", label: "Customers", shortLabel: "Customers", icon: Users },
  { href: "/costbook", label: "Costbook", shortLabel: "Costbook", icon: BookOpen },
];

const SECONDARY_NAV_LINKS: NavLink[] = [
  { href: "/brand-studio", label: "Brand Studio", shortLabel: "Brand", icon: Building2 },
  { href: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings },
];

const ATHENA_NAV_LINK: NavLink = {
  href: "/athena",
  label: "Athena",
  shortLabel: "Athena",
  icon: Sparkles,
};

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

function NavPill({ link, pathname, onNavigate }: { link: NavLink; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, link.href);
  const Icon = link.icon;

  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "border-primary/20 bg-primary/10 text-foreground shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--primary)_25%,transparent)]"
          : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-background hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
      <span>{link.label}</span>
    </Link>
  );
}

export function AppNav({ email, canViewAthena = false }: { email?: string | null; canViewAthena?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const primaryLinks = useMemo(
    () => (canViewAthena ? [...PRIMARY_NAV_LINKS, ATHENA_NAV_LINK] : PRIMARY_NAV_LINKS),
    [canViewAthena]
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-[96rem] flex-col px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <ChevronRight className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-heading text-[1rem] font-semibold leading-none text-foreground">TradeOS</div>
                <div className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Contractor command center</div>
              </div>
            </Link>

            <nav className="hidden items-center gap-1.5 xl:flex" aria-label="Primary">
              {primaryLinks.map((link) => (
                <NavPill key={link.href} link={link} pathname={pathname} />
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <CommandPaletteTrigger />
            </div>

            <div className="hidden min-w-0 rounded-lg border border-border/70 bg-card/80 px-3 py-2 lg:block">
              <div className="max-w-[14rem] truncate text-sm font-medium text-foreground">{email ?? "Signed in"}</div>
              <div className="text-xs text-muted-foreground">Secure workspace</div>
            </div>

            <form action={logoutAction} className="hidden sm:block">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 xl:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
            </Button>
          </div>
        </div>

        <div className="hidden items-center justify-between gap-4 border-t border-border/60 py-3 xl:flex">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Tools & admin</span>
            <nav className="flex flex-wrap items-center gap-1.5" aria-label="Tools and administration">
              {SECONDARY_NAV_LINKS.map((link) => (
                <NavPill key={link.href} link={link} pathname={pathname} />
              ))}
            </nav>
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">RC1 hardening workspace</div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-border/60 py-4 xl:hidden">
            <div className="grid gap-4">
              <div className="lg:hidden">
                <CommandPaletteTrigger />
              </div>

              <div className="grid gap-2">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
                <nav className="grid gap-2" aria-label="Mobile primary">
                  {primaryLinks.map((link) => (
                    <NavPill key={link.href} link={link} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                  ))}
                </nav>
              </div>

              <div className="grid gap-2">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tools & admin</div>
                <nav className="grid gap-2" aria-label="Mobile tools and administration">
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
        ) : null}
      </div>
    </header>
  );
}
