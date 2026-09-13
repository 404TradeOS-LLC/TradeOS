#!/usr/bin/env node
/**
 * Jones & Sons (jonesandsons.com) supplier crawl + Costbook research
 * candidate importer.
 *
 * STATUS: written but NOT executed. The session that authored this script
 * had no outbound network access to jonesandsons.com (confirmed
 * EGRESS_BLOCKED, and confirmed as a general sandbox restriction rather
 * than a site-specific block via an identical failure against an unrelated
 * domain). See data/supplier-imports/jones-and-sons/README.md.
 *
 * This is an administrative/offline data-collection tool, not something
 * production Costbook behavior depends on at request time. Its job is to
 * populate dated JSON snapshots under data/supplier-imports/jones-and-sons/
 * that app/modules/costbook/jonesAndSonsTerreHaute.ts (or a future generated
 * variant of it) can consume - it never writes to a tenant's live Costbook
 * itself. Persisting a candidate still requires an authenticated
 * organization-scoped call through the existing Costbook candidate intake
 * path, followed by normal human review/promotion.
 *
 * Usage (once outbound access is available):
 *   node scripts/costbook-import-jones-and-sons.mjs [--limit N] [--dry-run]
 *
 * Discovery strategy: Shopify storefronts auto-generate /sitemap.xml and
 * per-collection sitemaps; individual products are read from the
 * documented public `<product-handle>.json` endpoint rather than scraping
 * rendered HTML, which is both more reliable and far lighter than a full
 * HTML parse. Branch-specific pricing/availability, where Jones & Sons
 * surfaces it via a client-rendered location picker, is NOT reliably
 * present in that static JSON - this script only marks a record Terre
 * Haute-verified when it finds explicit branch text (see
 * BRANCH_EVIDENCE_PATTERN below) in the product description/tags/body_html.
 * Everything else is recorded at confidence "low" with an unconfirmed
 * regional scope, matching the conservative default used throughout this
 * import (see jonesAndSonsTerreHaute.ts).
 */

import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data", "supplier-imports", "jones-and-sons");
const RAW_DIR = path.join(DATA_DIR, "raw");
const NORMALIZED_DIR = path.join(DATA_DIR, "normalized");
const PROGRESS_PATH = path.join(RAW_DIR, "progress.json");

const BASE_URL = "https://jonesandsons.com";
const REQUEST_DELAY_MS = 1500; // polite, low-concurrency default
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [2000, 5000, 12000];

const TIER_1_KEYWORDS = [
  "crushed limestone", "gravel", "sand", "aggregate", "concrete block",
  "rebar", "wire mesh", "mortar", "masonry",
];
const TIER_2_KEYWORDS = [
  "drainage", "foundation", "expansion joint", "geotextile", "waterproof",
  "moisture", "concrete accessor", "paver base", "retaining wall",
];
const TIER_3_KEYWORDS = [
  "paver", "precast step", "lintel", "sill", "parking curb", "landscap",
];
const EXCLUDE_KEYWORDS = [
  "apparel", "t-shirt", "hat", "mug", "gift card", "merchandise", "sticker",
];

const BRANCH_NAMES = ["Terre Haute", "Vincennes", "Washington", "Bloomfield"];
// Matches explicit branch-pickup language such as "Pickup available at
// Terre Haute" or "Terre Haute pickup". Deliberately conservative: this is
// the ONLY thing allowed to set regionalScope to "branch_verified".
const BRANCH_EVIDENCE_PATTERN = new RegExp(
  `(pickup[^.]{0,40}(${BRANCH_NAMES.join("|")})|(${BRANCH_NAMES.join("|")})[^.]{0,40}pickup)`,
  "i"
);
const READY_MIX_PATTERN = /ready[\s-]?mix(ed)?\s+concrete/i;

function classifyTier(name) {
  const lower = name.toLowerCase();
  if (EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw))) return null;
  if (TIER_1_KEYWORDS.some((kw) => lower.includes(kw))) return 1;
  if (TIER_2_KEYWORDS.some((kw) => lower.includes(kw))) return 2;
  if (TIER_3_KEYWORDS.some((kw) => lower.includes(kw))) return 3;
  return null;
}

