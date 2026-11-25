import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readComponentSource(): Promise<string> {
  return readFile(new URL("./ai-estimate-assist.tsx", import.meta.url), "utf8");
}

function autoRunEffect(component: string): string {
  const guardIndex = component.indexOf("const autoRunAttempted = useRef(false);");
  assert.notEqual(guardIndex, -1, "expected a once-only auto-run guard ref");
  const effectIndex = component.indexOf("useEffect(() => {", guardIndex);
  assert.notEqual(effectIndex, -1, "expected an auto-run effect after the guard ref");
  const endIndex = component.indexOf("}, [", effectIndex);
  assert.notEqual(endIndex, -1, "expected the auto-run effect to close with a dependency list");
  return component.slice(effectIndex, endIndex);
}

test("AIEstimateAssist accepts an autoRunReview prop (DES-3 slice 3)", async () => {
  const component = await readComponentSource();
  assert.match(component, /autoRunReview\?: boolean/);
  // Destructured alongside the other initial props — unset means manual.
  assert.ok(component.includes("autoRunReview,"), "expected autoRunReview destructured from props");
});

test("auto-run fires the review exactly once, only with a scope and no draft yet", async () => {
  const component = await readComponentSource();
  const effect = autoRunEffect(component);
  // The prop gates everything: no param, no auto-run.
  assert.ok(effect.includes("!autoRunReview"), "auto-run must be gated on the prop");
  assert.ok(effect.includes("autoRunAttempted.current"), "auto-run must fire exactly once");
  // Same guards as the manual button: a draft already exists, or the
  // scope is blank, means nothing to generate.
  assert.ok(effect.includes("structuredDraft"), "auto-run must not regenerate over an existing draft");
  assert.ok(effect.includes("!scopeOfWork.trim()"), "auto-run must not fire on a blank scope");
  // The guard is set before the run so a re-render (or StrictMode's
  // double-effect in development) cannot fire a second generation.
  assert.ok(
    effect.indexOf("autoRunAttempted.current = true") < effect.indexOf("runReview();"),
    "the once-guard must be set before the review runs",
  );
  assert.ok(
    effect.indexOf("!scopeOfWork.trim()") < effect.indexOf("autoRunAttempted.current = true"),
    "the scope guard must precede the once-guard, so a blank scope never consumes the single attempt",
  );
});

test("auto-run reuses the manual review path instead of a second generation call", async () => {
  const component = await readComponentSource();
  const effect = autoRunEffect(component);
  assert.ok(effect.includes("runReview();"), "auto-run must reuse runReview");
  assert.ok(!effect.includes("regenerateSuggestions.mutate()"), "auto-run must not call the mutation directly");
  // The manual button is untouched: auto-run never removes the manual path.
  assert.match(component, /onClick=\{runReview\}/);
});
