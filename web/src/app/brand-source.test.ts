import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLocalBrandPreview,
  defaultBrandDocumentSettings,
  defaultBrandProfile,
} from "../lib/brand-studio.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const masterDir = path.join(repoRoot, "docs", "brand", "tradeos-master-logo-package");
const brandDir = path.join(repoRoot, "web", "public", "brand");

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function pngDimensions(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${file} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function extractPathData(svg: string): string[] {
  return [...svg.matchAll(/d="([^"]+)"/g)].map((match) => match[1]);
}

test("master logo package is committed as the canonical brand source", () => {
  const manifestPath = path.join(masterDir, "manifest.json");
  assert.ok(existsSync(manifestPath), "master package manifest is missing");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    brand: string;
    palette: Record<string, string>;
    files: string[];
  };
  assert.equal(manifest.brand, "TradeOS");
  assert.equal(manifest.palette.copper, "#C98460");
  assert.equal(manifest.palette.charcoal, "#222426");
  assert.equal(manifest.palette.ivory, "#F7F5F1");
  for (const file of manifest.files) {
    assert.ok(existsSync(path.join(masterDir, file)), `master package file missing: ${file}`);
  }
  assert.ok(existsSync(path.join(masterDir, "README.md")), "master package README is missing");
});

test("served brand files are byte-identical copies of the master package web files", () => {
  const masterWeb = path.join(masterDir, "web");
  const served = readdirSync(brandDir).sort();
  const masterFiles = readdirSync(masterWeb).sort();
  assert.deepEqual(served, masterFiles, "web/public/brand must mirror the master package web/ files");
  for (const file of masterFiles) {
    assert.equal(
      sha256(path.join(brandDir, file)),
      sha256(path.join(masterWeb, file)),
      `served copy drifted from the master package: ${file}`
    );
  }
});

test("login entry art comes from the master package vector files", () => {
  assert.equal(
    sha256(path.join(repoRoot, "web", "public", "entry", "mark.svg")),
    sha256(path.join(masterDir, "vector", "tradeos-mark-light.svg")),
    "entry mark must be the master package mark"
  );
  assert.equal(
    sha256(path.join(repoRoot, "web", "public", "entry", "wordmark.svg")),
    sha256(path.join(masterDir, "vector", "tradeos-wordmark-dark.svg")),
    "entry wordmark must be the master package dark-surface wordmark (dark entry background)"
  );
});

test("code-drawn mark and wordmark geometry matches the master package", () => {
  const logoPaths = readFileSync(
    path.join(repoRoot, "web", "src", "components", "entry", "logo-paths.ts"),
    "utf8"
  );
  const markSvg = readFileSync(path.join(masterDir, "vector", "tradeos-mark-light.svg"), "utf8");
  for (const d of extractPathData(markSvg)) {
    assert.ok(logoPaths.includes(d), "MARK_PATHS is missing a master-package mark path");
  }
  const wordmarkSvg = readFileSync(
    path.join(masterDir, "vector", "tradeos-wordmark-light.svg"),
    "utf8"
  );
  for (const d of extractPathData(wordmarkSvg)) {
    assert.ok(logoPaths.includes(d), "LOGO_PATHS is missing a master-package wordmark path");
  }
});

test("no stale or competing logo files and no generated icon routes remain", () => {
  const staleEntry = readdirSync(path.join(repoRoot, "web", "public")).filter((file) =>
    file.startsWith("tradeos-entry-")
  );
  assert.deepEqual(staleEntry, [], "unreferenced tradeos-entry-*.svg files must be removed");
  for (const route of [
    "web/src/app/icon.tsx",
    "web/src/app/apple-icon.tsx",
    "web/src/app/opengraph-image.tsx",
    "web/src/app/pwa/icon-192/route.ts",
    "web/src/app/pwa/icon-512/route.ts",
  ]) {
    assert.ok(!existsSync(path.join(repoRoot, route)), `generated route must be replaced by package files: ${route}`);
  }
  assert.ok(
    existsSync(path.join(repoRoot, "web", "src", "app", "pwa", "icon-maskable", "route.ts")),
    "maskable icon route stays (the package ships no maskable variant)"
  );
  assert.equal(
    sha256(path.join(repoRoot, "web", "src", "app", "favicon.ico")),
    sha256(path.join(masterDir, "web", "favicon.ico")),
    "app favicon.ico must be the master package favicon"
  );
});

test("root metadata points at the package files", () => {
  const layout = readFileSync(path.join(repoRoot, "web", "src", "app", "layout.tsx"), "utf8");
  for (const url of [
    "/brand/favicon.svg",
    "/brand/favicon-32.png",
    "/brand/favicon-16.png",
    "/brand/apple-touch-icon-180.png",
    "/brand/social-share.png",
  ]) {
    assert.ok(layout.includes(url), `layout metadata must reference ${url}`);
  }
  assert.match(layout, /width:\s*1200,\s*height:\s*630/);
  assert.deepEqual(pngDimensions(path.join(brandDir, "social-share.png")), { width: 1200, height: 630 });
  assert.deepEqual(pngDimensions(path.join(brandDir, "pwa-192.png")), { width: 192, height: 192 });
  assert.deepEqual(pngDimensions(path.join(brandDir, "pwa-512.png")), { width: 512, height: 512 });
  assert.deepEqual(pngDimensions(path.join(brandDir, "apple-touch-icon-180.png")), {
    width: 180,
    height: 180,
  });
});

