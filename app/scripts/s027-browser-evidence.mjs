import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { VIEWPORTS, readPngDimensions } from "./beta-evidence/lib/evidence-artifacts.mjs";
import { assertApprovedRcUrl, assertNonProductionDataPlane } from "./beta-evidence/lib/rc-target.mjs";
import { assertCostbookPage, COSTBOOK_ROUTES } from "./s027-evidence-contract.mjs";

const baseUrl = assertApprovedRcUrl(process.env.S027_BASE_URL).origin;
assertNonProductionDataPlane(process.env.BETA_RC_SUPABASE_PROJECT_REF);
assert.equal(process.env.S027_SANITIZED_TENANT, "true", "Sanitized smoke tenant confirmation required");
assert.equal(process.env.S027_ALLOW_MUTATIONS, "true", "Smoke fixture mutation consent required");
const storageState = process.env.S027_STORAGE_STATE_PATH;
assert.ok(storageState, "S027_STORAGE_STATE_PATH is required");
const outDir = process.env.S027_EVIDENCE_DIR || "../artifacts/s027-browser-evidence";
const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
const report = { generatedAt: new Date().toISOString(), baseUrl, runnerSha: process.env.GITHUB_SHA, routes: [], failures: [] };
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function screenshot(page, name) {
  const file = `${name}.png`;
  const buffer = await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  assert.equal(readPngDimensions(buffer)?.width, page.viewportSize().width, "Screenshot width must match viewport");
  return file;
}

async function metrics(page) {
  return page.evaluate(() => ({
    pathname: location.pathname,
    bodyText: document.body.innerText,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

async function keyboardEvidence(page) {
  const first = page.locator('main a[href], main button:not([disabled]), main input:not([disabled]), main select:not([disabled])').first();
  await first.focus();
  // Enter the first content control by keyboard, including read-only pages
  // whose only content control is the back link (Tab forward would leave it).
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  assert.ok(await first.evaluate(el => document.activeElement === el), "Tab must reach the first content control");
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const hit = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, rect.x + rect.width / 2)), Math.max(0, Math.min(innerHeight - 1, rect.y + rect.height / 2)));
    return {
      tag: el.tagName, visible: rect.width > 0 && rect.height > 0,
      focusVisible: el.matches(":focus-visible"),
      indicator: (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none",
      unobscured: el === hit || el.contains(hit),
    };
  });
  assert.ok(focus.visible && focus.focusVisible && focus.indicator && focus.unobscured, `Keyboard focus is not visible/reachable: ${JSON.stringify(focus)}`);
  return focus;
}

async function submit(page, method, suffix, button, status) {
  const pending = page.waitForResponse(r => new URL(r.url()).pathname === `/api/proxy/costbook/${suffix}` && r.request().method() === method);
  await button.click();
  const response = await pending;
  assert.equal(response.status(), status, `${method} ${suffix} status`);
  return response;
}

