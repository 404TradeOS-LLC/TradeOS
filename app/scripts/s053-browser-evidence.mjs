import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assertApprovedRcUrl, assertNonProductionDataPlane } from "./beta-evidence/lib/rc-target.mjs";

const baseUrl = assertApprovedRcUrl(process.env.S053_BASE_URL).origin;
const expectedSupabaseRef = assertNonProductionDataPlane(process.env.BETA_RC_SUPABASE_PROJECT_REF);
const storageState = process.env.S053_STORAGE_STATE_PATH;
const outDir = process.env.S053_EVIDENCE_DIR || "../artifacts/s053-browser-evidence";
const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
const tenantLabel = process.env.BETA_SMOKE_ORG_LABEL || "TradeOS Beta Smoke";

assert.equal(process.env.S053_SANITIZED_TENANT, "true", "Sanitized smoke tenant confirmation required");
assert.equal(process.env.S053_ALLOW_MUTATIONS, "true", "S053 evidence mutation consent required");
assert.ok(storageState, "S053_STORAGE_STATE_PATH is required");

const deploymentIdentity = JSON.parse(await fs.readFile(path.join(outDir, "deployment-identity.json"), "utf8"));
assert.equal(deploymentIdentity.supabaseProjectRef, expectedSupabaseRef, "S053 evidence must use the attested non-production RC data plane");

const viewports = [
  { name: "1440", width: 1440, height: 900 },
  { name: "768", width: 768, height: 900 },
  { name: "390", width: 390, height: 844 },
];

const scope =
  "Paint a 2.5-car garage floor. Existing coating is worn but mostly adhered. Customer wants beige/tan. Use a two-part epoxy floor coating.";
const setupRequiredScope =
  "Calibrate 7 zorblax flux manifolds with nebula-grade finish.";

const report = {
  generatedAt: new Date().toISOString(),
  deployedSha: deploymentIdentity.commitSha,
  baseUrl,
  tenantLabel,
  viewports: [],
  result: "FAIL",
};

await fs.mkdir(outDir, { recursive: true });

function assertBusiness(entry, name, condition, detail = "") {
  entry.assertions.push({ name, passed: Boolean(condition), ...(detail ? { detail } : {}) });
  assert.ok(condition, detail ? name + ": " + detail : name);
}

