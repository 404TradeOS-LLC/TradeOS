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

function hasPreviewTarget(target) {
  return Array.isArray(target) ? target.includes("preview") : target === "preview";
}

export function deploymentSupabaseProjectRef(envs, branch, deploymentCreatedAt) {
  const applicable = envs.filter(env => env?.key === "NEXT_PUBLIC_SUPABASE_URL" && hasPreviewTarget(env.target));
  const branchScoped = applicable.filter(env => env.gitBranch === branch);
  const sharedPreview = applicable.filter(env => !env.gitBranch);
  const candidate = [...branchScoped, ...sharedPreview]
    .sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0))[0];
  assert.ok(candidate?.value, "Vercel Preview NEXT_PUBLIC_SUPABASE_URL is required for deployment data-plane attestation");
  const configuredAt = Number(candidate.updatedAt ?? candidate.createdAt ?? 0);
  assert.ok(Number.isFinite(configuredAt) && configuredAt > 0, "Vercel Supabase environment timestamp is required");
  assert.ok(configuredAt <= Number(deploymentCreatedAt), "Vercel Supabase environment changed after this deployment; redeploy before mutating evidence");
  let hostname;
  try {
    hostname = new URL(candidate.value).hostname.toLowerCase();
  } catch {
    assert.fail("Vercel Preview NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
  }
  const match = hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  assert.ok(match, "Vercel Preview NEXT_PUBLIC_SUPABASE_URL must identify a Supabase project");
  return match[1];
}

export function assertCostbookPage({ pathname, expectedPath, status, bodyText, scrollWidth, clientWidth }) {
  assert.equal(pathname, expectedPath, "Navigation must remain on the requested authenticated route");
  assert.equal(status, 200, "Costbook route must return HTTP 200");
  assert.ok(bodyText.trim().length > 0, "Costbook must render content");
  assert.doesNotMatch(bodyText, /couldn.t load|sign in required|manage access required|internal server error|application error|this page could not be found/i, "Error or access-denied content is not readiness evidence");
  assert.ok(Number.isFinite(clientWidth) && clientWidth > 0 && Number.isFinite(scrollWidth), "Rendered dimensions are required");
  assert.ok(scrollWidth <= clientWidth + 2, `Horizontal overflow: ${scrollWidth} > ${clientWidth}`);
}