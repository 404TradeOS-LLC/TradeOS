---
name: tradeos-design
description: Use this skill to generate well-branded interfaces and assets for 404 TradeOS, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `readme.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

- **Brand:** 404 TradeOS — web design & marketing agency for the trades. Aesthetic = industrial / diagnostic software: forge-black surfaces, a single **copper** accent (#B87333), Space Grotesk headlines, Courier-mono technical labels. "404" is part of the name — always in the logo lockup.
- **`styles.css`** — link this one file to get all tokens, fonts, and the reusable brand classes (`.badge-404`, `.btn-primary/outline/ghost`, `.card`, `.sec-label`, `.mono-label`, `.status-online`, `.grid-overlay`).
- **`tokens/`** — color/type/spacing/font CSS custom properties.
- **`components/{brand,core,chrome}/`** — React primitives (Badge404, Wordmark, Button, Card, SecLabel, StatusLED, StatusPill, BlinkingCursor, TerminalFrame, OSModuleCard, CornerBrackets). Each has a `.prompt.md` with usage.
- **`assets/logos/`** — official brand SVGs (never redraw). `assets/fonts/` — Space Grotesk. `assets/images/` — real trade photography.
- **`ui_kits/marketing/`** — the copper-brand marketing site (full interactive recreation).
- **`ui_kits/costbook/`** — the TradeOS CostBook internal app: **neutral shadcn, intentionally off-brand.** Match this neutral look for internal-tool work, the copper brand for marketing/public work.

## Hard rules
- Copper is the ONLY accent. Green (#00C896) is reserved for online/success. Never add a color.
- Headings: Space Grotesk, weights 400–500 only (never 600/700). Body: system sans. Mono labels: Courier New, ALL CAPS, tracking ≥ 1.5px.
- No emoji. No hype/exclamation marks in copy. Trade-literate, direct, Midwest-grounded.
- Icons: Lucide (consistent stroke). Don't mix icon families.
