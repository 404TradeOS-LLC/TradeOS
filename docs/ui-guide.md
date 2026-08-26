# UI Guide

Design system and UI conventions for the `web/` Next.js front end. This doc covers what
exists today; update it whenever a new reusable component or pattern is added.

## Foundations

- **Styling**: Tailwind CSS v4 (`web/src/app/globals.css`) + `shadcn/ui` (Base UI under the
  hood, not Radix — e.g. `Button` has no `asChild`; use `buttonVariants()` on a `<Link>`
  instead of composing).
- **Design tokens**: all colors are CSS variables driven by `oklch()`, themed via `.dark` on
  `<html>`. Never hardcode a color — use the token classes (`bg-card`, `text-muted-foreground`,
  `border-border`, `bg-destructive/10 text-destructive`, etc.) so light/dark both work.
- **Current shell theme**: the RC1 app shell uses a cool neutral surface palette with an
  electric-blue primary accent for action, active navigation state, and focus treatment. Amber
  stays reserved for meaningful attention/queue states instead of general decoration.
- **Radius scale**: `--radius` (0.625rem) drives `--radius-sm` through `--radius-4xl` in
  `@theme inline`. Cards use `rounded-xl`; small chips/badges use `rounded-4xl` (pill).
- **`cn()`** (`web/src/lib/utils.ts`, `clsx` + `tailwind-merge`) is the standard way to merge
  conditional class names — use it in every component that accepts a `className` prop.

## Component library

### `components/ui/` — shadcn primitives
`button`, `card` (`Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardAction`/
`CardContent`/`CardFooter`), `badge`, `input`, `label`, `textarea`, `checkbox`, `select` /
`select-field`, and `empty-state`.

- **`EmptyState`** (`components/ui/empty-state.tsx`) is the standard "nothing here yet" block
  — dashed border, title, description, optional `action`. **Use this for every empty list**
  instead of a bare `<p className="text-sm text-muted-foreground">…</p>`. It was already used
  throughout the project-detail sidebar but not on the top-level Customers/Projects pages or
  the customer detail page; that inconsistency is now fixed.

### `components/shared/` — cross-page composition helpers

- **`ListRowLink`** (`list-row-link.tsx`) — the standard row for any "list of links to a
  detail page" (customers, projects, estimates, recent documents, …). Renders a
  `title` + optional `subtitle`, an optional `trailing` slot (status badge, price, …), with
  the shared border/hover/focus treatment. Title and subtitle `truncate` and the row uses
  `min-w-0` so long names never push trailing content off the edge of the card on narrow
  viewports — the previous hand-rolled versions of this row (in four different files) did not
  guard against that. Prefer this over writing a new `<Link className="flex items-center
  justify-between rounded-lg border …">` by hand.
- **`LineItemRow`** (`line-item-row.tsx`) — a priced row (`description` + optional `meta` +
  `amount` + optional trailing `action`). Same truncation guarantee as `ListRowLink`, so a long
  line-item description can't shove the price off-screen. Currently used on the invoice detail
  page; the Estimate Builder's line-item list has its own richer inline row (metric tiles,
  assembly/cost-item picker, sticky pricing rail) that doesn't fit this simpler shape — don't
  force `LineItemRow` in there.
- **`StatusBadge`** (`status-badge.tsx`) — wraps `Badge` with `capitalize` and turns
  `snake_case` statuses into readable text (`in_progress` → `In progress`). Use this instead of
  a raw `Badge` whenever you're rendering a backend status enum.
- **`AppNav`** (`app-nav.tsx`) — the top app nav: active-section highlighting, a responsive
  mobile menu, a split primary/secondary hierarchy on wide screens, and the command-palette
  trigger. This is the only nav component — don't add a second one.
- **`DashboardPanel`** (`components/dashboard/dashboard-panel.tsx`) — the standard shell for
  owner-dashboard sections that need the same card/header/body rhythm. Prefer it over
  hand-assembling a new `CardHeader`/`CardContent` pair for dashboard surfaces.
- `MetricCard` / `SummaryMetricCard` — two intentionally distinct metric-tile styles (compact
  numeric stat vs. a labeled text summary). Don't merge them without checking both call sites;
  they read differently in context (`ProjectMetricsCard` vs. the proposal preview summary).
- `InfoPanel`, `SummaryList`, `Timeline` — smaller layout helpers for label/value groupings and
  status timelines.

### `components/projects/`, `components/proposals/`, `components/intake/`
Feature-specific composition built from the primitives above (e.g. `ProjectHeader`,
`ProjectSidebar`, `ProjectStatusTimeline`, the AI intake panels). These stay page-specific
because they encode business copy/logic, not because the visual pattern is unique — if you
find yourself duplicating markup across two of these, promote it to `components/shared/`
instead of copy-pasting a third time.

## Patterns

- **Empty states**: always `EmptyState`, never a bare muted `<p>`.
- **List-of-links rows**: always `ListRowLink`.
- **Priced rows**: always `LineItemRow`.
- **Status text**: always `StatusBadge`, not a raw `Badge` with the enum value passed straight
  through.
- **Page headers**: `<div className="flex flex-wrap items-center justify-between gap-3">` for
  a title + primary action, so the action wraps under the title instead of forcing horizontal
  scroll on narrow screens (see `customers/page.tsx`, `projects/page.tsx`).
- **Owner dashboard sections**: keep the scan order consistent: decision queue first, then
  today's schedule / briefing, then KPI scan, then task board and activity, with quieter
  operational summaries below. Avoid burying the actionable work beneath a wall of metrics.
- **Data access**: Server Components/Server Actions for CRUD; the one Client Component with
  real interactivity (search-as-you-type, live totals) is the Estimate Builder, which goes
  through the generic `/api/proxy/[...path]` route handler via TanStack Query. Follow that
  split for any new interactive page rather than making everything a Client Component.

## Responsiveness & accessibility

- Every interactive row/link should be reachable via `focus-visible` (see `ListRowLink`'s
  `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`) — don't rely on
  `:hover` alone.
- Any row that pairs a variable-length text field with a fixed-width trailing element (price,
  badge) needs `min-w-0` + `truncate` on the text side and `shrink-0` on the trailing side, or
  it will overflow the card at narrow widths. `ListRowLink`/`LineItemRow` already do this —
  reuse them rather than re-deriving it.
- Avoid literal `<table>` layouts for tabular data in this app; the existing pattern is a
  `flex`/`grid` "card row" list, which reflows naturally instead of needing a dedicated
  `overflow-x-auto` scroll container. If a genuinely wide grid is unavoidable, wrap it in
  `overflow-x-auto` rather than letting it push the page width.
- Test new pages at common breakpoints (~390px mobile, ~768px tablet, desktop) before calling a
  UI change done — a build/lint pass does not catch layout overflow.

## Known UI debt (not addressed in this pass)

- `MetricCard` and `SummaryMetricCard` are near-duplicates; worth a deliberate design decision
  (not just deduplication) about whether the app needs two metric-tile styles.
- The Estimate Builder's `PricingPanel` uses raw `<input type="radio">` instead of a shared
  radio/segmented-control component — there's no `RadioGroup` in `components/ui/` yet.
- No loading-skeleton components — client-fetched pages (e.g. the Estimate Builder) currently
  fall back to a plain "Loading…" text line rather than a skeleton matching the eventual
  layout.
