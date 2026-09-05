import assert from "node:assert/strict";

export const COSTBOOK_ROUTES = [
  ["", "Costbook"], ["materials", "Materials"], ["labor-rates", "Labor Rates"],
  ["equipment", "Equipment"], ["divisions", "Divisions"], ["cost-items", "Cost Items"],
  ["assemblies", "Assemblies"], ["pricing", "Pricing Preview"], ["price-history", "Price History"],
].map(([slug, title]) => ({ slug: slug || "costbook", path: `/costbook${slug ? `/${slug}` : ""}`, title }));

const FOCUS_STYLE_KEYS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "textDecorationLine",
  "textDecorationColor",
  "textDecorationThickness",
];

export function hasVisibleFocusIndicator(before, after) {
  if ((after.outlineStyle !== "none" && Number.parseFloat(after.outlineWidth) > 0) || after.boxShadow !== "none") return true;
  return FOCUS_STYLE_KEYS.some(key => before[key] !== after[key]);
}

export function assertCostbookPage({ pathname, expectedPath, status, bodyText, scrollWidth, clientWidth }) {
  assert.equal(pathname, expectedPath, "Navigation must remain on the requested authenticated route");
  assert.equal(status, 200, "Costbook route must return HTTP 200");
  assert.ok(bodyText.trim().length > 0, "Costbook must render content");
  assert.doesNotMatch(bodyText, /couldn.t load|sign in required|manage access required|internal server error|application error|this page could not be found/i, "Error or access-denied content is not readiness evidence");
  assert.ok(Number.isFinite(clientWidth) && clientWidth > 0 && Number.isFinite(scrollWidth), "Rendered dimensions are required");
  assert.ok(scrollWidth <= clientWidth + 2, `Horizontal overflow: ${scrollWidth} > ${clientWidth}`);
}