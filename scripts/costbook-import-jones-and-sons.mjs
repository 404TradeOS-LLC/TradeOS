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
const ALLOWED_HOST = new URL(BASE_URL).hostname;
const REQUEST_DELAY_MS = 1500; // polite, low-concurrency default
const REQUEST_TIMEOUT_MS = 15000;
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
const TERRE_HAUTE_BRANCH = "Terre Haute";
// Matches explicit branch-pickup language such as "Pickup available at
// Terre Haute" or "Terre Haute pickup", for ANY of the four branches - the
// matched branch name is then compared against TERRE_HAUTE_BRANCH before a
// record can ever be marked "branch_verified" (see extractBranchEvidence).
// This is deliberately conservative: it is the ONLY thing allowed to set
// regionalScope to "branch_verified".
const BRANCH_EVIDENCE_PATTERN = new RegExp(
  `(pickup[^.]{0,40}(${BRANCH_NAMES.join("|")})|(${BRANCH_NAMES.join("|")})[^.]{0,40}pickup)`,
  "i"
);
// A negation anywhere in the matched evidence (e.g. "pickup unavailable at
// Terre Haute", "Terre Haute pickup is not available") must veto the match -
// erring toward unconfirmed on ambiguity is the safe direction, never the
// other way.
const NEGATION_PATTERN = /\b(not|no|never|unavailable|discontinued)\b/i;
const READY_MIX_PATTERN = /ready[\s-]?mix(ed)?\s+concrete/i;

/** Finds branch-pickup evidence in text and identifies which branch it names.
 * Returns null if the containing clause is negated (pickup NOT available).
 * The negation check inspects the whole sentence around the match, not just
 * the regex capture itself - "No pickup at Terre Haute" and "Terre Haute
 * pickup is not available" both put the negation word outside match[0]. */
function extractBranchEvidence(text) {
  const match = BRANCH_EVIDENCE_PATTERN.exec(text);
  if (!match) return null;
  const evidence = match[0];
  const clauseStart = text.lastIndexOf(".", match.index) + 1;
  const periodAfter = text.indexOf(".", match.index + evidence.length);
  const clauseEnd = periodAfter === -1 ? text.length : periodAfter;
  const clause = text.slice(clauseStart, clauseEnd);
  if (NEGATION_PATTERN.test(clause)) return null;
  const branch = BRANCH_NAMES.find((name) => evidence.toLowerCase().includes(name.toLowerCase())) ?? null;
  return { evidence, branch };
}

function classifyTier(name) {
  const lower = name.toLowerCase();
  if (EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw))) return null;
  if (TIER_1_KEYWORDS.some((kw) => lower.includes(kw))) return 1;
  if (TIER_2_KEYWORDS.some((kw) => lower.includes(kw))) return 2;
  if (TIER_3_KEYWORDS.some((kw) => lower.includes(kw))) return 3;
  return null;
}

const KNOWN_UNITS = {
  tn: "ton", tons: "ton", ton: "ton",
  ea: "each", each: "each",
  lb: "lb", lbs: "lb",
  cy: "cubic_yard", "yd3": "cubic_yard", "yd³": "cubic_yard",
  sf: "sq_ft", sqft: "sq_ft",
  lf: "linear_ft", linft: "linear_ft",
  bag: "bag", bags: "bag",
};

