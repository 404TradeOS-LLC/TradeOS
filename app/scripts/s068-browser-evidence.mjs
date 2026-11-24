import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { VIEWPORTS, readPngDimensions } from "./beta-evidence/lib/evidence-artifacts.mjs";
import { assertApprovedRcUrl, assertNonProductionDataPlane } from "./beta-evidence/lib/rc-target.mjs";
import {
  APPROVED_EVENT_TYPE,
  REJECTED_EVENT_TYPE,
  ROLES_WITHOUT_BILLING_WRITE,
  WRONG_ROLE_BLOCKED,
  assertActivityEvent,
  assertChangeOrdersTab,
  assertDecisionHistory,
  assertPricing,
  createReportSkeleton,
  deploymentIdentityPath,
  expectedStatusForCase,
  redactBearerMaterial,
  validateEvidenceEnv,
} from "./s068-evidence-contract.mjs";

// S068 staff-side change-order browser evidence.
//
// Journey (see docs/testing/S068_CHANGE_ORDER_EVIDENCE.md):
//   Phase A — fixtures (API): synthetic customer + project in the TEST Org.
//   Phase B — draft + pricing (UI preferred, API fallback): create draft
//     change order CO-1, add a priced line item (2 x $150 = $300), verify
//     the line cost and the order amount agree.
//   Phase C — approval (UI preferred, API fallback): approve CO-1, verify
//     the Approval history line in the workspace, the API status +
//     approvedAt, and the attributable `change_order.approved` activity
//     record; capture the tab at 1440/1024/768/390.
//   Phase D — rejection (UI preferred, API fallback): create draft CO-2,
//     reject it, verify the rejection line, API status + rejectedAt, and
//     the `change_order.rejected` activity record; capture at all widths.
//   Phase E — negative security evidence (API probes): re-approve /
//     re-reject / edit an approved order (409), wrong-role create (403),
//     cross-tenant read + approve (404), unauthenticated read + approve
//     (401), unknown ids (404), and the absent portal decision endpoint
//     (405 — the portal proxy route exports only GET). Customer
//     approve/reject is BLOCKED by design (P1, ADR-010)
//     and is never attempted.
//
// Bearer-material discipline (hard requirements, not guidance):
// - The staff session lives in the Playwright storage state the workflow
//   creates under /tmp and deletes after the run. It is never written to
//   disk, logs, or report.json, and no console output ever contains one.
// - Error text is redacted before it is logged or recorded: Playwright
//   navigation errors embed the full request URL, so a failed goto would
//   otherwise leak session material into the workflow log and the retained
//   artifact (see redactBearerMaterial).
// - Trace, video, and HAR are OFF for every context (Playwright defaults).
// - Screenshots start only after the clean /projects/:id?tab=change-orders
//   URL loads. No URL in this journey carries bearer material.
// - The activity record is verified by attribute booleans only (event type
//   present, actor present, occurredAt present); the actor user id is never
//   recorded in report.json.
// - Fixtures are created at run time in the TEST Org (sanitized tenant)
//   through the shipped staff API via the authenticated browser context's
//   /api/proxy/* surface — the same surface the product's client components
//   use. Nothing is deleted: the synthetic customer, project, and change
//   orders remain in the sanitized tenant as evidence.
//
// Env: S068_BASE_URL, S068_EXPECTED_SHA, S068_SANITIZED_TENANT,
// S068_ALLOW_MUTATIONS, S068_STORAGE_STATE_PATH, S068_EVIDENCE_DIR,
// BETA_RC_SUPABASE_PROJECT_REF, BETA_SMOKE_ORG_ID, S068_USE_TEST_ORG
// (default "true"), S068_REQUIRE_SHA_CORRELATION (default "true"),
// BETA_FOREIGN_CHANGE_ORDER_ID (optional, cross-tenant probe),
// BETA_S068_WRONG_ROLE_EMAIL, BETA_S068_WRONG_ROLE_PASSWORD (both optional,
// only for the wrong-role N4 probe).