test("web manifest points at the package icons on the package charcoal field", () => {
  const manifest = readFileSync(path.join(repoRoot, "web", "src", "app", "manifest.ts"), "utf8");
  for (const url of [
    "/brand/pwa-192.png",
    "/brand/pwa-512.png",
    "/brand/apple-touch-icon-180.png",
    "/pwa/icon-maskable",
  ]) {
    assert.ok(manifest.includes(url), `manifest must reference ${url}`);
  }
  assert.ok(manifest.includes("#222426"), "manifest colors must be the package charcoal");
  assert.ok(!manifest.includes("#202225"), "manifest must not use the pre-package icon field color");
  const iconArt = readFileSync(path.join(repoRoot, "web", "src", "app", "pwa", "icon-art.tsx"), "utf8");
  assert.ok(iconArt.includes("#222426"), "maskable icon field must be the package charcoal");
  assert.ok(!iconArt.includes("#202225"), "maskable icon must not use the pre-package icon field color");
});

test("app shell brand tile uses the package charcoal field", () => {
  const appNav = readFileSync(
    path.join(repoRoot, "web", "src", "components", "shared", "app-nav.tsx"),
    "utf8"
  );
  assert.ok(appNav.includes("bg-[#222426]"), "app nav mark tile must use the package charcoal");
  assert.ok(!appNav.includes("bg-[#202225]"), "app nav must not use the pre-package icon field color");
});

test("Brand Studio defaults resolve to the package files for a fresh organization", () => {
  const preview = buildLocalBrandPreview(
    { ...defaultBrandProfile, organizationId: "org-1" },
    { ...defaultBrandDocumentSettings, organizationId: "org-1" },
    []
  );
  assert.equal(preview.resolvedLogoUrls.logoUrl, "/brand/horizontal-light-1600.png");
  assert.equal(preview.resolvedLogoUrls.logoDarkUrl, "/brand/horizontal-dark-1600.png");
  assert.equal(preview.resolvedLogoUrls.logoLightUrl, "/brand/horizontal-light-1600.png");
  assert.equal(preview.resolvedLogoUrls.iconUrl, "/brand/favicon.svg");
  assert.equal(preview.resolvedLogoUrls.watermarkUrl, "/brand/mark-copper-1024.png");
  assert.equal(preview.resolvedLogoUrls.coverImageUrl, "/brand/social-cover.png");
  assert.deepEqual(preview.validatedColors, {
    primary: "#222426",
    secondary: "#F7F5F1",
    accent: "#C98460",
  });
  // The platform default is not the organization's own brand: the setup
  // checklist still prompts for their logo.
  assert.ok(preview.missingSetupItems.includes("Add a primary logo"));
  const favicon = preview.derivedLogoVariants.find((item) => item.kind === "favicon");
  assert.equal(favicon?.url, "/brand/favicon.svg");
  assert.equal(favicon?.source, "default");
});

test("Brand Studio derives the favicon from an organization's own logo before the package default", () => {
  const preview = buildLocalBrandPreview(
    {
      ...defaultBrandProfile,
      organizationId: "org-1",
      logoUrl: "https://cdn.example.com/acme-logo.png",
    },
    { ...defaultBrandDocumentSettings, organizationId: "org-1" },
    []
  );
  // No explicit icon: the favicon derives from the org's own logo, not the
  // TradeOS mark.
  const favicon = preview.derivedLogoVariants.find((item) => item.kind === "favicon");
  assert.equal(favicon?.url, "https://cdn.example.com/acme-logo-favicon.png");
  assert.equal(favicon?.source, "derived");
  assert.equal(preview.resolvedLogoUrls.iconUrl, "https://cdn.example.com/acme-logo-icon.png");
  // Only a primary logo is owned (no dark/light variant): mono and
  // print-safe still derive from that owned logo, not from the platform
  // default dark/light URLs.
  const monochrome = preview.derivedLogoVariants.find((item) => item.kind === "monochrome");
  assert.equal(monochrome?.url, "https://cdn.example.com/acme-logo-mono.png");
  assert.equal(monochrome?.source, "derived");
  assert.equal(monochrome?.derivedFrom, "https://cdn.example.com/acme-logo.png");
  const printSafe = preview.derivedLogoVariants.find((item) => item.kind === "print-safe");
  assert.equal(printSafe?.url, "https://cdn.example.com/acme-logo-print.png");
  assert.equal(printSafe?.source, "derived");
  assert.equal(printSafe?.derivedFrom, "https://cdn.example.com/acme-logo.png");
});

test("Brand Studio keeps an explicit organization logo ahead of the package default", () => {
  const preview = buildLocalBrandPreview(
    {
      ...defaultBrandProfile,
      organizationId: "org-1",
      logoUrl: "https://cdn.example.com/acme-logo.png",
      iconUrl: "https://cdn.example.com/acme-icon.png",
      primaryColor: "#123456",
    },
    { ...defaultBrandDocumentSettings, organizationId: "org-1" },
    []
  );
  assert.equal(preview.resolvedLogoUrls.logoUrl, "https://cdn.example.com/acme-logo.png");
  assert.equal(preview.resolvedLogoUrls.iconUrl, "https://cdn.example.com/acme-icon.png");
  assert.equal(preview.validatedColors.primary, "#123456");
  assert.ok(!preview.missingSetupItems.includes("Add a primary logo"));
});