// Only a recognized unit token counts as source-confirmed. Shopify variants
// have no reliable dedicated unit field, so callers may pass a fallback
// like option1 (frequently "Default Title", a size, or an unrelated
// product option) - if it doesn't match a known unit exactly, it must be
// treated as unresolved/assumed rather than accepted at face value.
function normalizeUnit(rawUnit) {
  if (!rawUnit) return { unit: undefined, assumed: true };
  const key = rawUnit.trim().toLowerCase();
  if (key in KNOWN_UNITS) return { unit: KNOWN_UNITS[key], assumed: false };
  return { unit: undefined, assumed: true };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url) {
  // Refuse anything but a plain https:// request to the known supplier host.
  // Sitemap <loc> values are supplier-controlled input; a compromised or
  // malicious sitemap must not be able to redirect this tool to an
  // unapproved host (SSRF). `redirect: "error"` below closes the same gap
  // for any redirect encountered mid-request.
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, status: 0, reason: "malformed_page" };
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== ALLOWED_HOST) {
    return { ok: false, status: 0, reason: "malformed_page" };
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "TradeOS-Costbook-SupplierImport/1.0 (+https://github.com/404TradeOS-LLC/TradeOS)" },
        redirect: "error",
        signal: controller.signal,
      });
      const isServerError = response.status >= 500 && response.status < 600;
      const retryable = response.status === 429 || isServerError;
      if (retryable) {
        if (attempt === MAX_RETRIES) {
          return { ok: false, status: response.status, reason: response.status === 429 ? "rate_limited" : "server_error" };
        }
        await sleep(RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS.at(-1));
        continue;
      }
      if (!response.ok) {
        return { ok: false, status: response.status, reason: "malformed_page" };
      }
      const body = await response.text();
      return { ok: true, status: response.status, body };
    } catch (error) {
      // Network error, timeout, or a redirect refused by `redirect: "error"`.
      // Treated as transient and retried with backoff, same as a 429/5xx, so
      // a flaky connection can't crash the whole crawl before progress is
      // saved - but the reason is preserved distinctly rather than
      // collapsed into "rate_limited" so progress.json reflects what
      // actually happened.
      const reason = error.name === "AbortError" ? "timeout" : "network_error";
      if (attempt === MAX_RETRIES) {
        return { ok: false, status: 0, reason };
      }
      await sleep(RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS.at(-1));
    } finally {
      clearTimeout(timeout);
    }
  }
  return { ok: false, status: 0, reason: "network_error" };
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

/** Returns an array of raw records for one product: one "material" entry per
 * priced variant, or a single "ready-mix"/"skip" marker. A multi-variant
 * material product (e.g. distinct bag sizes or grades) must not silently
 * collapse to just its first variant. */
function toRawRecords({ product, sourceUrl }) {
  if (!product) return [];
  const tier = classifyTier(product.title ?? "");
  if (READY_MIX_PATTERN.test(product.title ?? "")) {
    return [{ kind: "ready-mix", productName: product.title, sourceUrl }];
  }
  if (tier === null) {
    return [{ kind: "skip", reason: "irrelevant_product", productName: product.title, sourceUrl }];
  }

  const pricedVariants = (product.variants ?? []).filter(
    (variant) => variant.price != null && Number(variant.price) > 0
  );
  if (pricedVariants.length === 0) {
    return [{ kind: "skip", reason: "no_price", productName: product.title, sourceUrl }];
  }

  const descriptionText = `${product.body_html ?? ""} ${(product.tags ?? []).join(" ")}`;
  const branchMatch = extractBranchEvidence(descriptionText);
  const isTerreHauteVerified = branchMatch?.branch === TERRE_HAUTE_BRANCH;

  return pricedVariants.map((variant) => {
    const price = Number(variant.price);
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
      regionalScope: isTerreHauteVerified ? "branch_verified" : "unconfirmed",
      branchEvidence: isTerreHauteVerified ? branchMatch.evidence : null,
      tier,
    };
  });
}

/** Buckets crawled materials into the same terreHauteVerified/observedUnverified/
 * quoteRequired shape as normalized/2026-09-12-seed.json. `trade` and `category`
 * are curated classifications (see JonesAndSonsRecord in jonesAndSonsTerreHaute.ts)
 * that this crawler cannot reliably derive from raw Shopify product JSON, so they
 * are left for the human review step rather than guessed. */
