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

test("skip action persists a browser-scoped skip and returns to the dashboard", () => {
  const source = readActionSource("skipFirstEstimateOnboarding");
  assert.match(source, /cookieStore\.set\(ONBOARDING_SKIPPED_COOKIE, "1"/);
  assert.match(source, /httpOnly: true/);
  assert.match(source, /maxAge: ONBOARDING_SKIP_COOKIE_MAX_AGE_SECONDS/);
  assert.match(source, /redirect\("\/dashboard"\)/);
});

test("onboarding never touches the legacy recovery route or the signup path", () => {
  const source = readOnboardingActionSource();
  assert.ok(!source.includes("finish-setup"), "onboarding must not touch /finish-setup");
  assert.ok(!source.includes("signup"), "onboarding must not touch signup");
  assert.ok(!source.includes("bootstrap"), "onboarding must not touch auth bootstrap");
});