const config = validateEvidenceEnv(process.env);
const baseUrl = assertApprovedRcUrl(config.baseUrl).origin;
const expectedSupabaseRef = assertNonProductionDataPlane(config.supabaseRef);
const outDir = config.outDir;
const identity = JSON.parse(await fs.readFile(deploymentIdentityPath(outDir), "utf8"));
assert.equal(identity.supabaseProjectRef, expectedSupabaseRef, "Mutating evidence requires deployment-attested RC Supabase identity");
if (config.requireCorrelation) {
  assert.equal(identity.shaCorrelated, true, "SHA correlation is required for this run");
  assert.equal(identity.commitSha, config.expectedSha, "Deployment identity SHA does not match the expected SHA");
}
const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
const report = createReportSkeleton({
  baseUrl,
  runId,
  workflowSha: process.env.GITHUB_SHA ?? null,
  deployedSha: identity.commitSha,
  supabaseProjectRef: expectedSupabaseRef,
  tenantLabel: config.tenantLabel,
  orgId: config.orgId,
});
await fs.mkdir(outDir, { recursive: true });

function recordCase(caseId, outcome, detail) {
  const entry = { caseId, status: outcome, ...(detail ? { detail } : {}) };
  report.cases.push(entry);
  return entry;
}

function passCase(caseId, detail) {
  console.log(`PASS ${caseId}${detail ? ` ${detail}` : ""}`);
  return recordCase(caseId, "PASS", detail);
}

function failCase(caseId, error) {
  const detail = redactBearerMaterial(error.message);
  console.error(`FAIL ${caseId}: ${detail}`);
  return recordCase(caseId, "FAIL", detail);
}

async function writeReport() {
  await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
}

async function screenshot(page, name) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.waitForFunction(() => window.scrollY === 0);
  await page.addStyleTag({
    content: 'nav[aria-label="404TradeOS Control Dock"] { display: none !important; }',
  });
  const file = `${name}.png`;
  const buffer = await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  assert.equal(readPngDimensions(buffer)?.width, page.viewportSize().width, "Screenshot width must match viewport");
  return file;
}