function normalizeUnit(rawUnit) {
  if (!rawUnit) return { unit: undefined, assumed: true };
  const table = {
    tn: "ton", tons: "ton", ton: "ton",
    ea: "each", each: "each",
    lb: "lb", lbs: "lb",
    cy: "cubic_yard", "yd3": "cubic_yard", "yd³": "cubic_yard",
    sf: "sq_ft", sqft: "sq_ft",
    lf: "linear_ft", linft: "linear_ft",
    bag: "bag", bags: "bag",
  };
  const key = rawUnit.trim().toLowerCase();
  return { unit: table[key] ?? key, assumed: false };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": "TradeOS-Costbook-SupplierImport/1.0 (+https://github.com/404TradeOS-LLC/TradeOS)" },
    });
    if (response.status === 429) {
      if (attempt === MAX_RETRIES) {
        return { ok: false, status: 429, reason: "rate_limited" };
      }
      await sleep(RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS.at(-1));
      continue;
    }
    if (!response.ok) {
      return { ok: false, status: response.status, reason: "malformed_page" };
    }
    return { ok: true, status: response.status, body: await response.text() };
  }
  return { ok: false, status: 0, reason: "rate_limited" };
}

/** Discovers product handles from Shopify's public sitemap index. */
async function discoverProductHandles() {
  const sitemapIndex = await fetchWithRetry(`${BASE_URL}/sitemap.xml`);
  if (!sitemapIndex.ok) {
    throw new Error(`Could not fetch sitemap index: ${sitemapIndex.reason ?? sitemapIndex.status}`);
  }
  const productSitemapUrls = [...sitemapIndex.body.matchAll(/<loc>([^<]*sitemap_products[^<]*)<\/loc>/g)].map((m) => m[1]);

  const handles = new Set();
  for (const sitemapUrl of productSitemapUrls) {
    await sleep(REQUEST_DELAY_MS);
    const sitemap = await fetchWithRetry(sitemapUrl);
    if (!sitemap.ok) continue;
    for (const match of sitemap.body.matchAll(/<loc>https:\/\/jonesandsons\.com\/products\/([^<]+)<\/loc>/g)) {
      handles.add(match[1]);
    }
  }
  return Array.from(handles);
}

/** Fetches one product's public Shopify product JSON. */
async function fetchProductJson(handle) {
  const url = `${BASE_URL}/products/${handle}.json`;
  const result = await fetchWithRetry(url);
  if (!result.ok) return { handle, ok: false, reason: result.reason };
  try {
    const parsed = JSON.parse(result.body);
    return { handle, ok: true, product: parsed.product, sourceUrl: `${BASE_URL}/products/${handle}` };
  } catch {
    return { handle, ok: false, reason: "malformed_page" };
  }
}

function toRawRecord({ product, sourceUrl }) {
  if (!product) return null;
  const tier = classifyTier(product.title ?? "");
  if (READY_MIX_PATTERN.test(product.title ?? "")) {
    return { kind: "ready-mix", productName: product.title, sourceUrl };
  }
  if (tier === null) {
    return { kind: "skip", reason: "irrelevant_product", productName: product.title, sourceUrl };
  }

  const variant = (product.variants ?? [])[0];
  if (!variant || variant.price == null) {
    return { kind: "skip", reason: "no_price", productName: product.title, sourceUrl };
  }
  const price = Number(variant.price);
  if (!(price > 0)) {
    return { kind: "skip", reason: "no_price", productName: product.title, sourceUrl };
  }

  const descriptionText = `${product.body_html ?? ""} ${(product.tags ?? []).join(" ")}`;
  const branchMatch = BRANCH_EVIDENCE_PATTERN.exec(descriptionText);
  const branchEvidence = branchMatch ? branchMatch[0] : null;
  const { unit, assumed } = normalizeUnit(variant.unit ?? variant.option1);

  return {
    kind: "material",
    supplier: "Jones & Sons",
    supplierSku: variant.sku || null,
    supplierVariant: variant.title !== "Default Title" ? variant.title : null,
    productName: product.title,
    unit,
    unitAssumed: assumed,
    price,
    priceUnit: unit,
    currency: "USD",
    sourceUrl,
    sourceType: "supplier_product_page",
    regionalScope: branchEvidence ? "branch_verified" : "unconfirmed",
    branchEvidence,
    tier,
  };
}

