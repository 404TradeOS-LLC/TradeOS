# 404 TradeOS — Design System

The brand and UI system for **404 TradeOS**, a web-design & digital-marketing agency for trade businesses (plumbers, electricians, roofers, HVAC, general contractors) based in Terre Haute, IN. Owner: Billy Showalter. Tagline: **"Stop being a 404. Start getting found."** — the "404" (business not found) is part of the name and always appears in the logo lockup.

This system captures the **industrial / diagnostic-software** visual language of the marketing site: forge-black surfaces, a single copper accent, Space Grotesk headlines, and Courier-mono technical labels — the look of a CNC dashboard or terminal, not generic SaaS.

## Sources this was built from

All read-only; stored here so a future reader can re-derive decisions.

- **`tradeos/`** — the marketing site codebase (Next.js 16, Tailwind v4). Source of the brand: `BRAND.md`, `DESIGN-SYSTEM.md`, `PROJECT.md`, `app/globals.css`, `components/ui/*`, `components/sections/*`, `app/(site)/page.tsx`. Domain: 404tradeos.com.
- **`TradeOScostbook/`** — the **TradeOS CostBook** internal app (Next.js, shadcn/ui + base-ui). A separate estimating/invoicing CRUD tool. **It uses default shadcn neutral-grayscale styling and does NOT carry the copper/forge brand** — treated here as a secondary, intentionally-unbranded product surface.
- **`uploads/tradeos-style-guide.html`** — the printable brand style guide v1.0 (June 2026).
- **`uploads/tradeos-*.svg`** — 11 official logo/icon/wordmark SVGs (copied into `assets/logos/`).

## Products represented

1. **404 TradeOS marketing site** (flagship brand) — dark, industrial, copper-accented. This is what the design system encodes.
2. **TradeOS CostBook** (internal tool) — light, neutral shadcn CRUD app. Documented and recreated for completeness, but deliberately off-brand.

---

## CONTENT FUNDAMENTALS

**Voice:** direct, honest, trade-aware. We speak to skilled tradespeople as a knowledgeable peer — never a salesperson, tech bro, or corporate agency. Every word respects that the reader has no time for fluff.

- **Person:** "we" (the agency) speaking to "you" (the tradesperson). First-person plural, second-person address.
- **Casing:** sentence case for body and most headings; hero H1 is sometimes set UPPERCASE for impact ("STOP BEING A 404"). Mono labels are ALL CAPS with wide tracking. Never Title Case Every Word.
- **Punctuation:** no exclamation marks (they read as hype). Periods, em-dashes, and plain statements. Numbers are concrete ("live in 2 weeks", "#1 for plumber", "$197/mo").
- **Emoji:** never. Not part of the brand.
- **Jargon:** trade-literate, not tech-literate — say "get found on Google Maps", not "leverage SEO strategies". Avoid "synergy", "solutions", "ecosystem", "transformation", "cutting-edge".
- **Vibe:** Midwest-grounded, confident, plain-spoken. Concrete over abstract; specific towns and trades over generic claims.

**Examples**
- ✅ "A website that gets you found on Google when a homeowner needs a plumber in Terre Haute."
- ✅ "We track your rankings monthly and tell you exactly what moved and why."
- ✅ "Most sites go live in 2 weeks. Free 30-minute call — no pressure, no obligation."
- ❌ "Unlock the power of digital transformation for your trade business ecosystem!"
- ❌ "We leverage cutting-edge SEO strategies to maximize your online visibility!"

---

## VISUAL FOUNDATIONS

**Overall aesthetic:** industrial control-panel / diagnostic software. Think CNC dashboards, terminal chrome, instrument reticles — **not** generic SaaS. No soft blurred gradients as the main event, no floating sparkles, no round-corner-everything.