function buildNormalizedSnapshot(materials, readyMixNotes) {
  const toEntry = (m) => ({
    supplierProductName: m.productName,
    supplierSku: m.supplierSku,
    supplierVariant: m.supplierVariant,
    trade: null,
    category: null,
    unitOfMeasure: m.unit ?? null,
    unitAssumed: m.unitAssumed,
    materialCostTypical: m.price,
    sourceUrl: m.sourceUrl,
    regionalBasis: m.branchEvidence,
    confidence: m.regionalScope === "branch_verified" ? "high" : "low",
    provenanceStatus: "documented",
  });

  return {
    note:
      "Generated by scripts/costbook-import-jones-and-sons.mjs from raw crawl output. " +
      "trade/category are left null pending human classification - toJonesAndSonsCandidate() " +
      "and the curated JonesAndSonsRecord entries in jonesAndSonsTerreHaute.ts remain the " +
      "governed path into the Costbook candidate pipeline.",
    generatedAt: new Date().toISOString(),
    terreHauteVerified: materials.filter((m) => m.regionalScope === "branch_verified").map(toEntry),
    observedUnverified: materials.filter((m) => m.regionalScope !== "branch_verified").map(toEntry),
    quoteRequired: readyMixNotes.map((r) => ({
      productName: r.productName,
      sourceUrl: r.sourceUrl,
      pricingModel: "per_yard_via_dispatch",
      price: null,
    })),
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
      importedProductUrls: [],
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
  // Permanently-skipped products (irrelevant, no price) and products already
  // successfully imported in a prior run are excluded on resume - a product
  // whose materials are already in progress.json must not be re-fetched and
  // re-counted every run. Failed products (rate-limited, transient
  // fetch/parse errors) must remain eligible for retry, or a resumed crawl
  // can never recover them without manually editing progress.json.
  const previouslyImportedUrls = new Set(progress.importedProductUrls ?? []);
  const alreadyAttempted = new Set([
    ...progress.skippedProducts.map((entry) => entry.url),
    ...previouslyImportedUrls,
  ]);

  console.log("Discovering product handles from sitemap...");
  const handles = await discoverProductHandles();
  console.log(`Discovered ${handles.length} product handles.`);

  const materials = [];
  const readyMixNotes = [];
  const skipped = [];
  const failed = [];
  const retried = new Set();
  const newlyImportedUrls = new Set();
  let attempted = 0;

  for (const handle of handles) {
    const sourceUrl = `${BASE_URL}/products/${handle}`;
    if (alreadyAttempted.has(sourceUrl)) continue;
    if (attempted >= limit) break;

    retried.add(sourceUrl);
    await sleep(REQUEST_DELAY_MS);
    attempted += 1;
    const result = await fetchProductJson(handle);
    if (!result.ok) {
      failed.push({ url: sourceUrl, reason: result.reason });
      continue;
    }

    const records = toRawRecords(result);
    if (records.length === 0) {
      failed.push({ url: sourceUrl, reason: "malformed_page" });
    }
    for (const record of records) {
      if (record.kind === "skip") {
        skipped.push({ url: sourceUrl, reason: record.reason });
      } else if (record.kind === "ready-mix") {
        readyMixNotes.push(record);
        newlyImportedUrls.add(sourceUrl);
      } else {
        materials.push(record);
        newlyImportedUrls.add(sourceUrl);
      }
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
    // Drop stale entries for URLs retried this run before appending their
    // fresh outcome, so a URL that finally succeeds (or fails again) isn't
    // duplicated or stuck under its old result.
    failedProducts: [
      ...progress.failedProducts.filter((entry) => !retried.has(entry.url)),
      ...failed,
    ],
    // Successfully-processed URLs are excluded from every future crawl (see
    // alreadyAttempted above), so re-running the script never re-fetches or
    // double-counts a product it already imported.
    importedProductUrls: [...previouslyImportedUrls, ...newlyImportedUrls],
    terreHauteVerified: progress.terreHauteVerified + terreHauteVerified,
    genericSupplierPrices: progress.genericSupplierPrices + genericSupplierPrices,
    quoteRequired: progress.quoteRequired + readyMixNotes.length,
  };

  if (dryRun) {
    console.log(JSON.stringify({ materials, readyMixNotes, skipped, failed, updatedProgress }, null, 2));
    return;
  }

  // A full timestamp (not just the date) keeps same-day reruns from
  // overwriting each other's raw/normalized snapshot, preserving every run
  // as its own historical observation.
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeFile(path.join(RAW_DIR, `${runStamp}-crawl.json`), JSON.stringify({ materials, readyMixNotes }, null, 2));
  await writeFile(
    path.join(NORMALIZED_DIR, `${runStamp}-crawl.json`),
    JSON.stringify(buildNormalizedSnapshot(materials, readyMixNotes), null, 2)
  );
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
