import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function read(file: string): string {
  return fs.readFileSync(path.join(here, file), "utf8");
}

test("onboarding route renders the two-step form behind the app auth shell", () => {
  const page = read("page.tsx");
  assert.match(page, /FirstEstimateOnboardingForm/);
  assert.match(page, /title: "Get started \| TradeOS"/);
  const form = read("first-estimate-onboarding-form.tsx");
  assert.match(form, /"use client"/);
  assert.match(form, /Two things before your first estimate/);
  assert.match(form, /First useful estimate before full setup/);
});

test("wizard follows the Figma rail: work, then the real-estimate composer", () => {
  const form = read("first-estimate-onboarding-form.tsx");
  assert.match(form, /STEP_TITLES = \["Your work", "Build a real estimate"\]/);
  assert.match(form, /Step \{step\} of 2/);
  assert.match(form, /ONBOARDING_WORK_TYPES/);
  assert.match(form, /aria-pressed/);
  assert.match(form, /Give Athena a job you&apos;ve actually quoted/);
  assert.match(form, /What did the customer want done\?/);
  assert.match(form, /You don&apos;t need measurements, products, or line items yet\./);
  assert.match(form, /Build My First Estimate/);
  assert.match(form, /What TradeOS does next/);
  assert.match(form, /None of this blocks the first estimate\./);
});

test("wizard asks for the labor baseline + optional region and persists them (DES-3 slice 2)", () => {
  const form = read("first-estimate-onboarding-form.tsx");
  assert.match(form, /Your labor rate/);
  assert.match(form, /formatLaborRateDollars\(initialState\?\.laborRateCents/);
  assert.match(form, /Region \(optional\)/);
  assert.match(form, /initialState\?\.region/);
  assert.match(form, /saveOnboardingProgressAction/);
  assert.match(form, /name="laborRate"/);
  assert.match(form, /name="region"/);
  assert.match(form, /initialState\?\.workTypes/);
  assert.match(form, /initialState\?\.scopeText/);
  assert.match(form, /initialState\?\.currentStep === 2 \? 2 : 1/);
});

test("step 2 carries the known-context work chip and example jobs from the frame", () => {
  const form = read("first-estimate-onboarding-form.tsx");
  assert.match(form, /ONBOARDING_EXAMPLE_SCOPES/);
  assert.match(form, /contextChips/);
});

test("wizard offers a skip that never invents a completed state", () => {
  const form = read("first-estimate-onboarding-form.tsx");
  assert.match(form, /skipFirstEstimateOnboarding/);
  assert.match(form, /Skip for now — go to Today/);
});

test("dashboard bypass sends only a brand-new org to onboarding and fails open", () => {
  const dashboard = read("../dashboard/page.tsx");
  assert.match(dashboard, /isFirstRunRedirectNeeded/);
  assert.match(dashboard, /redirect\("\/onboarding"\)/);
  assert.ok(
    dashboard.indexOf('redirect("/onboarding")') < dashboard.indexOf("await loadTodayData()"),
    "the bypass must run before the dashboard loads",
  );
  assert.ok(!dashboard.includes("finish-setup"), "dashboard must not reroute onboarding through /finish-setup");

  const firstRun = read("../../../lib/onboarding-first-run.ts");
  assert.match(firstRun, /import "server-only"/);
  assert.match(firstRun, /ONBOARDING_SKIPPED_COOKIE/);
  assert.match(firstRun, /hasPermission\(settings\.currentRole, "crm\.write"\)/);
  assert.match(firstRun, /listProjects\(token, \{ limit: 1 \}\)/);
  assert.match(firstRun, /listEstimateQueue\(token, \{ status: "draft,ready", limit: 1 \}\)/);
  assert.match(firstRun, /shouldRedirectToOnboarding/);
  assert.match(firstRun, /\} catch \{\s*return false;\s*\}/);
});

test("login still lands on the dashboard; onboarding is a dashboard decision, not an auth one", () => {
  const auth = read("../../actions/auth.ts");
  assert.match(auth, /redirect\("\/dashboard"\)/);
  assert.ok(!auth.includes("/onboarding"), "auth actions must not redirect into onboarding");
});