**Color** — copper (`#B87333`) is the *sole* accent, set against forge-black (`#0D0A07`) and forge-dark (`#1E1610`). Copper-light (`#E8C99A`) for highlights, copper-dark (`#8A5620`) for hover. Green (`#00C896`) is reserved *exclusively* for online/success states; red (`#E24B4A`) for errors. Never introduce a new color; never use more than the one accent. Dark-first — bone/warm-gray/rust text on forge surfaces.

**Type** — three families, strict roles: **Space Grotesk** (weights 400–500 only) for headlines & the wordmark; **system sans** for body (16px / 1.75 line-height, min 14px); **Courier New** mono for badges, eyebrows, code, and terminal chrome (ALL CAPS, tracking ≥ 1.5px). Never 600/700 for headings; never mono for body. Display tracking is tight (-0.033em).

**Backgrounds** — flat forge-black is the default. Layered industrial textures used at very low opacity: a **copper grid overlay** (48px cells, ~7% alpha, radial-masked), **scanlines** (repeating 3px lines, ~3.5% alpha), and a **mouse-tracking CNC crosshair + scan-ring + coordinate readout** on the hero. Ambient copper "ember" mesh blobs exist but are toned *down* — supporting, not lead. Real trade photography (~30% of imagery) with an auto-applied dark+copper gradient overlay; direction is authentic jobsites/tools/trucks — no suits, no stock handshakes.

**Corner radii** — sharp and small. Terminal frames & OS-module cards use **2px** (CNC-sharp); inputs 3px, buttons 6px, cards 10px, panels 14px, badges/pills fully round. Sharpness signals "instrument", roundness is reserved for status pills only.

**Cards** — forge-dark fill, **1px** forge-border, small radius. Borders carry the edge; drop shadows are used sparingly (mainly the floating hero panel). On hover, module cards shift their border to translucent copper and fade in **CNC corner brackets**.

**Borders & dividers** — 1px forge-border (`#3d2a10`) everywhere. Hover/active raises the border toward copper. `.rule` hairlines separate sections.

**Shadows** — minimal. `--shadow-panel` (0 12px 40px / 45% black) for the one floating hero control-center; status LEDs get a `0 0 6px currentColor` glow. No soft ambient card shadows.

**Animation** — restrained and mechanical. LED pulse (2s ease), terminal cursor blink (steps(1) — hard, not eased), CSS `fade-up` entrances for hero/LCP content (never JS-gated opacity). Below-fold reveals use scoped framer-motion, trigger once on scroll. Decorative loops: drifting mesh, node-pulse, scan-ring pulse. **Everything respects `prefers-reduced-motion`.** No bounces; easing is `ease-out`.

**Hover states** — buttons lighten (copper → copper-light); ghost/outline raise border toward copper and shift text to copper-light; cards raise border + reveal corner brackets; there's a subtle CRT red/cyan edge-distortion (`.crt-hover`) on terminal frames and module cards.

**Press states** — buttons `scale(0.96)` + `brightness(1.15)` — a physical "switch" click, extending the LED pulse language.

**Cursor** — desktop fine-pointer gets a custom CNC reticle (dot + ring with corner ticks); the ring expands over interactive elements and shrinks on press. Hidden on touch and under reduced-motion.

**Transparency & blur** — used purposefully: the sticky nav is forge-black at 95% + backdrop-blur; the floating hero panel is forge-dark at 95% + backdrop-blur. Otherwise surfaces are opaque. Blur is UI chrome, never decoration.

**Layout** — mobile-first grids, 44px min touch targets. Sticky nav. `.section-pad` (80px vertical, responsive horizontal). Max content width ~1280px (`max-w-7xl`). Section eyebrow (`.sec-label`) precedes every H2.

---

## ICONOGRAPHY

