import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Guards globals.css / Figma drift: the light-theme (:root) surface tokens
// must carry the exact Figma variable values from the TradeOS — Product
// Design System library (master file xImUa9CYUjx3Cb3zTrkfnY), sampled
// 2026-11-22 via get_variable_defs. The previous oklch round numbers
// rendered slightly different colors (background #f9f6f4 vs #f7f5f1,
// foreground warm #241e18 vs cool neutral #222426, border #e3ddd7 vs
// #dbd6cd, accent color-mix #f0e4d9 vs #eee7df, accent-foreground #8a5620
// vs #94542f). Hex is deliberate: it is verbatim what Figma reports.
// Dark-mode Figma values were not sampled in that pass, so .dark is not
// pinned here; secondary/sidebar/destructive/ring/chart tokens were not
// sampled either.
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const light = css.slice(0, css.indexOf(".dark {"));

const FIGMA_LIGHT_TOKENS: Record<string, string> = {
  "--background": "#f7f5f1",
  "--foreground": "#222426",
  "--card": "#fffdf9",
  "--card-foreground": "#222426",
  "--popover": "#fffdf9",
  "--popover-foreground": "#222426",
  "--muted": "#f0eeea",
  "--muted-foreground": "#696965",
  "--accent": "#eee7df",
  "--accent-foreground": "#94542f",
  "--border": "#dbd6cd",
  "--input": "#dbd6cd",
  // Already-matching tokens, pinned so a future edit cannot silently drift them.
  "--copper": "#b87333",
  "--copper-foreground": "#0d0a07",
  "--warning": "#a36717",
  "--success": "#0c855c",
  "--info": "#2d6ded",
};

test("light theme tokens match the Figma design-system values exactly", () => {
  for (const [token, value] of Object.entries(FIGMA_LIGHT_TOKENS)) {
    assert.ok(
      light.includes(`${token}: ${value};`),
      `globals.css :root should carry ${token}: ${value} (Figma value)`,
    );
  }
});

test("light accent is the flat Figma value, not the old color-mix approximation", () => {
  assert.ok(!light.includes("color-mix(in oklch, var(--copper) 14%"), "old --accent color-mix approximation is gone");
  assert.ok(!light.includes("--accent-foreground: #8a5620;"), "old --accent-foreground #8a5620 is gone");
});

test("light radius base still matches the Figma radius scale", () => {
  assert.ok(light.includes("--radius: 0.5rem;"), "radius base 0.5rem (8px) missing");
});
