import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readOnboardingActionSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "onboarding.ts"), "utf8");
}

function readActionSource(action: string): string {
  const source = readOnboardingActionSource();
  const start = source.indexOf(`export async function ${action}`);
  assert.notEqual(start, -1, `expected ${action} to exist`);
  const next = source.indexOf("export async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

test("onboarding completion requires a session before any side effect", () => {
  const source = readActionSource("completeFirstEstimateOnboarding");
  assert.match(source, /const token = await getSessionToken\(\);/);
  assert.match(source, /if \(!token\) return \{ error: "Sign in before building your first estimate\." \};/);
  assert.ok(
    source.indexOf("if (!token)") < source.indexOf("/api/v1/projects"),
    "auth must be proven before the project create",
  );
});

test("onboarding completion validates the wizard payload before creating anything", () => {
  const source = readActionSource("completeFirstEstimateOnboarding");
  assert.match(source, /validateOnboardingInput\(\{/);
  assert.match(source, /workTypes: formData\.getAll\("workTypes"\)/);
  assert.match(source, /scopeText: formData\.get\("scopeText"\)/);
  assert.match(source, /laborRate: formData\.get\("laborRate"\)/);
  assert.match(source, /region: formData\.get\("region"\)/);
  assert.match(source, /if \(!value\) return \{ error: error/);
  assert.ok(
    source.indexOf("validateOnboardingInput") < source.indexOf("/api/v1/projects"),
    "validation must precede the project create",
  );
});

test("scope-to-workspace wiring: project, then estimate, then workspace", () => {
  const source = readActionSource("completeFirstEstimateOnboarding");
  const projectIndex = source.indexOf('apiFetch<{ id: string }>("/api/v1/projects"');
  const estimateIndex = source.indexOf('apiFetch<Estimate>("/api/v1/estimates"');
  const redirectIndex = source.indexOf("redirect(`/projects/${projectId}/estimates/${estimate.id}`)");
  for (const [name, index] of [
    ["project create", projectIndex],
    ["estimate create", estimateIndex],
    ["workspace redirect", redirectIndex],
  ] as const) {
    assert.notEqual(index, -1, `expected ${name}`);
  }
  assert.ok(projectIndex < estimateIndex, "project must be created before its estimate");
  assert.ok(estimateIndex < redirectIndex, "estimate must exist before the workspace redirect");
});

test("completion never calls the draft endpoint: no staged draft exists to hydrate", () => {
  const source = readActionSource("completeFirstEstimateOnboarding");
  assert.ok(!source.includes("/ai-estimator/draft"), "the draft POST is fire-and-discard — it must not run");
  assert.ok(!source.includes("scopeOfWork"), "no scope is sent to a draft endpoint");
  // The persisted scope is what Athena review regenerates from on demand.
  assert.match(source, /simpleScope: value\.scopeText/);
});

test("project create persists the scope and the first work type", () => {
  const source = readActionSource("completeFirstEstimateOnboarding");
  assert.match(source, /name: projectName/);
  assert.match(source, /jobType: value\.workTypes\[0\]/);
  assert.match(source, /simpleScope: value\.scopeText/);
  assert.match(source, /deriveProjectNameFromScope\(value\.scopeText\)/);
});

test("estimate-create failure redirects to the saved project instead of retrying the create", () => {
  const source = readActionSource("completeFirstEstimateOnboarding");
  assert.match(source, /redirect\(`\/projects\/\$\{projectId\}\?estimateStart=review`\)/);
});

test("completion persists the wizard answers on the org onboarding record, best-effort", () => {
  const source = readActionSource("completeFirstEstimateOnboarding");
  assert.match(source, /completeOnboarding\(token, \{/);
  assert.match(source, /workTypes: value\.workTypes/);
  assert.match(source, /scopeText: value\.scopeText/);
  assert.match(source, /laborRateCents: value\.laborRateCents/);
  assert.match(source, /region: value\.region/);
  assert.ok(
    source.indexOf("completeOnboarding") > source.indexOf('apiFetch<Estimate>("/api/v1/estimates"'),
    "the draft estimate must exist before its onboarding state is completed",
  );
  assert.ok(
    source.indexOf("completeOnboarding") < source.indexOf("redirect(`/projects/${projectId}/estimates/${estimate.id}`)"),
    "completion is recorded before landing on the workspace",
  );
});

test("skip action persists an org-scoped skip via the API and returns to the dashboard", () => {
  const source = readActionSource("skipFirstEstimateOnboarding");
  assert.match(source, /await skipOnboarding\(token\)/);
  assert.match(source, /redirect\("\/dashboard"\)/);
  // The persisted skip is the primary path. The legacy skip cookie is
  // set ONLY when the persist fails (Codex P2, PR #1105): without the
  // fallback bypass, a failed skip bounces the user from the dashboard
  // back to /onboarding in a loop.
  const catchIndex = source.indexOf("} catch {");
  assert.notEqual(catchIndex, -1, "expected a failure path");
  const cookieIndex = source.indexOf("ONBOARDING_SKIPPED_COOKIE");
  assert.ok(cookieIndex > catchIndex, "the fallback cookie is set only on persist failure");
  assert.match(source, /ONBOARDING_SKIP_COOKIE_MAX_AGE_SECONDS/);
  assert.ok(source.indexOf("await skipOnboarding(token)") < cookieIndex, "the API persist is tried first");
});

test("progress save sends explicit nulls for cleared scope and region (Codex P2, PR #1105)", () => {
  const source = readActionSource("saveOnboardingProgressAction");
  // The service preserves stored values for omitted fields, so a cleared
  // field must be sent as null — otherwise the deleted text reappears
  // on resume. A field the form never sends stays omitted.
  assert.match(source, /\{ scopeText: null \}/);
  assert.match(source, /\{ region: null \}/);
  assert.ok(
    source.indexOf("scopeText === null") < source.indexOf("{ scopeText: null }"),
    "null is sent only when the form sent the field present-but-empty",
  );
  assert.ok(
    source.indexOf("region === null") < source.indexOf("{ region: null }"),
    "null is sent only when the form sent the field present-but-empty",
  );
});

test("onboarding never touches the legacy recovery route or the signup path", () => {
  const source = readOnboardingActionSource();
  assert.ok(!source.includes("finish-setup"), "onboarding must not touch /finish-setup");
  assert.ok(!source.includes("signup"), "onboarding must not touch signup");
  assert.ok(!source.includes("bootstrap"), "onboarding must not touch auth bootstrap");
});