- **Icon set:** **Lucide React** (`lucide-react`) throughout the marketing site — thin, consistent stroke weight that suits the technical aesthetic. In these design-system artifacts, load Lucide from CDN (e.g. `lucide@latest`) or use the inline SVGs; match Lucide's ~1.75px stroke if substituting. **This is the sanctioned set — do not mix icon families.**
- **CostBook** uses Lucide as well (via shadcn defaults).
- **Icon treatment:** service/feature icons sit in a **36px copper-gradient tile** (copper → copper-dark, 2px radius) with forge-black glyphs — see `OSModuleCard`. Standalone icons are copper or bone.
- **Brand marks:** the 404·TRADE·OS badge and wordmark are the identity; official SVGs live in `assets/logos/` (primary light/dark, stacked light/dark, wordmark light/dark, dark & copper icon marks, favicon, business-card, email-signature). **Never redraw these from scratch** — reference the SVGs.
- **Emoji:** never used. **Unicode chars** as icons: only tiny functional glyphs like `↑` `↓` `→` in metrics/deltas and mono contexts — not as decorative iconography.
- **Decorative "icons":** the CNC corner brackets, crosshair, and squared terminal lights are drawn with CSS/SVG primitives (see `CornerBrackets`), not from an icon font.

---

## Components

Reusable React primitives (namespace `Ds404TradeOSDesignSystem_f45b1c`). Grouped by concern under `components/`:

**Brand** (`components/brand/`)
- **Badge404** — the `404 · TRADE · OS` monospace logo badge.
- **Wordmark** — the TradeOS logotype (Space Grotesk, copper "OS"), `sm|md|lg|xl`, `dark|light` tone.

**Core** (`components/core/`)
- **Button** — `primary` / `outline` / `ghost` variants; copper is the only fill.
- **Card** — forge-dark bordered surface; `card` / `panel`.
- **SecLabel** — copper mono section eyebrow.
- **StatusLED** — pulsing diagnostic status dot + label (`online|processing|error|idle`).
- **StatusPill** — rounded mono status/tag pill (`online|copper|neutral`).
- **BlinkingCursor** — copper terminal cursor.

**Chrome** (`components/chrome/`)
- **TerminalFrame** — window-chrome shell (squared lights + mono title + StatusLED).
- **OSModuleCard** — a service rendered as an installed "OS module" (icon tile, MOD-0X id, RUNNING footer, hover brackets).
- **CornerBrackets** — decorative CNC-reticle corners for any relative container.

### Intentional additions
- **StatusPill** and **BlinkingCursor** are promoted to first-class components here; in the source they existed as the `.status-online` class and the `BlinkingCursor` atom respectively. **Button/Card/SecLabel** wrap the production `.btn-*`/`.card`/`.sec-label` CSS classes as React components for ergonomic reuse — the underlying classes are still shipped in `tokens/base.css`.

---

## UI kits

- **`ui_kits/marketing/`** — the 404 TradeOS marketing site: interactive home (hero + control-center panel, services grid, process, reviews, CTA), plus services & pricing screens. Composes the components above.
- **`ui_kits/costbook/`** — the TradeOS CostBook internal app: dashboard, projects list, project detail. **Neutral shadcn styling — intentionally off the copper brand** (this is how the real product looks).

## Foundation cards

Specimen cards populate the Design System tab, grouped **Colors · Type · Spacing · Brand · Components · Marketing · CostBook** (see `guidelines/` and each kit's `index.html`).

---

## Root file index

- `styles.css` — global entry (import this one file). `@import`s only.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `fonts.css`, `base.css` (reset + reusable brand classes).
- `assets/logos/` — 11 official brand SVGs. `assets/fonts/` — Space Grotesk variable TTF + OFL license. `assets/images/` — real trade photography (hero / services / case-studies).
- `components/{brand,core,chrome}/` — reusable primitives (`.jsx` + `.d.ts` + `.prompt.md` + one `@dsCard` HTML per group).
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand).
- `ui_kits/{marketing,costbook}/` — full-screen product recreations.
- `SKILL.md` — Agent-Skills-compatible entry point.

## Font substitution note

**None required.** Space Grotesk (the display face) ships here as the real variable TTF copied from the source repo. Body is the system sans stack and mono is Courier New — both system fonts, no files needed.
