#!/usr/bin/env node
"use strict";

// Vercel's `tradeos-costbook` project deploys with Root Directory "app", so
// only files inside app/ end up in the deployed Lambda's filesystem
// (confirmed against production runtime paths, e.g.
// /var/task/app/node_modules/...). packages/knowledge-engine/ is a sibling
// of app/ at the repo root, outside that boundary — it was never actually
// reachable at runtime in production, only in local/CI checkouts where the
// full monorepo is present on disk. resolveKnowledgeEnginePaths()
// (modules/knowledge-runtime/loader.ts) failed with "Unable to locate the
// TradeOS repository root for Knowledge Engine loading" for every request
// once JWT verification was fixed and this code path actually started
// running (see docs/CURRENT_STATE.md).
//
// This script copies the small (~2.4MB) read-only data directories this
// backend actually needs into app/vendor/knowledge-engine/ as a build step,
// so they're physically inside the deployed Root Directory regardless of
// Vercel's file-inclusion behavior. loader.ts checks for this vendored copy
// first and falls back to the original repo-root search (unchanged) for
// local development, so this has no effect on local/CI runs.

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SOURCE_ROOT = path.join(REPO_ROOT, "packages", "knowledge-engine");
const DEST_ROOT = path.join(__dirname, "..", "vendor", "knowledge-engine");
const SUBDIRS = ["exports", "knowledge", "schemas"];

function main() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    throw new Error(`vendor-knowledge-engine: source directory not found: ${SOURCE_ROOT}`);
  }

  fs.rmSync(DEST_ROOT, { recursive: true, force: true });
  fs.mkdirSync(DEST_ROOT, { recursive: true });

  for (const subdir of SUBDIRS) {
    const source = path.join(SOURCE_ROOT, subdir);
    const dest = path.join(DEST_ROOT, subdir);
    if (!fs.existsSync(source)) {
      throw new Error(`vendor-knowledge-engine: expected source subdirectory missing: ${source}`);
    }
    fs.cpSync(source, dest, { recursive: true });
  }

  console.log(`vendor-knowledge-engine: copied ${SUBDIRS.join(", ")} from ${SOURCE_ROOT} to ${DEST_ROOT}`);
}

main();
