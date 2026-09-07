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

function hasVisibleCssPaint(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "none" || normalized === "transparent") return false;
  const colors = [...normalized.matchAll(/([a-z-]+)\(([^)]*)\)/g)];
  if (colors.length === 0) return !normalized.includes("transparent");
  return colors.some(match => {
    const functionName = match[1];
    const body = match[2];
    const commaParts = body.split(",").map(part => part.trim()).filter(Boolean);
    const slashParts = body.split("/").map(part => part.trim()).filter(Boolean);
    const alpha = slashParts.length > 1
      ? slashParts.at(-1)
      : /^(?:rgba|hsla)$/.test(functionName) && commaParts.length >= 4
        ? commaParts[3]
        : null;
    if (alpha === null) return true;
    const numeric = alpha.endsWith("%") ? Number.parseFloat(alpha) / 100 : Number.parseFloat(alpha);
    return !Number.isFinite(numeric) || numeric > 0;
  });
}

export function hasVisibleFocusIndicator(before, after) {
  const outlineChanged =
    before.outlineStyle !== after.outlineStyle ||
    before.outlineWidth !== after.outlineWidth ||
    before.outlineColor !== after.outlineColor;
  const shadowChanged = before.boxShadow !== after.boxShadow;
  const outlineVisible =
    outlineChanged &&
    after.outlineStyle !== "none" &&
    Number.parseFloat(after.outlineWidth) > 0 &&
    hasVisibleCssPaint(after.outlineColor);
  const shadowVisible = shadowChanged && hasVisibleCssPaint(after.boxShadow);
  if (outlineVisible || shadowVisible) return true;
  return FOCUS_STYLE_KEYS.some(key => before[key] !== after[key]);
}

function hasPreviewTarget(target) {
  return Array.isArray(target) ? target.includes("preview") : target === "preview";
}

export function deploymentSupabaseProjectRef(envs, branch, deploymentCreatedAt) {
  const applicable = envs.filter(env => env?.key === "NEXT_PUBLIC_SUPABASE_URL" && hasPreviewTarget(env.target));
  const branchScoped = applicable.filter(env => env.gitBranch === branch);
  const sharedPreview = applicable.filter(env => !env.gitBranch);
  const candidates = branchScoped.length > 0 ? branchScoped : sharedPreview;
  const candidate = [...candidates]
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