async function loadProgress() {
  try {
    return JSON.parse(await readFile(PROGRESS_PATH, "utf8"));
  } catch {
    return {
      lastRunAt: null,
      discoveredProducts: [],
      attemptedProducts: 0,
      importedProducts: 0,
      skippedProducts: [],
      failedProducts: [],
      terreHauteVerified: 0,
      genericSupplierPrices: 0,
      quoteRequired: 0,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
  const dryRun = args.includes("--dry-run");

  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(NORMALIZED_DIR, { recursive: true });

  const progress = await loadProgress();
  const alreadyAttempted = new Set(
    [...progress.skippedProducts, ...progress.failedProducts].map((entry) => entry.url)
  );

  console.log("Discovering product handles from sitemap...");
  const handles = await discoverProductHandles();
  console.log(`Discovered ${handles.length} product handles.`);

  const materials = [];
  const readyMixNotes = [];
  const skipped = [];
  const failed = [];
  let attempted = 0;

  for (const handle of handles) {
    const sourceUrl = `${BASE_URL}/products/${handle}`;
    if (alreadyAttempted.has(sourceUrl)) continue;
    if (attempted >= limit) break;

    await sleep(REQUEST_DELAY_MS);
    attempted += 1;
    const result = await fetchProductJson(handle);
    if (!result.ok) {
      failed.push({ url: sourceUrl, reason: result.reason });
      continue;
    }

    const record = toRawRecord(result);
    if (!record) {
      failed.push({ url: sourceUrl, reason: "malformed_page" });
    } else if (record.kind === "skip") {
      skipped.push({ url: sourceUrl, reason: record.reason });
    } else if (record.kind === "ready-mix") {
      readyMixNotes.push(record);
    } else {
      materials.push(record);
    }
  }

  const terreHauteVerified = materials.filter((m) => m.regionalScope === "branch_verified").length;
  const genericSupplierPrices = materials.length - terreHauteVerified;

  const updatedProgress = {
    lastRunAt: new Date().toISOString(),
    discoveredProducts: handles.map((h) => ({ url: `${BASE_URL}/products/${h}`, discoveredVia: "sitemap" })),
    attemptedProducts: progress.attemptedProducts + attempted,
    importedProducts: progress.importedProducts + materials.length,
    skippedProducts: [...progress.skippedProducts, ...skipped],
    failedProducts: [...progress.failedProducts, ...failed],
    terreHauteVerified: progress.terreHauteVerified + terreHauteVerified,
    genericSupplierPrices: progress.genericSupplierPrices + genericSupplierPrices,
    quoteRequired: progress.quoteRequired + readyMixNotes.length,
  };

  if (dryRun) {
    console.log(JSON.stringify({ materials, readyMixNotes, skipped, failed, updatedProgress }, null, 2));
    return;
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  await writeFile(path.join(RAW_DIR, `${dateStamp}-crawl.json`), JSON.stringify({ materials, readyMixNotes }, null, 2));
  await writeFile(PROGRESS_PATH, JSON.stringify(updatedProgress, null, 2));

  console.log(`Imported ${materials.length} materials (${terreHauteVerified} Terre Haute verified, ${genericSupplierPrices} generic).`);
  console.log(`Skipped ${skipped.length}, failed ${failed.length}, ready-mix notes ${readyMixNotes.length}.`);
  console.log("Note: this script only writes dated JSON snapshots. Persisting candidates into a tenant's");
  console.log("Costbook still requires an authenticated call through the existing candidate intake API,");
  console.log("followed by normal human review and explicit promotion.");
}

main().catch((error) => {
  console.error("Jones & Sons import failed:", error);
  process.exitCode = 1;
});
