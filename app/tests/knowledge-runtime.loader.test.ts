import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildKnowledgeSourceFiles, loadKnowledgeEngineSnapshot, resolveKnowledgeEnginePaths, vendoredKnowledgeEngineRoot } from "../modules/knowledge-runtime/loader";

// Regression coverage for a production incident: Vercel's `tradeos-costbook`
// project deploys with Root Directory "app", so packages/knowledge-engine/
// (a sibling of app/ at the repo root) was never actually present at
// runtime in production — resolveKnowledgeEnginePaths() threw "Unable to
// locate the TradeOS repository root" on every request that reached it
// (GET /api/v1/knowledge/stats and every other knowledge-runtime route),
// which crashed the frontend dashboard and AI Estimate Assist pages into
// their generic error boundary. Fixed by app/scripts/vendor-knowledge-engine.js
// copying the needed data into app/vendor/knowledge-engine/ at build time,
// physically inside the deployed Root Directory; this test proves
// resolveKnowledgeEnginePaths() actually prefers that location when present,
// using a real directory at the same fixed offset the loader itself checks
// (not a stand-in), then cleans it up.
describe("vendored Knowledge Engine path (Vercel Root Directory packaging fix)", () => {
  const vendoredRoot = vendoredKnowledgeEngineRoot();

  afterEach(() => {
    fs.rmSync(vendoredRoot, { recursive: true, force: true });
  });

  it("prefers a vendored copy over the repo-root search when present", () => {
    fs.mkdirSync(path.join(vendoredRoot, "exports", "json"), { recursive: true });
    fs.mkdirSync(path.join(vendoredRoot, "knowledge", "knowledge"), { recursive: true });
    fs.mkdirSync(path.join(vendoredRoot, "schemas"), { recursive: true });
    fs.writeFileSync(
      path.join(vendoredRoot, "exports", "json", "costbook.json"),
      JSON.stringify({ assemblies: [{ id: "vendored-assembly", name: "Vendored", category: "Test" }], items: [] })
    );

    const paths = resolveKnowledgeEnginePaths();

    expect(paths.repoRoot).toBe(vendoredRoot);
    expect(paths.exportsDir).toBe(path.join(vendoredRoot, "exports"));

    const snapshot = loadKnowledgeEngineSnapshot(paths);
    expect(snapshot.assemblies).toEqual([{ id: "vendored-assembly", name: "Vendored", category: "Test" }]);
  });

  it("falls back to the repo-root search when no vendored copy exists (unchanged local/CI behavior)", () => {
    expect(fs.existsSync(vendoredRoot)).toBe(false);

    const paths = resolveKnowledgeEnginePaths();

    expect(paths.repoRoot).not.toBe(vendoredRoot);
    expect(fs.existsSync(path.join(paths.exportsDir, "json", "costbook.json"))).toBe(true);
  });
});

describe("knowledge runtime loader", () => {
  it("finds the migrated Knowledge Engine directories", () => {
    const paths = resolveKnowledgeEnginePaths();
    const sourceFiles = buildKnowledgeSourceFiles(paths);

    expect(fs.existsSync(path.join(paths.exportsDir, "json", "costbook.json"))).toBe(true);
    expect(fs.existsSync(sourceFiles.assemblyIndexPath)).toBe(true);
    expect(fs.existsSync(paths.schemasDir)).toBe(true);
  });

  it("loads assemblies, cost items, trades, and schemas from disk", () => {
    const snapshot = loadKnowledgeEngineSnapshot();

    expect(snapshot.assemblies.length).toBeGreaterThan(0);
    expect(snapshot.costItems.length).toBeGreaterThan(0);
    expect(snapshot.tradeProgress.length).toBeGreaterThan(0);
    expect(snapshot.schemaFiles.length).toBeGreaterThan(0);
    expect(snapshot.taxonomyText.length).toBeGreaterThan(0);
  });

  it("gracefully handles missing optional knowledge files", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-runtime-loader-"));
    const exportsDir = path.join(tempRoot, "exports");
    const schemasDir = path.join(tempRoot, "schemas");
    const knowledgeDir = path.join(tempRoot, "knowledge");

    fs.mkdirSync(path.join(exportsDir, "json"), { recursive: true });
    fs.mkdirSync(schemasDir, { recursive: true });
    fs.mkdirSync(knowledgeDir, { recursive: true });

    fs.writeFileSync(
      path.join(exportsDir, "json", "costbook.json"),
      JSON.stringify({ assemblies: [{ id: "assembly-1", name: "Test Assembly", category: "Test" }], items: [{ id: "item-1", name: "Test Item", category: "Test" }] })
    );
    fs.writeFileSync(path.join(schemasDir, "cost-item.schema.json"), JSON.stringify({ title: "cost-item" }));

    const snapshot = loadKnowledgeEngineSnapshot({
      repoRoot: tempRoot,
      exportsDir,
      knowledgeDir,
      schemasDir,
    });

    expect(snapshot.assemblies).toHaveLength(1);
    expect(snapshot.costItems).toHaveLength(1);
    expect(snapshot.tradeProgress).toHaveLength(0);
    expect(snapshot.assemblyIndex).toHaveLength(0);
    expect(snapshot.taxonomyText).toBe("");
    expect(snapshot.loadWarnings.length).toBeGreaterThan(0);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});