async function metrics(page) {
  return page.evaluate(() => ({
    pathname: location.pathname,
    search: location.search,
    bodyText: document.body.innerText,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

async function waitForLoginReady(page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector(".entry-content");
      if (!el || el.hasAttribute("inert")) return false;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
      return window.__tradeosLoginFilmFinished === true;
    },
    undefined,
    { timeout: 30_000 },
  ).catch(async () => {
    // Reduced-motion sessions and deployments without the intro film have no
    // film transition to wait for; the form itself is the readiness signal.
    await page.locator('[name="email"]').waitFor({ state: "visible", timeout: 10_000 });
  });
}

const browser = await chromium.launch({ headless: true });

try {
  // ---- Staff context: fixtures + journey through the shipped staff API. ----
  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: config.storageState });
  const staffPage = await staffContext.newPage();
  staffPage.setDefaultTimeout(30_000);

  async function staffProxy(method, suffix, body, expectedStatus) {
    const response = await staffPage.request.fetch(new URL(`/api/proxy/${suffix}`, baseUrl).toString(), {
      method,
      // The shipped proxy rejects mutations with a missing or foreign
      // Origin before authentication (web/src/lib/proxy-origin.ts), and
      // Playwright API requests carry no Origin by default — send the
      // same-origin value explicitly so these calls exercise backend
      // behavior instead of the CSRF guard. Safe methods do not need it,
      // but sending it uniformly keeps every call on the same contract.
      headers: { Origin: baseUrl },
      ...(body === undefined ? {} : { data: body }),
    });
    assert.equal(response.status(), expectedStatus, `${method} /api/proxy/${suffix} returned ${response.status()} (expected ${expectedStatus})`);
    if (response.status() === 204) return null;
    return response.json();
  }

  const suffix = `s068-${runId}`;
  const customer = await staffProxy("POST", "customers", { name: `S068 Customer ${suffix}`, email: `s068-${suffix}@example.test` }, 201);
  const project = await staffProxy("POST", "projects", { customerId: customer.id, name: `S068 Project ${suffix}` }, 201);
  console.log("Fixtures created in the sanitized tenant (ids recorded in report.json)");

  const tabUrl = new URL(`/projects/${project.id}?tab=change-orders`, baseUrl).toString();

  async function gotoChangeOrdersTab() {
    const response = await staffPage.goto(tabUrl, { waitUntil: "networkidle", timeout: 60_000 });
    return response?.status() ?? 0;
  }

  async function getChangeOrder(changeOrderId) {
    return staffProxy("GET", `change-orders/${changeOrderId}`, undefined, 200);
  }

  async function listChangeOrdersByProject() {
    return staffProxy("GET", `change-orders/by-project/${project.id}`, undefined, 200);
  }

  async function createChangeOrderViaApi(description, scheduleImpactDays) {
    return staffProxy("POST", "change-orders", { projectId: project.id, description, scheduleImpactDays }, 201);
  }

  // Find-or-create: a UI step can succeed while its wait times out, so every
  // API fallback re-reads live state first and only creates what is missing.
  // A duplicate fixture would corrupt the pricing and coNumber assertions.
  async function findChangeOrderByDescription(description) {
    const orders = await listChangeOrdersByProject();
    return orders.find((order) => order.description === description) ?? null;
  }

  async function createChangeOrder(description, scheduleImpactDays, stepKey) {
    try {
      await gotoChangeOrdersTab();
      await staffPage.getByLabel("Description", { exact: true }).fill(description);
      await staffPage.getByLabel("Schedule impact").fill(String(scheduleImpactDays));
      await staffPage.getByRole("button", { name: "Create change order", exact: true }).click();
      await staffPage.getByText(description, { exact: false }).waitFor({ timeout: 30_000 });
      const created = await findChangeOrderByDescription(description);
      assert.ok(created, "UI-created change order must appear in the project list");
      assert.equal(created.status, "draft", "A new change order must start as a draft");
      report.stepPaths[stepKey] = "ui";
      return created;
    } catch (error) {
      console.error(`UI create unavailable, falling back to the authenticated API: ${redactBearerMaterial(error.message)}`);
      const existing = await findChangeOrderByDescription(description);
      if (existing) {
        assert.equal(existing.status, "draft", "A new change order must start as a draft");
        report.stepPaths[stepKey] = "ui";
        return existing;
      }
      const created = await createChangeOrderViaApi(description, scheduleImpactDays);
      assert.equal(created.status, "draft", "A new change order must start as a draft");
      report.stepPaths[stepKey] = "api";
      return created;
    }
  }

  async function decideChangeOrder(changeOrderId, decision, stepKey) {
    const buttonName = decision === "approved" ? "Approve" : "Reject";
    try {
      await gotoChangeOrdersTab();
      const buttons = staffPage.getByRole("button", { name: buttonName, exact: true });
      assert.equal(await buttons.count(), 1, `Exactly one ${buttonName} button must be present for the single draft change order`);
      await buttons.first().click();
      await staffPage.getByText(decision === "approved" ? /Approved / : /Rejected /).first().waitFor({ timeout: 30_000 });
      report.stepPaths[stepKey] = "ui";
    } catch (error) {
      console.error(`UI ${decision} unavailable, falling back to the authenticated API: ${redactBearerMaterial(error.message)}`);
      const current = await getChangeOrder(changeOrderId);
      if (current.status === decision) {
        report.stepPaths[stepKey] = "ui";
        return;
      }
      await staffProxy("POST", `change-orders/${changeOrderId}/${decision === "approved" ? "approve" : "reject"}`, {}, 200);
      report.stepPaths[stepKey] = "api";
    }
  }

  // ---- Phase B: draft CO-1 + priced line item (UI preferred, API fallback). ----
  const co1Description = `S068 synthetic scope change ${suffix}`;
  const changeOrder1 = await createChangeOrder(co1Description, 2, "create1");
  console.log(`PASS B1 change order CO-1 created through the staff ${report.stepPaths.create1 === "ui" ? "UI" : "API"}`);

  const lineDescription = `S068 synthetic line ${suffix}`;
  let lineItem;
  try {
    await gotoChangeOrdersTab();
    await staffPage.getByPlaceholder("Line item description").fill(lineDescription);
    await staffPage.getByPlaceholder("Qty").fill("2");
    await staffPage.getByPlaceholder("Unit cost").fill("150");
    await staffPage.getByRole("button", { name: "Add line", exact: true }).click();
    await staffPage.getByText(lineDescription, { exact: false }).waitFor({ timeout: 30_000 });
    const refreshed = await getChangeOrder(changeOrder1.id);
    lineItem = (refreshed.lineItems ?? []).find((item) => item.description === lineDescription);
    assert.ok(lineItem, "UI-added line item must appear on the change order");
    assertPricing({ quantity: lineItem.quantity, unitCost: lineItem.unitCost, lineCost: lineItem.lineCost, amount: refreshed.amount });
    report.stepPaths.lineItem = "ui";
    console.log("PASS B2 line item added through the staff UI (2 x $150 = $300)");
  } catch (error) {
    console.error(`UI line-item add unavailable, falling back to the authenticated API: ${redactBearerMaterial(error.message)}`);
    const refreshedFirst = await getChangeOrder(changeOrder1.id);
    lineItem = (refreshedFirst.lineItems ?? []).find((item) => item.description === lineDescription);
    if (!lineItem) {
      lineItem = await staffProxy("POST", `change-orders/${changeOrder1.id}/line-items`, { description: lineDescription, quantity: 2, unitCost: 150 }, 201);
      report.stepPaths.lineItem = "api";
    } else {
      report.stepPaths.lineItem = "ui";
    }
    const refreshed = await getChangeOrder(changeOrder1.id);
    assertPricing({ quantity: lineItem.quantity, unitCost: lineItem.unitCost, lineCost: lineItem.lineCost, amount: refreshed.amount });
  }
  report.pricing = {
    changeOrderId: changeOrder1.id,
    lineItem: { quantity: lineItem.quantity, unitCost: lineItem.unitCost, lineCost: lineItem.lineCost },
    amount: lineItem.lineCost,
  };

  // Draft capture at desktop width: create form + draft card + line item.
  try {
    const status = await gotoChangeOrdersTab();
    const state = await metrics(staffPage);
    assertChangeOrdersTab({ ...state, projectId: project.id, status, markers: ["Change Orders", "CO-1", lineDescription] });
    await screenshot(staffPage, "change-order-draft-1440");
    passCase("B3", "draft change order with priced line item renders on the workspace");
  } catch (error) {
    failCase("B3", error);
  }
  await writeReport();

  // ---- Phase C: approve CO-1 (UI preferred, API fallback). ----
  async function verifyDecision(changeOrderId, decision, eventType) {
    const decided = await getChangeOrder(changeOrderId);
    assert.equal(decided.status, decision, `Change order must report status ${decision}`);
    if (decision === "approved") {
      assert.ok(decided.approvedAt, "Approved change order must carry approvedAt");
      assert.equal(decided.rejectedAt, null, "Approved change order must not carry rejectedAt");
    } else {
      assert.ok(decided.rejectedAt, "Rejected change order must carry rejectedAt");
      assert.equal(decided.approvedAt, null, "Rejected change order must not carry approvedAt");
    }
    // Activity lookup by entityId only: the `entityType=change_order` list
    // filter is not registered in intelligenceEntityTypes (answers 400), so
    // the script does not depend on it. The query without entityType
    // requires crm.read, which the staff owner holds.
    let events;
    try {
      events = await staffProxy(
        "GET",
        `intelligence/activity?entityId=${changeOrderId}&limit=10`,
        undefined,
        200,
      );
    } catch (error) {
      throw new Error(
        `Activity lookup failed for the ${decision} decision: ${redactBearerMaterial(error.message)} (the change_order.approved/rejected ActivityEvent is written by the S068 backend lane)`,
      );
    }
    const event = assertActivityEvent({ events, eventType, changeOrderId });
    return { decided, activity: { eventType: event.eventType, actorPresent: true, occurredAtPresent: true } };
  }

  try {
    await decideChangeOrder(changeOrder1.id, "approved", "approve1");
    const status = await gotoChangeOrdersTab();
    const state = await metrics(staffPage);
    assertChangeOrdersTab({ ...state, projectId: project.id, status, markers: ["Change Orders", "CO-1"] });
    assertDecisionHistory({ bodyText: state.bodyText, decision: "approved" });
    const { activity } = await verifyDecision(changeOrder1.id, "approved", APPROVED_EVENT_TYPE);
    report.activity = { approved: activity };
    passCase("C1", "CO-1 approved: history line, API status + approvedAt, and change_order.approved activity record");
  } catch (error) {
    failCase("C1", error);
  }
  await writeReport();

  // Approved captures at 1440/1024/768/390.
  for (const viewport of VIEWPORTS) {
    const viewportEntry = { viewport: viewport.name, pages: [], passed: false };
    report.viewports.push(viewportEntry);
    const entry = { slug: "change-order-approved", path: `/projects/${project.id}?tab=change-orders`, viewport: viewport.name, passed: false };
    viewportEntry.pages.push(entry);
    try {
      await staffPage.setViewportSize({ width: viewport.width, height: viewport.height });
      const status = await gotoChangeOrdersTab();
      const state = await metrics(staffPage);
      assertChangeOrdersTab({ ...state, projectId: project.id, status, markers: ["Change Orders", "CO-1", "Approved "] });
      entry.dimensions = { scrollWidth: state.scrollWidth, clientWidth: state.clientWidth };
      entry.screenshot = await screenshot(staffPage, `change-order-approved-${viewport.name}`);
      entry.passed = true;
    } catch (error) {
      entry.error = redactBearerMaterial(error.message);
      report.failures = [...(report.failures ?? []), { slug: "change-order-approved", viewport: viewport.name, error: redactBearerMaterial(error.message) }];
      console.error(`FAIL change-order-approved ${viewport.name}px: ${redactBearerMaterial(error.message)}`);
    } finally {
      await writeReport();
    }
    viewportEntry.passed = viewportEntry.pages.every((pageEntry) => pageEntry.passed);
  }
  await staffPage.setViewportSize({ width: 1440, height: 1000 });

  // ---- Phase D: draft CO-2, wrong-role probe, then rejection. ----
  const co2Description = `S068 synthetic rejection target ${suffix}`;
  const changeOrder2 = await createChangeOrder(co2Description, 0, "create2");
  console.log(`PASS D1 change order CO-2 created through the staff ${report.stepPaths.create2 === "ui" ? "UI" : "API"}`);

  // N4 wrong-role: only exercisable when a low-permission staff identity is
  // provisioned. The principal's TEST Org role is verified BEFORE the
  // mutation via GET /api/proxy/auth/memberships: only technician/viewer
  // lack billing.write (app/domain/contracts.ts rolePermissions). A 201
  // from a confirmed low-permission principal is an authorization
  // regression and FAILs; a role that holds billing.write records
  // NOT-APPLICABLE without attempting the mutation. Without a provisioned
  // identity the case is BLOCKED, never invented.
  const wrongRoleEmail = config.wrongRoleEmail;
  const wrongRolePassword = config.wrongRolePassword;
  if (wrongRoleEmail && wrongRolePassword) {
    try {
      const wrongRoleContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
      const wrongRolePage = await wrongRoleContext.newPage();
      await wrongRolePage.addInitScript(() => {
        const noteIntroState = () => {
          const entry = document.querySelector(".entry-content");
          if (!entry) return;
          if (entry.hasAttribute("inert")) window.__tradeosLoginFilmSeen = true;
          else if (window.__tradeosLoginFilmSeen === true) window.__tradeosLoginFilmFinished = true;
        };
        new MutationObserver(noteIntroState).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert"] });
        noteIntroState();
      });
      await wrongRolePage.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
      await waitForLoginReady(wrongRolePage);
      await wrongRolePage.locator('[name="email"]').fill(wrongRoleEmail);
      await wrongRolePage.locator('[name="password"]').fill(wrongRolePassword);
      await wrongRolePage.getByRole("button", { name: "Sign in" }).click();
      await wrongRolePage.waitForURL(/\/(dashboard|finish-setup)(?:\?|$)/, { timeout: 60_000 });
      const targetOrgId = config.orgId;
      assert.ok(targetOrgId, "Cannot verify the wrong-role principal without the smoke org id (BETA_SMOKE_ORG_ID)");
      const membershipsResponse = await wrongRolePage.request.get(new URL("/api/proxy/auth/memberships", baseUrl).toString());
      assert.equal(membershipsResponse.status(), 200, `Wrong-role memberships lookup returned ${membershipsResponse.status()} (expected 200)`);
      const memberships = await membershipsResponse.json();
      assert.ok(Array.isArray(memberships), "Memberships lookup did not return an array");
      const membership = memberships.find((entry) => entry.orgId === targetOrgId);
      assert.ok(membership, "Wrong-role identity has no membership in the TEST Org");
      if (!ROLES_WITHOUT_BILLING_WRITE.includes(membership.role)) {
        recordCase("N4", "NOT-APPLICABLE", `The provisioned identity holds role ${membership.role}, which has billing.write; no low-permission identity is provisioned`);
        console.log(`NOT-APPLICABLE N4: provisioned identity holds role ${membership.role}; mutation not attempted`);
      } else {
        const wrongRoleResponse = await wrongRolePage.request.post(new URL("/api/proxy/change-orders", baseUrl).toString(), {
          headers: { Origin: baseUrl },
          data: { projectId: project.id, description: `S068 wrong-role probe ${suffix}`, scheduleImpactDays: 0 },
        });
        if (wrongRoleResponse.status() === 403) {
          passCase("N4", "staff without billing.write denied change-order create (403)");
        } else if (wrongRoleResponse.status() === 201) {
          const created = await wrongRoleResponse.json();
          await staffProxy("DELETE", `change-orders/${created.id}`, undefined, 204);
          throw new Error(`Confirmed low-permission principal (role ${membership.role}) created a change order (201) — authorization regression; probe draft deleted`);
        } else {
          throw new Error(`Wrong-role create returned ${wrongRoleResponse.status()} (expected 403)`);
        }
      }
      await wrongRoleContext.close();
    } catch (error) {
      failCase("N4", error);
    }
  } else {
    report.blocked.push({ ...WRONG_ROLE_BLOCKED, status: "BLOCKED" });
    console.log("BLOCKED N4: no low-permission staff identity provisioned");
  }
  await writeReport();

  try {
    await decideChangeOrder(changeOrder2.id, "rejected", "reject2");
    const status = await gotoChangeOrdersTab();
    const state = await metrics(staffPage);
    assertChangeOrdersTab({ ...state, projectId: project.id, status, markers: ["Change Orders", "CO-2"] });
    assertDecisionHistory({ bodyText: state.bodyText, decision: "rejected" });
    const { activity } = await verifyDecision(changeOrder2.id, "rejected", REJECTED_EVENT_TYPE);
    report.activity = { ...(report.activity ?? {}), rejected: activity };
    passCase("D2", "CO-2 rejected: history line, API status + rejectedAt, and change_order.rejected activity record");
  } catch (error) {
    failCase("D2", error);
  }
  await writeReport();

  // Rejected captures at 1440/1024/768/390.
  for (const viewport of VIEWPORTS) {
    const viewportEntry = { viewport: viewport.name, pages: [], passed: false };
    report.viewports.push(viewportEntry);
    const entry = { slug: "change-order-rejected", path: `/projects/${project.id}?tab=change-orders`, viewport: viewport.name, passed: false };
    viewportEntry.pages.push(entry);
    try {
      await staffPage.setViewportSize({ width: viewport.width, height: viewport.height });
      const status = await gotoChangeOrdersTab();
      const state = await metrics(staffPage);
      assertChangeOrdersTab({ ...state, projectId: project.id, status, markers: ["Change Orders", "CO-2", "Rejected "] });
      entry.dimensions = { scrollWidth: state.scrollWidth, clientWidth: state.clientWidth };
      entry.screenshot = await screenshot(staffPage, `change-order-rejected-${viewport.name}`);
      entry.passed = true;
    } catch (error) {
      entry.error = redactBearerMaterial(error.message);
      report.failures = [...(report.failures ?? []), { slug: "change-order-rejected", viewport: viewport.name, error: redactBearerMaterial(error.message) }];
      console.error(`FAIL change-order-rejected ${viewport.name}px: ${redactBearerMaterial(error.message)}`);
    } finally {
      await writeReport();
    }
    viewportEntry.passed = viewportEntry.pages.every((pageEntry) => pageEntry.passed);
  }
  await staffPage.setViewportSize({ width: 1440, height: 1000 });

  report.fixtures = {
    customer: customer.id,
    project: project.id,
    changeOrderApproved: changeOrder1.id,
    changeOrderRejected: changeOrder2.id,
  };
  report.cleanupNotes = [
    "Fixtures remain in the sanitized tenant by design (synthetic customer, project, and change orders); nothing is deleted.",
  ];
  await writeReport();

  // ---- Phase E: negative security evidence. ----
  async function staffApiProbe(method, suffixPath, body, expectedStatus, label) {
    const response = await staffPage.request.fetch(new URL(`/api/proxy/${suffixPath}`, baseUrl).toString(), {
      method,
      // Same-origin value: the shipped proxy rejects origin-less
      // mutations with 403 before authentication (web/src/lib/proxy-origin.ts),
      // and Playwright API requests carry no Origin by default — without
      // this the probes record 403 instead of the backend's 409/404. The
      // N6 anonymous probe already carries this header for the same reason.
      headers: { Origin: baseUrl },
      ...(body === undefined ? {} : { data: body }),
    });
    assert.equal(response.status(), expectedStatus, `${label} returned ${response.status()} (expected ${expectedStatus})`);
    return response;
  }

  // N1/N2/N3: the approved order's transitions are closed (409).
  try {
    await staffApiProbe("POST", `change-orders/${changeOrder1.id}/approve`, {}, expectedStatusForCase("N1"), "Re-approve approved order");
    passCase("N1", "approving an approved change order denied (409)");
  } catch (error) {
    failCase("N1", error);
  }
  try {
    await staffApiProbe("POST", `change-orders/${changeOrder1.id}/reject`, {}, expectedStatusForCase("N2"), "Reject approved order");
    passCase("N2", "rejecting an approved change order denied (409)");
  } catch (error) {
    failCase("N2", error);
  }
  try {
    await staffApiProbe(
      "POST",
      `change-orders/${changeOrder1.id}/line-items`,
      { description: "S068 late line", quantity: 1, unitCost: 10 },
      expectedStatusForCase("N3"),
      "Add line item to approved order",
    );
    passCase("N3", "adding a line item to an approved change order denied (409)");
  } catch (error) {
    failCase("N3", error);
  }

  // N5 cross-tenant: a change order from another org must read as missing.
  const foreignChangeOrderId = config.foreignChangeOrderId;
  if (foreignChangeOrderId) {
    try {
      await staffApiProbe("GET", `change-orders/${foreignChangeOrderId}`, undefined, expectedStatusForCase("N5"), "Cross-tenant change-order read");
      await staffApiProbe("POST", `change-orders/${foreignChangeOrderId}/approve`, {}, expectedStatusForCase("N5"), "Cross-tenant change-order approve");
      passCase("N5", "foreign change order reads and decides as missing (404)");
    } catch (error) {
      failCase("N5", error);
    }
  } else {
    recordCase("N5", "NOT-APPLICABLE", "BETA_FOREIGN_CHANGE_ORDER_ID is not provisioned");
    console.log("NOT-APPLICABLE N5: no foreign change order id provisioned");
  }

  // N6 unauthenticated: no session must read or decide.
  try {
    const anonContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    const anonRead = await anonContext.request.get(`/api/proxy/change-orders/${changeOrder1.id}`);
    assert.equal(anonRead.status(), expectedStatusForCase("N6"), `Unauthenticated read returned ${anonRead.status()} (expected 401)`);
    const anonApprove = await anonContext.request.post(`/api/proxy/change-orders/${changeOrder1.id}/approve`, {
      // Same-origin value: the proxy rejects origin-less mutations (403)
      // before authentication, so an anonymous probe without it would
      // record 403 instead of the 401 the case is meant to prove.
      headers: { Origin: baseUrl },
      data: {},
    });
    assert.equal(anonApprove.status(), expectedStatusForCase("N6"), `Unauthenticated approve returned ${anonApprove.status()} (expected 401)`);
    await anonContext.close();
    passCase("N6", "unauthenticated change-order read and approve denied (401)");
  } catch (error) {
    failCase("N6", error);
  }

  // N7/N8: unknown ids read as missing, never as server errors.
  try {
    await staffApiProbe("POST", `change-orders/${randomUUID()}/approve`, {}, expectedStatusForCase("N7"), "Approve unknown change order");
    passCase("N7", "approving an unknown change order denied (404)");
  } catch (error) {
    failCase("N7", error);
  }
  try {
    await staffApiProbe(
      "POST",
      "change-orders",
      { projectId: randomUUID(), description: `S068 unknown project ${suffix}`, scheduleImpactDays: 0 },
      expectedStatusForCase("N8"),
      "Create for unknown project",
    );
    passCase("N8", "creating a change order for an unknown project denied (404)");
  } catch (error) {
    failCase("N8", error);
  }

  // N9: the customer portal exposes no change-order decision endpoint, and
  // its project read carries no change orders (service returns
  // changeOrders: []). An anonymous decision POST must 405: the portal
  // proxy route exports only GET, so Next.js rejects the POST before any
  // handler runs — that is the shipped proof that no decision action
  // exists on the portal surface. An anonymous portal project read must
  // 401 (portal session required).
  try {
    const anonContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    const portalApprove = await anonContext.request.post(`/api/customer-portal/change-orders/${changeOrder1.id}/approve`, {
      headers: { Origin: baseUrl },
      data: {},
    });
    assert.equal(portalApprove.status(), expectedStatusForCase("N9"), `Portal decision POST returned ${portalApprove.status()} (expected 405)`);
    const portalProject = await anonContext.request.get(`/api/customer-portal/projects/${project.id}`);
    assert.equal(portalProject.status(), 401, `Unauthenticated portal project read returned ${portalProject.status()} (expected 401)`);
    await anonContext.close();
    passCase("N9", "portal change-order decision POST rejected (405 — route exports only GET); portal project read requires a session (401)");
  } catch (error) {
    failCase("N9", error);
  }

  report.credentialScan = { performedBy: "workflow", result: "pending" };
  await staffContext.close();
} catch (error) {
  // A fatal failure must not skip the report: record it sanitized and let
  // the report-writing code below still run, so the artifact carries the
  // failure instead of nothing.
  const detail = redactBearerMaterial(error.message);
  console.error(`FATAL: ${detail}`);
  recordCase("FATAL", "FAIL", detail);
} finally {
  await browser.close();
}

const failedViewports = report.viewports.filter((entry) => !entry.passed);
const failedCases = report.cases.filter((entry) => entry.status === "FAIL");
report.result =
  failedViewports.length === 0 && failedCases.length === 0 && !report.cleanupFailures ? "PASS" : "FAIL";
await writeReport();
console.log(`S068 browser evidence ${report.result}: ${report.viewports.length} viewports, ${report.cases.length} cases, ${report.blocked.length} blocked`);
if (report.result !== "PASS") process.exitCode = 1;