async function exerciseEquipment(page, viewport, entry) {
  const name = `S027-${runId}-${viewport.name}`;
  const form = page.getByRole("region", { name: "Create equipment", exact: true });
  await form.getByLabel("Name", { exact: true }).fill("   ");
  await form.getByLabel("Ownership Cost", { exact: true }).fill("20");
  await form.getByLabel("Operating Cost", { exact: true }).fill("5");
  const rejected = await submit(page, "POST", "equipment", form.getByRole("button", { name: "Add Equipment", exact: true }), 400);
  await page.getByRole("alert").filter({ hasText: /.+/ }).first().waitFor();
  entry.validationError = { status: rejected.status(), screenshot: await screenshot(page, `equipment-${viewport.name}-validation-error`) };
  await form.getByLabel("Name", { exact: true }).fill(name);
  const createdResponse = await submit(page, "POST", "equipment", form.getByRole("button", { name: "Add Equipment", exact: true }), 201);
  const created = await createdResponse.json();
  assert.ok(created.id, "Created fixture must have an ID");
  entry.fixtureId = created.id;
  try {
    await page.getByText(name, { exact: true }).filter({ visible: true }).waitFor();
    entry.created = await screenshot(page, `equipment-${viewport.name}-created`);
    await page.reload({ waitUntil: "networkidle" });
    const row = page.locator("tr, article").filter({ hasText: name }).filter({ visible: true });
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    const edit = page.getByRole("region", { name: "Edit equipment", exact: true });
    await edit.getByLabel("Operating Cost", { exact: true }).fill("7");
    await submit(page, "PATCH", `equipment/${created.id}`, edit.getByRole("button", { name: "Save Equipment", exact: true }), 200);
    await page.reload({ waitUntil: "networkidle" });
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    assert.equal(await edit.getByLabel("Operating Cost", { exact: true }).inputValue(), "7", "Edited equipment must survive reload");
    entry.editedAndReloaded = await screenshot(page, `equipment-${viewport.name}-edited`);
    page.once("dialog", dialog => dialog.accept());
    await submit(page, "DELETE", `equipment/${created.id}`, row.getByRole("button", { name: "Delete", exact: true }), 204);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.getByText(name, { exact: true }).count(), 0, "Deleted fixture must stay deleted after reload");
    entry.deletedAndReloaded = true;
  } finally {
    if (!entry.deletedAndReloaded) {
      const cleanup = await page.request.delete(new URL(`/api/proxy/costbook/equipment/${created.id}`, baseUrl).toString());
      entry.cleanupStatus = cleanup.status();
      assert.ok([204, 404].includes(cleanup.status()), "Smoke fixture cleanup failed");
    }
  }
}

async function exercisePricing(page, viewport, entry) {
  await page.getByLabel("Job cost", { exact: true }).fill("100");
  await submit(page, "POST", "pricing/preview", page.getByRole("button", { name: "Calculate preview", exact: true }), 200);
  await page.getByText("$120.00", { exact: true }).waitFor();
  entry.calculated = await screenshot(page, `pricing-${viewport.name}-calculated`);
}

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, storageState });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    for (const route of COSTBOOK_ROUTES) {
      const entry = { path: route.path, viewport: viewport.name, passed: false };
      report.routes.push(entry);
      const errors = [];
      const onError = () => errors.push("Uncaught browser exception");
      page.on("pageerror", onError);
      try {
        const response = await page.goto(new URL(route.path, baseUrl).toString(), { waitUntil: "networkidle", timeout: 90_000 });
        entry.status = response?.status() ?? 0;
        await page.getByRole("heading", { name: route.title, level: 1, exact: true }).waitFor();
        const state = await metrics(page);
        assertCostbookPage({ ...state, expectedPath: route.path, status: entry.status });
        entry.dimensions = { scrollWidth: state.scrollWidth, clientWidth: state.clientWidth };
        entry.keyboard = await keyboardEvidence(page);
        entry.screenshot = await screenshot(page, `${route.slug}-${viewport.name}`);
        if (route.slug === "equipment") await exerciseEquipment(page, viewport, entry);
        if (route.slug === "pricing") await exercisePricing(page, viewport, entry);
        assertCostbookPage({ ...await metrics(page), expectedPath: route.path, status: entry.status });
        assert.deepEqual(errors, [], "Uncaught browser errors during route verification");
        entry.passed = true;
        console.log(`PASS ${route.path} ${viewport.name}px`);
      } catch (error) {
        entry.error = error.message;
        report.failures.push({ path: route.path, viewport: viewport.name, error: error.message });
        await screenshot(page, `${route.slug}-${viewport.name}-failure`).catch(() => {});
        console.error(`FAIL ${route.path} ${viewport.name}px: ${error.message}`);
      } finally {
        page.off("pageerror", onError);
        await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  report.result = report.routes.length === 36 && report.routes.every(entry => entry.passed) ? "PASS" : "FAIL";
  await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
}
if (report.result !== "PASS") process.exitCode = 1;