async function proxyJson(page, pathName, init = {}) {
  return page.evaluate(async ({ pathName, init }) => {
    const response = await fetch("/api/proxy" + pathName, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { status: response.status, ok: response.ok, body };
  }, { pathName, init });
}

async function screenshot(page, entry, name) {
  const state = await page.evaluate(() => ({
    pathname: location.pathname,
    bodyText: document.body?.innerText ?? "",
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assertBusiness(
    entry,
    name + " stays inside viewport",
    state.scrollWidth <= state.clientWidth + 2,
    "scrollWidth=" + state.scrollWidth + ", clientWidth=" + state.clientWidth,
  );
  assertBusiness(entry, name + " is not login/error evidence", state.pathname !== "/login" && !/internal server error|application error/i.test(state.bodyText));
  const file = entry.viewport + "-" + name + ".png";
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  entry.screenshots.push({ name, file, pathname: state.pathname, scrollWidth: state.scrollWidth, clientWidth: state.clientWidth });
}

async function waitForEstimateLineCount(page, estimateId, minimum, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    const response = await proxyJson(page, "/estimates/" + estimateId);
    if (response.ok) {
      latest = response.body;
      if ((latest?.lineItems?.length ?? 0) >= minimum) return latest;
    }
    await page.waitForTimeout(300);
  }
  throw new Error("Timed out waiting for estimate line count >= " + minimum + "; last=" + JSON.stringify(latest));
}

async function resolveClarifications(page, entry, estimateId, expectedLineCount) {
  let answered = 0;
  for (; answered < 6; answered += 1) {
    const marker = page.getByText("One thing Athena needs", { exact: true });
    if (!(await marker.isVisible().catch(() => false))) break;
    assertBusiness(entry, "clarification " + (answered + 1) + " is single-question", (await marker.count()) === 1);

    const block = marker.locator("..");
    await screenshot(page, entry, "clarification-" + (answered + 1));

    const preferredChoices = [
      "Mostly adhered",
      "Use preferred TradeOS material",
      "Standard access",
      "Minor",
    ];
    let chose = false;
    for (const choice of preferredChoices) {
      const button = block.getByRole("button", { name: choice, exact: true });
      if (await button.isVisible().catch(() => false)) {
        await button.click();
        chose = true;
        break;
      }
    }

    if (!chose) {
      const textarea = block.getByRole("textbox").last();
      await textarea.fill("Use standard TradeOS assumptions for this sanitized evidence fixture.");
    }

    const continueButton = block.getByRole("button", { name: /Continue/ });
    await continueButton.click();
    await page.waitForLoadState("networkidle");
    const afterClarification = await proxyJson(page, "/estimates/" + estimateId);
    assertBusiness(
      entry,
      "clarification " + (answered + 1) + " causes no silent estimate write",
      afterClarification.ok && (afterClarification.body?.lineItems?.length ?? -1) === expectedLineCount,
      "line count became " + (afterClarification.body?.lineItems?.length ?? "unknown"),
    );
  }

  assertBusiness(
    entry,
    "clarification loop finishes",
    !(await page.getByText("One thing Athena needs", { exact: true }).isVisible().catch(() => false)),
    "Athena still required clarification after six sequential answers",
  );
  entry.clarificationsAnswered = answered;
}

async function exerciseViewport(browser, viewport) {
  const entry = {
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    assertions: [],
    screenshots: [],
    consoleErrors: [],
    failedRequests: [],
    result: "FAIL",
  };
  report.viewports.push(entry);

  const context = await browser.newContext({
    storageState,
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  page.on("console", (message) => {
    if (message.type() === "error") entry.consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    const requestUrl = new URL(request.url());
    if (failure?.errorText === "net::ERR_ABORTED" && requestUrl.origin === baseUrl) return;
    entry.failedRequests.push(request.method() + " " + request.url() + " — " + (failure?.errorText ?? "failed"));
  });

  const suffix = runId + "-" + viewport.name;
  const customerName = "S053 Evidence Customer " + suffix;
  const projectName = "S053 Garage Floor " + suffix;

  try {
    await page.goto(new URL("/dashboard", baseUrl).toString(), { waitUntil: "networkidle", timeout: 60000 });
    assertBusiness(entry, "authenticated shell opens", new URL(page.url()).pathname !== "/login", "landed on " + page.url());
    await screenshot(page, entry, "authenticated-shell");

    await page.goto(new URL("/customers/new", baseUrl).toString(), { waitUntil: "networkidle", timeout: 60000 });
    await page.locator('[name="name"]').fill(customerName);
    await page.locator('[name="email"]').fill("s053-" + suffix + "@example.invalid");
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.waitForLoadState("networkidle");

    await page.goto(new URL("/projects/new", baseUrl).toString(), { waitUntil: "networkidle", timeout: 60000 });
    await page.locator("select[name=customerId]").selectOption({ label: customerName });
    await page.locator('[name="name"]').fill(projectName);
    await page.locator('[name="jobType"]').fill("Garage floor coating");
    await page.locator('[name="siteAddress"]').fill("100 Evidence Way");
    await page.locator('[name="simpleScope"]').fill(scope);
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForLoadState("networkidle");

    const projectLink = page.locator('a[href^="/projects/"]').filter({ hasText: projectName }).first();
    const projectHref = await projectLink.getAttribute("href");
    const projectId = projectHref ? /\/projects\/([^/?]+)/.exec(projectHref)?.[1] : null;
    assertBusiness(entry, "project id resolves", Boolean(projectId), "href=" + (projectHref ?? "missing"));

    await page.goto(new URL("/projects/" + projectId + "?tab=estimate-history", baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.getByRole("button", { name: "Create first estimate", exact: true }).click();
    await page.waitForURL(new RegExp("/projects/" + projectId + "/estimates/[^/]+$"), { timeout: 60000 });
    const estimateId = /\/estimates\/([^/?]+)/.exec(page.url())?.[1];
    assertBusiness(entry, "estimate id resolves", Boolean(estimateId), "url=" + page.url());
    entry.projectId = projectId;
    entry.estimateId = estimateId;

    const before = await proxyJson(page, "/estimates/" + estimateId);
    assertBusiness(entry, "estimate read succeeds before Athena", before.ok);
    const initialLineCount = before.body?.lineItems?.length ?? 0;
    entry.initialLineCount = initialLineCount;

    const description = page.getByLabel("Contractor job description");
    await description.fill(scope);
    await screenshot(page, entry, "scope-before-athena");

    await page.getByRole("button", { name: "Build estimate", exact: true }).click();
    await page.getByText("Estimate items", { exact: true }).waitFor({ timeout: 60000 });
    await page.waitForLoadState("networkidle");

    const afterDraft = await proxyJson(page, "/estimates/" + estimateId);
    assertBusiness(
      entry,
      "Athena draft causes no silent write",
      afterDraft.ok && (afterDraft.body?.lineItems?.length ?? -1) === initialLineCount,
      "line count became " + (afterDraft.body?.lineItems?.length ?? "unknown"),
    );

    await resolveClarifications(page, entry, estimateId, initialLineCount);

    const includeCheckboxes = page.getByLabel("Include in estimate");
    const readyCount = await includeCheckboxes.count();
    assertBusiness(entry, "Athena returns at least one resolved reviewed line", readyCount > 0, "readyCount=" + readyCount);

    const costbookCount = await page.getByText("Costbook", { exact: true }).count();
    const assemblyCount = await page.getByText("Assembly", { exact: true }).count();
    assertBusiness(
      entry,
      "resolved lines expose Costbook/assembly provenance",
      costbookCount + assemblyCount > 0,
      "Costbook=" + costbookCount + ", Assembly=" + assemblyCount,
    );
    await screenshot(page, entry, "athena-reviewed-suggestions");

    const beforeReview = await proxyJson(page, "/estimates/" + estimateId);
    assertBusiness(
      entry,
      "suggestions remain unpersisted before explicit selection",
      beforeReview.ok && (beforeReview.body?.lineItems?.length ?? -1) === initialLineCount,
    );

    await includeCheckboxes.first().check();
    const addButton = page.getByRole("button", { name: "Add to estimate", exact: true });
    assertBusiness(entry, "explicit selection enables Add to estimate", await addButton.isEnabled());
    await screenshot(page, entry, "explicit-review-before-apply");

    const preApplySubtotal = Number(beforeReview.body?.subtotalCost ?? 0);
    const preApplyTotal = Number(beforeReview.body?.totalPrice ?? 0);
    await addButton.click();
    await page.getByRole("status").filter({ hasText: /item\(s\) added|Review the estimate Items/i }).waitFor({ timeout: 60000 });

    const afterApply = await waitForEstimateLineCount(page, estimateId, initialLineCount + 1);
    const persistedLineCount = afterApply.lineItems?.length ?? 0;
    assertBusiness(entry, "accepted line persists", persistedLineCount > initialLineCount, "lineCount=" + persistedLineCount);
    assertBusiness(
      entry,
      "Estimate Engine refreshes authoritative pricing",
      Number(afterApply.subtotalCost ?? 0) !== preApplySubtotal || Number(afterApply.totalPrice ?? 0) !== preApplyTotal,
      "subtotal " + preApplySubtotal + "->" + afterApply.subtotalCost + "; total " + preApplyTotal + "->" + afterApply.totalPrice,
    );
    entry.postApply = {
      lineCount: persistedLineCount,
      subtotalCost: afterApply.subtotalCost,
      totalPrice: afterApply.totalPrice,
    };
    await screenshot(page, entry, "after-explicit-apply");

    await page.reload({ waitUntil: "networkidle", timeout: 60000 });
    const afterReload = await proxyJson(page, "/estimates/" + estimateId);
    assertBusiness(
      entry,
      "accepted line survives reload",
      afterReload.ok && (afterReload.body?.lineItems?.length ?? 0) === persistedLineCount,
      "lineCount=" + (afterReload.body?.lineItems?.length ?? "unknown"),
    );
    await screenshot(page, entry, "persisted-after-reload");

    const descriptionAfterReload = page.getByLabel("Contractor job description");
    await descriptionAfterReload.fill(setupRequiredScope);
    await page.getByRole("button", { name: "Recalculate", exact: true }).click();
    await page.getByText("Estimate items", { exact: true }).waitFor();
    await page.waitForLoadState("networkidle");
    await resolveClarifications(page, entry, estimateId, persistedLineCount);

    const unresolvedReadyCount = await page.getByLabel("Include in estimate").count();
    const setupAddButton = page.getByRole("button", { name: "Add to estimate", exact: true });
    assertBusiness(
      entry,
      "unknown work remains setup-required and cannot silently apply",
      unresolvedReadyCount === 0 && !(await setupAddButton.isEnabled()),
      "resolved checkbox count=" + unresolvedReadyCount,
    );
    await screenshot(page, entry, "setup-required-unresolved-work");

    const foreignEstimate = process.env.BETA_RC_FOREIGN_ESTIMATE_ID?.trim();
    const foreignProject = process.env.BETA_RC_FOREIGN_PROJECT_ID?.trim();
    const foreignCustomer = process.env.BETA_RC_FOREIGN_CUSTOMER_ID?.trim();
    const foreignPath = foreignEstimate
      ? "/estimates/" + foreignEstimate
      : foreignProject
        ? "/projects/" + foreignProject
        : foreignCustomer
          ? "/customers/" + foreignCustomer
          : null;
    assertBusiness(entry, "foreign-resource fixture is configured", Boolean(foreignPath));
    const denied = await proxyJson(page, foreignPath);
    assertBusiness(
      entry,
      "cross-tenant direct-object request is denied",
      [403, 404].includes(denied.status),
      "status=" + denied.status,
    );
    entry.crossTenantDenial = {
      pathKind: foreignEstimate ? "estimate" : foreignProject ? "project" : "customer",
      status: denied.status,
    };

    assertBusiness(entry, "no uncaught browser console errors", entry.consoleErrors.length === 0, entry.consoleErrors.slice(0, 3).join(" | "));
    assertBusiness(entry, "no failed network requests", entry.failedRequests.length === 0, entry.failedRequests.slice(0, 3).join(" | "));
    entry.result = "PASS";
  } finally {
    await fs.writeFile(path.join(outDir, "report-" + viewport.name + ".json"), JSON.stringify(entry, null, 2));
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
let failure = null;
try {
  for (const viewport of viewports) {
    await exerciseViewport(browser, viewport);
  }
} catch (error) {
  failure = error;
  report.error = error instanceof Error ? error.message : String(error);
} finally {
  await browser.close();
  report.result =
    !failure &&
    report.viewports.length === viewports.length &&
    report.viewports.every((entry) => entry.result === "PASS")
      ? "PASS"
      : "FAIL";
  await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
}

if (failure) throw failure;
if (report.result !== "PASS") process.exitCode = 1;
