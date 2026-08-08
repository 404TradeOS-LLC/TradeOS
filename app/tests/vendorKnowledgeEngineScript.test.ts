import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// scripts/vendor-knowledge-engine.js is a plain (uncompiled) Node script run
// directly by `npm run build` — see that script's own header comment for why
// it exists. This runs it for real (a ~2.4MB copy, milliseconds) and checks
// its actual output against the real source, rather than mocking fs.
describe("scripts/vendor-knowledge-engine.js", () => {
  const appRoot = path.resolve(__dirname, "..");
  const scriptPath = path.join(appRoot, "scripts", "vendor-knowledge-engine.js");
  const destRoot = path.join(appRoot, "vendor", "knowledge-engine");
  const sourceRoot = path.resolve(appRoot, "..", "packages", "knowledge-engine");

  beforeEach(() => {
    fs.rmSync(destRoot, { recursive: true, force: true });
  });

  afterAll(() => {
    fs.rmSync(destRoot, { recursive: true, force: true });
  });

  it("copies exports/knowledge/schemas into app/vendor/knowledge-engine, matching the real source", () => {
    expect(fs.existsSync(destRoot)).toBe(false);

    execFileSync("node", [scriptPath], { stdio: "pipe" });

    for (const subdir of ["exports", "knowledge", "schemas"]) {
      expect(fs.existsSync(path.join(destRoot, subdir))).toBe(true);
    }

    const sourceCostbook = fs.readFileSync(path.join(sourceRoot, "exports", "json", "costbook.json"), "utf8");
    const copiedCostbook = fs.readFileSync(path.join(destRoot, "exports", "json", "costbook.json"), "utf8");
    expect(copiedCostbook).toBe(sourceCostbook);
  });

  it("is idempotent (re-running replaces stale content rather than merging with it)", () => {
    fs.mkdirSync(destRoot, { recursive: true });
    fs.writeFileSync(path.join(destRoot, "stale-marker.txt"), "should not survive a rebuild");

    execFileSync("node", [scriptPath], { stdio: "pipe" });

    expect(fs.existsSync(path.join(destRoot, "stale-marker.txt"))).toBe(false);
    expect(fs.existsSync(path.join(destRoot, "exports", "json", "costbook.json"))).toBe(true);
  });
});
