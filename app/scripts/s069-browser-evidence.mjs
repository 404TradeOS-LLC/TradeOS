import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { VIEWPORTS, readPngDimensions } from "./beta-evidence/lib/evidence-artifacts.mjs";
import { assertApprovedRcUrl, assertNonProductionDataPlane } from "./beta-evidence/lib/rc-target.mjs";
import {
  CLOSEOUT_CREATED_EVENT_TYPE,
  CLOSEOUT_HANDED_OFF_EVENT_TYPE,
  CLOSEOUT_READY_EVENT_TYPE,
  PUNCH_CREATED_EVENT_TYPE,
  PUNCH_RESOLVED_EVENT_TYPE,
  PUNCH_VERIFIED_EVENT_TYPE,
  ROLES_WITHOUT_CRM_WRITE,
  TECHNICIAN_MEMBER_REQUIRED,
  WARRANTY_CREATED_EVENT_TYPE,
  WRONG_ROLE_BLOCKED,
  assertActivityEvent,
  assertChecklist,
  assertCloseoutDocument,
  assertCloseoutStatus,
  assertCloseoutTab,
  assertPortalHandoff,
  createReportSkeleton,
  deploymentIdentityPath,
  expectedStatusForCase,
  redactBearerMaterial,
  unblockCase,
  validateEvidenceEnv,
} from "./s069-evidence-contract.mjs";

// S069 staff-side closeout and warranty browser evidence.
//
// Journey (see docs/testing/S069_CLOSEOUT_WARRANTY_EVIDENCE.md):
//   Phase A — prerequisites (API): synthetic customer + service address +
//     project in the TEST Org; proposal created + accepted offline;
//     contract created + signed; invoice created + sent; job created with
//     the provisioned technician assigned, then dispatch -> start-travel
//     -> arrive -> complete as the staff owner.
//   Phase B — closeout (UI preferred, API fallback): create the closeout,
//     verify the draft checklist; negative probes N2 (handoff from draft)
//     and N5 (second closeout) both 409.
//   Phase C — punch + warranty (UI preferred, API fallback): create a
//     punch item assigned to the technician; N3 (verify an open punch)
//     409; resolve as the assigned technician when a technician sign-in
//     is provisioned (P1 BLOCKED otherwise, owner resolve is the
//     certified path); verify as staff; N4 (resolve a verified punch)
//     409; record a warranty with the staff-supplied coverage text.
//   Phase D — ready (UI preferred, API fallback): mark ready, verify the
//     checklist verdict, the API status + completedAt, and the
//     attributable `project_closeout.ready` activity record; capture the
//     tab at 1440/1024/768/390.
//   Phase E — handoff (UI preferred, API fallback): record handoff,
//     verify the API status + handedOffAt and the
//     `project_closeout.handed_off` record; capture at all widths.
//   Phase F — portal (read-only): staff issues a single-use portal access
//     token (memory only), the customer redeems it in a fresh browser
//     context, and the portal project page shows the same handoff
//     read-only with the rendered closeout document; capture at all
//     widths.
//   Phase G — negative security evidence (API probes): mark-ready on a
//     handed-off closeout (409), wrong-role create (403), cross-tenant
//     read (404), unauthenticated read + create (401), unknown ids (404),
//     and the absent portal document mutation endpoint (405 — the portal
//     proxy route exports only GET).
//
// Bearer-material discipline (hard requirements, not guidance):
// - The staff session lives in the Playwright storage state the workflow
//   creates under /tmp and deletes after the run. It is never written to
//   disk, logs, or report.json, and no console output ever contains one.
// - The single-use portal access token lives only in a process-memory
//   variable until redemption consumes it. It is never logged, never
//   written to report.json, and any error text carrying the
//   /customer-portal/access URL is redacted before logging (see
//   redactBearerMaterial).
// - Error text is redacted before it is logged or recorded: Playwright
//   navigation errors embed the full request URL, so a failed goto would
//   otherwise leak session material into the workflow log and the retained
//   artifact.
// - Trace, video, and HAR are OFF for every context (Playwright defaults).
// - Screenshots start only after a clean URL loads — the staff workspace
//   URL and the portal project URL carry no bearer material. The
//   /customer-portal/access?token= URL is never screenshotted.
// - The activity record is verified by attribute booleans only (event type
//   present, actor present, occurredAt present); the actor user id is never
//   recorded in report.json.
// - Fixtures are created at run time in the TEST Org (sanitized tenant)
//   through the shipped staff API via the authenticated browser context's
//   /api/proxy/* surface — the same surface the product's client components
//   use. Nothing is deleted: the synthetic customer, project, proposal,
//   contract, invoice, job, closeout, punch item, and warranty remain in
//   the sanitized tenant as evidence.
//
// Env: S069_BASE_URL, S069_EXPECTED_SHA, S069_SANITIZED_TENANT,
// S069_ALLOW_MUTATIONS, S069_STORAGE_STATE_PATH, S069_EVIDENCE_DIR,
// BETA_RC_SUPABASE_PROJECT_REF, BETA_SMOKE_ORG_ID, S069_USE_TEST_ORG
// (default "true"), S069_REQUIRE_SHA_CORRELATION (default "true"),
// BETA_FOREIGN_PROJECT_ID (optional, cross-tenant probe),
// BETA_S069_WRONG_ROLE_EMAIL, BETA_S069_WRONG_ROLE_PASSWORD (both optional,
// only for the technician-session resolve P1 and the wrong-role N6 probe).

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

// Every capture site in this script sits AFTER the marker assert, so a
// failed assert skips the screenshot entirely (run 45553851005 produced
// zero PNGs). Capture best-effort BEFORE the assert and never let a
// capture failure mask the real failure.
async function screenshotBestEffort(page, name) {
  try {
    return await screenshot(page, name);
  } catch (error) {
    console.error(`Screenshot ${name} failed (continuing): ${redactBearerMaterial(error.message)}`);
    return null;
  }
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

// Shared across phases: the technician browser context (created in Phase C
// when a technician sign-in is provisioned, reused by the N6 probe) and
// the provisioned low-permission identity. Declared here — not inside a
// phase block — so every phase and the final cleanup can reach them.
const wrongRoleEmail = config.wrongRoleEmail;
const wrongRolePassword = config.wrongRolePassword;
let technicianContext = null;

async function loginAsWrongRole() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const noteIntroState = () => {
      const entry = document.querySelector(".entry-content");
      if (!entry) return;
      if (entry.hasAttribute("inert")) window.__tradeosLoginFilmSeen = true;
      else if (window.__tradeosLoginFilmSeen === true) window.__tradeosLoginFilmFinished = true;
    };
    new MutationObserver(noteIntroState).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert"] });
    noteIntroState();
  });
  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
  await waitForLoginReady(page);
  await page.locator('[name="email"]').fill(wrongRoleEmail);
  await page.locator('[name="password"]').fill(wrongRolePassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|finish-setup)(?:\?|$)/, { timeout: 60_000 });
  return { context, page };
}

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

  async function staffProxyRaw(method, suffix, body, expectedStatus) {
    const response = await staffPage.request.fetch(new URL(`/api/proxy/${suffix}`, baseUrl).toString(), {
      method,
      headers: { Origin: baseUrl },
      ...(body === undefined ? {} : { data: body }),
    });
    const text = await response.text();
    // A bare status mismatch hides the mechanism (run 45553851005: E2's
    // 500 arrived with no body anywhere in the log). Attach the truncated,
    // bearer-redacted body so the next failure names its cause.
    assert.equal(
      response.status(),
      expectedStatus,
      `${method} /api/proxy/${suffix} returned ${response.status()} (expected ${expectedStatus})${response.status() !== expectedStatus && text ? ` — body: ${redactBearerMaterial(text.slice(0, 500))}` : ""}`,
    );
    return { status: response.status(), text, contentType: response.headers()["content-type"] ?? "" };
  }

  const suffix = `s069-${runId}`;

  // ---- Phase A: ready-checklist prerequisites + completed job (API). ----
  const customer = await staffProxy("POST", "customers", { name: `S069 Customer ${suffix}`, email: `s069-${suffix}@example.test` }, 201);
  const serviceAddress = await staffProxy("POST", `customers/${customer.id}/service-addresses`, {
    addressLine1: "1 S069 Way",
    city: "Terre Haute",
    state: "IN",
    postalCode: "47802",
  }, 201);
  const project = await staffProxy("POST", "projects", { customerId: customer.id, name: `S069 Project ${suffix}` }, 201);
  console.log("Fixtures created in the sanitized tenant (ids recorded in report.json)");

  const proposal = await staffProxy("POST", "proposals", {
    projectId: project.id,
    scopeOfWork: `S069 synthetic scope ${suffix}`,
    priceLow: 2300,
    priceHigh: 2600,
    finalPrice: 2450,
  }, 201);
  const acceptedProposal = await staffProxy("POST", `proposals/${proposal.id}/accept-offline`, {
    channel: "in_person",
    note: `S069 synthetic customer acceptance ${suffix}`,
    confirmed: true,
  }, 200);
  assert.equal(acceptedProposal.status, "accepted", "Proposal must be accepted before a contract can be created");

  const contract = await staffProxy("POST", "contracts", { proposalId: proposal.id }, 201);
  const signedContract = await staffProxy("POST", `contracts/${contract.id}/sign`, { signerName: `S069 Customer ${suffix}` }, 200);
  assert.ok(signedContract.signedAt, "Signed contract must carry signedAt");

  const invoice = await staffProxy("POST", "invoices", {
    projectId: project.id,
    proposalId: proposal.id,
    lineItems: [{ description: `S069 synthetic work ${suffix}`, quantity: 1, unitOfMeasure: "job", unitPrice: 2450 }],
  }, 201);
  const sentInvoice = await staffProxy("POST", `invoices/${invoice.id}/send`, {}, 200);
  assert.equal(sentInvoice.status, "sent", "Invoice must be sent (non-draft) for the closeout checklist");

  // Dispatch requires an active technician assignment, so the journey
  // cannot start without an active technician member in the TEST Org.
  // Prefer the provisioned wrong-role identity's member when it matches,
  // so the same identity can drive the technician-session resolve (P1).
  const targetOrgId = config.orgId;
  assert.ok(targetOrgId, "Cannot discover the technician member without the smoke org id (BETA_SMOKE_ORG_ID)");
  const members = await staffProxy("GET", `admin/organizations/${targetOrgId}/members`, undefined, 200);
  assert.ok(Array.isArray(members), "Members lookup did not return an array");
  const activeTechnicians = members.filter((entry) => entry.role === "technician" && entry.status === "active");
  if (activeTechnicians.length === 0) {
    throw new Error(`${TECHNICIAN_MEMBER_REQUIRED.step}: ${TECHNICIAN_MEMBER_REQUIRED.reason}`);
  }
  const technicianMember =
    activeTechnicians.find((entry) => config.wrongRoleEmail && entry.email === config.wrongRoleEmail) ?? activeTechnicians[0];
  const technicianUserId = technicianMember.userId;
  assert.ok(technicianUserId, "Active technician member has no userId");

  const scheduledStart = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const scheduledEnd = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const job = await staffProxy("POST", "jobs", {
    projectId: project.id,
    customerId: customer.id,
    serviceAddressId: serviceAddress.id,
    title: `S069 job ${suffix}`,
    jobType: "General Contracting",
    scheduledStart,
    scheduledEnd,
    technicianIds: [technicianUserId],
  }, 201);
  assert.equal(job.status, "scheduled", "A job with a scheduled window must start as scheduled");
  for (const transition of ["dispatch", "start-travel", "arrive", "complete"]) {
    const transitioned = await staffProxy("POST", `jobs/${job.id}/${transition}`, {}, 200);
    console.log(`Job ${transition}: status ${transitioned.status}`);
  }
  const completedJob = await staffProxy("GET", `jobs/${job.id}`, undefined, 200);
  assert.equal(completedJob.status, "completed", "Job must be completed before a closeout can start");
  assert.ok(completedJob.completedAt, "Completed job must carry completedAt");
  console.log("PASS A completed job in the sanitized tenant with the ready-checklist prerequisites");

  const tabUrl = new URL(`/projects/${project.id}?tab=closeout`, baseUrl).toString();

  async function gotoCloseoutTab() {
    const response = await staffPage.goto(tabUrl, { waitUntil: "networkidle", timeout: 60_000 });
    return response?.status() ?? 0;
  }

  async function getCloseout() {
    return staffProxy("GET", `closeout/projects/${project.id}/closeout`, undefined, 200);
  }

  async function listPunchItems() {
    return staffProxy("GET", `closeout/projects/${project.id}/punch-items`, undefined, 200);
  }

  async function getPunchItem(punchItemId) {
    return staffProxy("GET", `closeout/punch-items/${punchItemId}`, undefined, 200);
  }

  async function verifyActivity(entityId, eventType) {
    // Activity lookup by entityId only: the query without entityType
    // requires crm.read, which the staff owner holds.
    let events;
    try {
      events = await staffProxy(
        "GET",
        `intelligence/activity?entityId=${entityId}&limit=10`,
        undefined,
        200,
      );
    } catch (error) {
      throw new Error(
        `Activity lookup failed for ${eventType}: ${redactBearerMaterial(error.message)} (the closeout ActivityEvent is written by the S069 backend lane)`,
      );
    }
    const event = assertActivityEvent({ events, eventType, entityId });
    return { eventType: event.eventType, actorPresent: true, occurredAtPresent: true };
  }

  // ---- Phase B: create the closeout (UI preferred, API fallback). ----
  let closeout;
  try {
    await gotoCloseoutTab();
    await staffPage.getByRole("button", { name: "Start closeout", exact: true }).click();
    await staffPage.getByText("Closeout status").waitFor({ timeout: 30_000 });
    closeout = (await getCloseout()).closeout;
    assert.equal(closeout.status, "draft", "A new closeout must start as a draft");
    report.stepPaths.createCloseout = "ui";
  } catch (error) {
    console.error(`UI closeout create unavailable, falling back to the authenticated API: ${redactBearerMaterial(error.message)}`);
    try {
      closeout = (await getCloseout()).closeout;
      assert.equal(closeout.status, "draft", "A new closeout must start as a draft");
      report.stepPaths.createCloseout = "ui";
    } catch {
      closeout = await staffProxy("POST", `closeout/projects/${project.id}/closeout`, {}, 201);
      assert.equal(closeout.status, "draft", "A new closeout must start as a draft");
      report.stepPaths.createCloseout = "api";
    }
  }
  console.log(`PASS B1 closeout created through the staff ${report.stepPaths.createCloseout === "ui" ? "UI" : "API"}`);

  // Draft capture at desktop width: status card + checklist + punch list.
  try {
    const status = await gotoCloseoutTab();
    const state = await metrics(staffPage);
    // Capture BEFORE the marker assert: on a failed assert the screenshot
    // below would never run (run 45553851005 produced zero PNGs). The
    // file lands in outDir and is uploaded with the artifact either way.
    await screenshotBestEffort(staffPage, "closeout-draft-1440");
    assertCloseoutTab({ ...state, projectId: project.id, status, markers: ["Closeout and warranty", "Closeout status", "Punch list", "Warranties"] });
    assertCloseoutStatus({ bodyText: state.bodyText, status: "draft" });
    // The checklist is already ready here: every prerequisite is present
    // and no punch item is open yet — the closeout itself is still draft.
    assertChecklist({ bodyText: state.bodyText, ready: true });
    passCase("B2", "draft closeout with the ready checklist renders on the workspace");
  } catch (error) {
    failCase("B2", error);
  }
  await writeReport();

  // N2/N5: the draft closeout's transitions are closed (409).
  try {
    await staffProxy("POST", `closeout/projects/${project.id}/closeout/handoff`, {}, expectedStatusForCase("N2"));
    passCase("N2", "handing off a draft closeout denied (409)");
  } catch (error) {
    failCase("N2", error);
  }
  try {
    await staffProxy("POST", `closeout/projects/${project.id}/closeout`, {}, expectedStatusForCase("N5"));
    passCase("N5", "creating a second closeout for the same project denied (409)");
  } catch (error) {
    failCase("N5", error);
  }

  // ---- Phase C: punch item + warranty (UI preferred, API fallback). ----
  const punchTitle = `Touch up paint at entry trim ${suffix}`;
  const punchDescription = "Scuff on the entry trim, north side.";
  let punch;
  try {
    await gotoCloseoutTab();
    await staffPage.getByPlaceholder("Touch up paint at entry trim").fill(punchTitle);
    await staffPage.getByPlaceholder("What needs to be done, and where").fill(punchDescription);
    const assignee = staffPage.getByLabel("Assignee");
    if (await assignee.count()) await assignee.selectOption(technicianUserId);
    await staffPage.getByRole("button", { name: "Add punch item", exact: true }).click();
    await staffPage.getByText(punchTitle, { exact: false }).waitFor({ timeout: 30_000 });
    const items = await listPunchItems();
    punch = items.find((item) => item.title === punchTitle);
    assert.ok(punch, "UI-created punch item must appear in the project list");
    assert.equal(punch.status, "open", "A new punch item must start as open");
    assert.equal(punch.assignedUserId, technicianUserId, "Punch item must be assigned to the technician");
    report.stepPaths.createPunch = "ui";
  } catch (error) {
    console.error(`UI punch create unavailable, falling back to the authenticated API: ${redactBearerMaterial(error.message)}`);
    const items = await listPunchItems();
    punch = items.find((item) => item.title === punchTitle);
    if (!punch) {
      punch = await staffProxy("POST", `closeout/projects/${project.id}/punch-items`, {
        jobId: job.id,
        title: punchTitle,
        description: punchDescription,
        priority: "high",
        assignedUserId: technicianUserId,
      }, 201);
      report.stepPaths.createPunch = "api";
    } else {
      report.stepPaths.createPunch = "ui";
      if (punch.assignedUserId !== technicianUserId) {
        // The UI create ran without the assignee select (no member
        // options rendered); assign through the staff API instead.
        punch = await staffProxy("PATCH", `closeout/punch-items/${punch.id}`, { assignedUserId: technicianUserId }, 200);
      }
    }
    assert.equal(punch.status, "open", "A new punch item must start as open");
    assert.equal(punch.assignedUserId, technicianUserId, "Punch item must be assigned to the technician");
  }
  console.log(`PASS C1 punch item created through the staff ${report.stepPaths.createPunch === "ui" ? "UI" : "API"} and assigned to the technician`);

  // An open punch item makes the checklist not ready again.
  try {
    const status = await gotoCloseoutTab();
    const state = await metrics(staffPage);
    assertCloseoutTab({ ...state, projectId: project.id, status, markers: ["Closeout and warranty", "Closeout status", "Punch list"] });
    assertChecklist({ bodyText: state.bodyText, ready: false });
    passCase("C1b", "open punch item returns the checklist to not-ready");
  } catch (error) {
    failCase("C1b", error);
  }

  // N3: an open punch item cannot be verified (409).
  try {
    await staffProxy("POST", `closeout/punch-items/${punch.id}/verify`, {}, expectedStatusForCase("N3"));
    passCase("N3", "verifying an open punch item denied (409)");
  } catch (error) {
    failCase("N3", error);
  }

  // Resolve as the assigned technician when a technician sign-in is
  // provisioned; otherwise the owner (manager) resolve is the certified
  // path and P1 stays BLOCKED. Either way the API status + resolvedAt and
  // the attributable punch_item.resolved record are verified.
  try {
    if (wrongRoleEmail && wrongRolePassword && technicianMember.email === wrongRoleEmail) {
      const login = await loginAsWrongRole();
      technicianContext = login.context;
      const resolved = await login.page.request.post(new URL(`/api/proxy/closeout/punch-items/${punch.id}/resolve`, baseUrl).toString(), {
        headers: { Origin: baseUrl },
        data: {},
      });
      assert.equal(resolved.status(), 200, `Technician resolve returned ${resolved.status()} (expected 200)`);
      const resolvedBody = await resolved.json();
      assert.equal(resolvedBody.status, "resolved", "Technician resolve must report status resolved");
      assert.equal(resolvedBody.resolvedById, technicianUserId, "Resolve must record the assigned technician as resolver");
      report.stepPaths.resolvePunch = "technician";
      console.log("PASS C2 punch item resolved by the assigned technician");
    } else {
      await gotoCloseoutTab();
      await staffPage.getByRole("button", { name: "Resolve", exact: true }).click();
      await staffPage.getByText(/Resolved /, { exact: false }).first().waitFor({ timeout: 30_000 });
      report.stepPaths.resolvePunch = "ui";
      console.log("PASS C2 punch item resolved through the staff UI (manager path; P1 BLOCKED without a technician sign-in)");
    }
    const resolved = await getPunchItem(punch.id);
    assert.equal(resolved.status, "resolved", "Punch item must report status resolved");
    assert.ok(resolved.resolvedAt, "Resolved punch item must carry resolvedAt");
    const resolvedActivity = await verifyActivity(punch.id, PUNCH_RESOLVED_EVENT_TYPE);
    report.activity = { ...(report.activity ?? {}), punchResolved: resolvedActivity };
    // The resolver, timestamp, and activity checks above all passed: when
    // the resolve ran through the technician session, P1 is no longer
    // blocked — remove it and record it passed. The manager path leaves
    // P1 BLOCKED (no technician sign-in was provisioned).
    if (report.stepPaths.resolvePunch === "technician") {
      report.blocked = unblockCase(report.blocked, "P1");
      passCase("P1", "assigned-technician punch resolve through a technician browser session, with attributable punch_item.resolved record");
    }
  } catch (error) {
    failCase("C2", error);
  }
  await writeReport();

  // Verify as staff (UI preferred, API fallback).
  try {
    await gotoCloseoutTab();
    await staffPage.getByRole("button", { name: "Verify", exact: true }).click();
    // The counts line ("0 open · 1 resolved or verified") is already true
    // after resolve, so waiting on it cannot prove the verify submit
    // landed (run 45553851005: the wait passed and the item stayed
    // `resolved`). The Verify control itself disappears only when the item
    // leaves `resolved`; a rejected submit re-renders the form with its
    // error text instead — wait for one of those two discriminating
    // states, and surface the form error when that is what happened.
    await staffPage.waitForFunction(
      () => {
        const verifyGone = ![...document.querySelectorAll("button")].some((button) =>
          ["Verify", "Verifying…"].includes(button.textContent?.trim()),
        );
        const formError = document.querySelector("form p.text-destructive")?.textContent?.trim();
        return verifyGone || Boolean(formError);
      },
      { timeout: 30_000 },
    );
    // Read the form error only when one is actually rendered: a bare
    // textContent() on a missing element would wait out the full timeout
    // on the success path, where no error exists.
    const errorLocator = staffPage.locator("form p.text-destructive");
    const formError = (await errorLocator.count()) > 0 ? await errorLocator.first().textContent() : null;
    if (formError?.trim()) {
      throw new Error(`UI verify rejected the submit: ${redactBearerMaterial(formError.trim())}`);
    }
    report.stepPaths.verifyPunch = "ui";
  } catch (error) {
    console.error(`UI verify unavailable, falling back to the authenticated API: ${redactBearerMaterial(error.message)}`);
    const current = await getPunchItem(punch.id);
    if (current.status !== "verified") {
      await staffProxy("POST", `closeout/punch-items/${punch.id}/verify`, {}, 200);
      report.stepPaths.verifyPunch = "api";
    } else {
      report.stepPaths.verifyPunch = "ui";
    }
  }
  try {
    const verified = await getPunchItem(punch.id);
    assert.equal(verified.status, "verified", "Punch item must report status verified");
    const verifiedActivity = await verifyActivity(punch.id, PUNCH_VERIFIED_EVENT_TYPE);
    report.activity = { ...(report.activity ?? {}), punchVerified: verifiedActivity };
    passCase("C3", "punch item verified: API status verified and punch_item.verified activity record");
  } catch (error) {
    failCase("C3", error);
  }
  await writeReport();

  // N4: a verified punch item cannot be resolved again (409).
  try {
    await staffProxy("POST", `closeout/punch-items/${punch.id}/resolve`, {}, expectedStatusForCase("N4"));
    passCase("N4", "resolving a verified punch item denied (409)");
  } catch (error) {
    failCase("N4", error);
  }

  // Warranty: record the staff-supplied coverage text as submitted — the
  // script verifies only that the submitted string was kept, not that it
  // appears in the signed contract, so it is never described as
  // contract-quoted. UI preferred, API fallback.
  const warrantyTitle = `Workmanship warranty ${suffix}`;
  const warrantyCoverage = "One-year workmanship coverage per the signed contract.";
  let warranty;
  try {
    await gotoCloseoutTab();
    await staffPage.getByPlaceholder("Workmanship warranty").fill(warrantyTitle);
    await staffPage.getByPlaceholder("Paste the warranty wording exactly as written in the contract or invoice.").fill(warrantyCoverage);
    const source = staffPage.getByLabel("Linked source record");
    if (await source.count()) await source.selectOption(contract.id);
    await staffPage.getByRole("button", { name: "Record warranty", exact: true }).click();
    await staffPage.getByText(warrantyTitle, { exact: false }).waitFor({ timeout: 30_000 });
    const warranties = await staffProxy("GET", `closeout/projects/${project.id}/warranties`, undefined, 200);
    warranty = warranties.find((entry) => entry.title === warrantyTitle);
    assert.ok(warranty, "UI-created warranty must appear in the project list");
    report.stepPaths.createWarranty = "ui";
  } catch (error) {
    console.error(`UI warranty create unavailable, falling back to the authenticated API: ${redactBearerMaterial(error.message)}`);
    const warranties = await staffProxy("GET", `closeout/projects/${project.id}/warranties`, undefined, 200);
    warranty = warranties.find((entry) => entry.title === warrantyTitle);
    if (!warranty) {
      warranty = await staffProxy("POST", `closeout/projects/${project.id}/warranties`, {
        jobId: job.id,
        contractId: contract.id,
        title: warrantyTitle,
        coverageText: warrantyCoverage,
        sourceType: "contract",
        sourceId: contract.id,
      }, 201);
      report.stepPaths.createWarranty = "api";
    } else {
      report.stepPaths.createWarranty = "ui";
    }
  }
  try {
    assert.equal(warranty.coverageText, warrantyCoverage, "Warranty must quote the coverage text as submitted");
    const warrantyActivity = await verifyActivity(warranty.id, WARRANTY_CREATED_EVENT_TYPE);
    report.activity = { ...(report.activity ?? {}), warrantyCreated: warrantyActivity };
    const createdActivity = await verifyActivity(closeout.id, CLOSEOUT_CREATED_EVENT_TYPE);
    const punchCreatedActivity = await verifyActivity(punch.id, PUNCH_CREATED_EVENT_TYPE);
    report.activity = { ...(report.activity ?? {}), closeoutCreated: createdActivity, punchCreated: punchCreatedActivity };
    passCase("C4", "warranty recorded with the staff-supplied coverage text, with warranty_record.created activity record");
  } catch (error) {
    failCase("C4", error);
  }
  await writeReport();

  // ---- Phase D: mark ready (UI preferred, API fallback). ----
  try {
    await gotoCloseoutTab();
    await staffPage.getByRole("button", { name: "Mark ready", exact: true }).click();
    await staffPage.getByText("Ready for handoff").first().waitFor({ timeout: 30_000 });
    report.stepPaths.markReady = "ui";
  } catch (error) {
    console.error(`UI mark-ready unavailable, falling back to the authenticated API: ${redactBearerMaterial(error.message)}`);
    const current = await getCloseout();
    if (current.closeout.status !== "ready") {
      await staffProxy("POST", `closeout/projects/${project.id}/closeout/ready`, {}, 200);
      report.stepPaths.markReady = "api";
    } else {
      report.stepPaths.markReady = "ui";
    }
  }
  try {
    const ready = await getCloseout();
    assert.equal(ready.closeout.status, "ready", "Closeout must report status ready");
    assert.equal(ready.checklist.ready, true, "Readiness checklist must report ready");
    assert.ok(ready.closeout.completedAt, "Ready closeout must carry completedAt");
    const readyActivity = await verifyActivity(ready.closeout.id, CLOSEOUT_READY_EVENT_TYPE);
    report.activity = { ...(report.activity ?? {}), closeoutReady: readyActivity };
    const status = await gotoCloseoutTab();
    const state = await metrics(staffPage);
    assertCloseoutTab({ ...state, projectId: project.id, status, markers: ["Closeout and warranty", "Closeout status", "Ready for handoff"] });
    assertCloseoutStatus({ bodyText: state.bodyText, status: "ready" });
    assertChecklist({ bodyText: state.bodyText, ready: true });
    passCase("D1", "closeout ready: checklist verdict, API status + completedAt, and project_closeout.ready activity record");
  } catch (error) {
    failCase("D1", error);
  }
  await writeReport();

  // Ready captures at 1440/1024/768/390.
  for (const viewport of VIEWPORTS) {
    const viewportEntry = { viewport: viewport.name, pages: [], passed: false };
    report.viewports.push(viewportEntry);
    const entry = { slug: "closeout-ready", path: `/projects/${project.id}?tab=closeout`, viewport: viewport.name, passed: false };
    viewportEntry.pages.push(entry);
    try {
      await staffPage.setViewportSize({ width: viewport.width, height: viewport.height });
      const status = await gotoCloseoutTab();
      const state = await metrics(staffPage);
      // Capture BEFORE the marker assert (see B2): a failed assert must
      // still leave a screenshot for the failure report.
      entry.screenshot = await screenshotBestEffort(staffPage, `closeout-ready-${viewport.name}`);
      entry.dimensions = { scrollWidth: state.scrollWidth, clientWidth: state.clientWidth };
      assertCloseoutTab({ ...state, projectId: project.id, status, markers: ["Closeout and warranty", "Closeout status", "Ready for handoff"] });
      entry.passed = true;
    } catch (error) {
      entry.error = redactBearerMaterial(error.message);
      report.failures = [...(report.failures ?? []), { slug: "closeout-ready", viewport: viewport.name, error: redactBearerMaterial(error.message) }];
      console.error(`FAIL closeout-ready ${viewport.name}px: ${redactBearerMaterial(error.message)}`);
    } finally {
      await writeReport();
    }
    viewportEntry.passed = viewportEntry.pages.every((pageEntry) => pageEntry.passed);
  }
  await staffPage.setViewportSize({ width: 1440, height: 1000 });

  // ---- Phase E: handoff (UI preferred, API fallback). ----
  try {
    await gotoCloseoutTab();
    await staffPage.getByRole("button", { name: "Record handoff", exact: true }).click();
    await staffPage.getByText(/^Handed off/).first().waitFor({ timeout: 30_000 });
    report.stepPaths.handoff = "ui";
  } catch (error) {
    console.error(`UI handoff unavailable, falling back to the authenticated API: ${redactBearerMaterial(error.message)}`);
    const current = await getCloseout();
    if (current.closeout.status !== "handed_off") {
      await staffProxy("POST", `closeout/projects/${project.id}/closeout/handoff`, {}, 200);
      report.stepPaths.handoff = "api";
    } else {
      report.stepPaths.handoff = "ui";
    }
  }
  try {
    const handedOff = await getCloseout();
    assert.equal(handedOff.closeout.status, "handed_off", "Closeout must report status handed_off");
    assert.ok(handedOff.closeout.handedOffAt, "Handed-off closeout must carry handedOffAt");
    const handoffActivity = await verifyActivity(handedOff.closeout.id, CLOSEOUT_HANDED_OFF_EVENT_TYPE);
    report.activity = { ...(report.activity ?? {}), closeoutHandedOff: handoffActivity };
    const status = await gotoCloseoutTab();
    const state = await metrics(staffPage);
    assertCloseoutTab({ ...state, projectId: project.id, status, markers: ["Closeout and warranty", "Closeout status", "Handed off"] });
    assertCloseoutStatus({ bodyText: state.bodyText, status: "handed_off" });
    passCase("E1", "closeout handed off: API status + handedOffAt and project_closeout.handed_off activity record");
  } catch (error) {
    failCase("E1", error);
  }
  await writeReport();

  // Handed-off captures at 1440/1024/768/390.
  for (const viewport of VIEWPORTS) {
    const viewportEntry = { viewport: viewport.name, pages: [], passed: false };
    report.viewports.push(viewportEntry);
    const entry = { slug: "closeout-handed-off", path: `/projects/${project.id}?tab=closeout`, viewport: viewport.name, passed: false };
    viewportEntry.pages.push(entry);
    try {
      await staffPage.setViewportSize({ width: viewport.width, height: viewport.height });
      const status = await gotoCloseoutTab();
      const state = await metrics(staffPage);
      // Capture BEFORE the marker assert (see B2): a failed assert must
      // still leave a screenshot for the failure report.
      entry.screenshot = await screenshotBestEffort(staffPage, `closeout-handed-off-${viewport.name}`);
      entry.dimensions = { scrollWidth: state.scrollWidth, clientWidth: state.clientWidth };
      assertCloseoutTab({ ...state, projectId: project.id, status, markers: ["Closeout and warranty", "Closeout status", "Handed off"] });
      entry.passed = true;
    } catch (error) {
      entry.error = redactBearerMaterial(error.message);
      report.failures = [...(report.failures ?? []), { slug: "closeout-handed-off", viewport: viewport.name, error: redactBearerMaterial(error.message) }];
      console.error(`FAIL closeout-handed-off ${viewport.name}px: ${redactBearerMaterial(error.message)}`);
    } finally {
      await writeReport();
    }
    viewportEntry.passed = viewportEntry.pages.every((pageEntry) => pageEntry.passed);
  }
  await staffPage.setViewportSize({ width: 1440, height: 1000 });

  // Staff closeout document: served as text/html from the staff API.
  try {
    const document = await staffProxyRaw("GET", `closeout/projects/${project.id}/closeout/document`, undefined, 200);
    assertCloseoutDocument({ contentType: document.contentType, bodyText: document.text, projectName: project.name });
    passCase("E2", "staff closeout document served as text/html naming the project");
  } catch (error) {
    failCase("E2", error);
  }
  await writeReport();

  report.fixtures = {
    customer: customer.id,
    project: project.id,
    proposal: proposal.id,
    contract: contract.id,
    invoice: invoice.id,
    job: job.id,
    closeout: closeout.id,
    punchItem: punch.id,
    warranty: warranty.id,
  };
  report.cleanupNotes = [
    "Fixtures remain in the sanitized tenant by design (synthetic customer, project, proposal, contract, invoice, job, closeout, punch item, and warranty); nothing is deleted.",
  ];
  await writeReport();

  // ---- Phase F: portal handoff view (read-only). ----
  // The access token is bearer material: it lives only in this local
  // variable, is never logged or written to report.json, and is consumed
  // by the single redemption below.
  try {
    const issued = await staffProxy("POST", "customer-portal/access-tokens", { customerId: customer.id }, 201);
    const portalToken = issued.token;
    assert.ok(typeof portalToken === "string" && portalToken.length >= 40, "Issued portal access token must be a non-empty bearer value");
    const portalContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    const portalPage = await portalContext.newPage();
    portalPage.setDefaultTimeout(30_000);
    await portalPage.goto(new URL(`/customer-portal/access?token=${encodeURIComponent(portalToken)}`, baseUrl).toString(), { waitUntil: "networkidle", timeout: 60_000 });
    await portalPage.getByRole("button", { name: "Continue to customer portal", exact: true }).click();
    await portalPage.waitForURL(/\/customer-portal(?:\?|$)/, { timeout: 60_000 });
    const portalUrl = new URL(`/customer-portal/projects/${project.id}`, baseUrl).toString();
    const portalResponse = await portalPage.goto(portalUrl, { waitUntil: "networkidle", timeout: 60_000 });
    const portalState = await metrics(portalPage);
    assertPortalHandoff({
      ...portalState,
      projectId: project.id,
      status: portalResponse?.status() ?? 0,
      markers: ["Closeout handoff", "Closeout status", "Handed off", "Punch items: 1 resolved", "View closeout document"],
    });
    report.stepPaths.portalHandoff = "ui";
    passCase("F1", "portal shows the handed-off closeout read-only with the punch summary and document link");

    // Portal closeout document through the portal proxy (GET only).
    const portalDocument = await portalPage.request.get(`/api/customer-portal/projects/${project.id}/closeout/document`);
    assert.equal(portalDocument.status(), 200, `Portal closeout document returned ${portalDocument.status()} (expected 200)`);
    assertCloseoutDocument({
      contentType: portalDocument.headers()["content-type"] ?? "",
      bodyText: await portalDocument.text(),
      projectName: project.name,
    });
    passCase("F2", "portal closeout document served as text/html naming the project");

    // Portal captures at 1440/1024/768/390.
    for (const viewport of VIEWPORTS) {
      const viewportEntry = { viewport: viewport.name, pages: [], passed: false };
      report.viewports.push(viewportEntry);
      const entry = { slug: "portal-handoff", path: `/customer-portal/projects/${project.id}`, viewport: viewport.name, passed: false };
      viewportEntry.pages.push(entry);
      try {
        await portalPage.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await portalPage.goto(portalUrl, { waitUntil: "networkidle", timeout: 60_000 });
        const state = await metrics(portalPage);
        // Capture BEFORE the marker assert (see B2): a failed assert must
        // still leave a screenshot for the failure report.
        entry.screenshot = await screenshotBestEffort(portalPage, `portal-handoff-${viewport.name}`);
        assertPortalHandoff({
          ...state,
          projectId: project.id,
          status: response?.status() ?? 0,
          markers: ["Closeout handoff", "Closeout status", "Handed off", "View closeout document"],
        });
        entry.dimensions = { scrollWidth: state.scrollWidth, clientWidth: state.clientWidth };
        entry.passed = true;
      } catch (error) {
        // The portal page renders the same "Portal access required" shell
        // whenever getPortalProject throws (run 45553851005: F1 failed on
        // the marker with no page text anywhere in the log, so the shell
        // vs render-miss question could not be answered). Record a snippet.
        let pageSnippet = "";
        try {
          pageSnippet = redactBearerMaterial((await metrics(portalPage)).bodyText.slice(0, 300));
        } catch {
          pageSnippet = "";
        }
        entry.error = redactBearerMaterial(error.message);
        if (pageSnippet) entry.pageSnippet = pageSnippet;
        report.failures = [...(report.failures ?? []), { slug: "portal-handoff", viewport: viewport.name, error: redactBearerMaterial(error.message), ...(pageSnippet ? { pageSnippet } : {}) }];
        console.error(`FAIL portal-handoff ${viewport.name}px: ${redactBearerMaterial(error.message)}${pageSnippet ? ` — page: ${pageSnippet}` : ""}`);
      } finally {
        await writeReport();
      }
      viewportEntry.passed = viewportEntry.pages.every((pageEntry) => pageEntry.passed);
    }
    await portalContext.close();
  } catch (error) {
    failCase("F1", error);
  }
  await writeReport();

  // ---- Phase G: negative security evidence. ----
  async function staffApiProbe(method, suffixPath, body, expectedStatus, label) {
    const response = await staffPage.request.fetch(new URL(`/api/proxy/${suffixPath}`, baseUrl).toString(), {
      method,
      // The proxy rejects origin-less mutations with 403
      // (shouldRejectProxyMutation), so probe mutations carry the same
      // same-origin Origin header staffProxy sends.
      headers: { Origin: baseUrl },
      ...(body === undefined ? {} : { data: body }),
    });
    assert.equal(response.status(), expectedStatus, `${label} returned ${response.status()} (expected ${expectedStatus})`);
    return response;
  }

  // N1: the handed-off closeout's transitions are closed (409).
  try {
    await staffApiProbe("POST", `closeout/projects/${project.id}/closeout/ready`, {}, expectedStatusForCase("N1"), "Mark ready on handed-off closeout");
    passCase("N1", "marking a handed-off closeout ready denied (409)");
  } catch (error) {
    failCase("N1", error);
  }

  // N6 wrong-role: only exercisable when a low-permission staff identity is
  // provisioned. The principal's TEST Org role is verified BEFORE the
  // mutation via GET /api/proxy/auth/memberships: only technician/viewer
  // lack crm.write (app/domain/contracts.ts rolePermissions). A 201 from a
  // confirmed low-permission principal is an authorization regression and
  // FAILs; a role that holds crm.write records NOT-APPLICABLE without
  // attempting the mutation. Without a provisioned identity the case is
  // BLOCKED, never invented. The technician login from Phase C is reused
  // when it exists; otherwise a fresh login is attempted.
  if (wrongRoleEmail && wrongRolePassword) {
    try {
      let wrongRolePage = null;
      if (!technicianContext) {
        const login = await loginAsWrongRole();
        technicianContext = login.context;
        wrongRolePage = login.page;
      } else {
        wrongRolePage = technicianContext.pages()[0];
      }
      const membershipsResponse = await wrongRolePage.request.get(new URL("/api/proxy/auth/memberships", baseUrl).toString());
      assert.equal(membershipsResponse.status(), 200, `Wrong-role memberships lookup returned ${membershipsResponse.status()} (expected 200)`);
      const memberships = await membershipsResponse.json();
      assert.ok(Array.isArray(memberships), "Memberships lookup did not return an array");
      const membership = memberships.find((entry) => entry.orgId === targetOrgId);
      assert.ok(membership, "Wrong-role identity has no membership in the TEST Org");
      if (!ROLES_WITHOUT_CRM_WRITE.includes(membership.role)) {
        recordCase("N6", "NOT-APPLICABLE", `The provisioned identity holds role ${membership.role}, which has crm.write; no low-permission identity is provisioned`);
        console.log(`NOT-APPLICABLE N6: provisioned identity holds role ${membership.role}; mutation not attempted`);
      } else {
        const wrongRoleResponse = await wrongRolePage.request.post(new URL("/api/proxy/closeout/projects/" + project.id + "/punch-items", baseUrl).toString(), {
          headers: { Origin: baseUrl },
          data: { title: `S069 wrong-role probe ${suffix}`, description: "Probe punch item" },
        });
        if (wrongRoleResponse.status() === 403) {
          passCase("N6", "staff without crm.write denied punch-item create (403)");
        } else if (wrongRoleResponse.status() === 201) {
          // No punch-item delete route exists, so the probe row remains in
          // the sanitized tenant as evidence of the regression.
          throw new Error(`Confirmed low-permission principal (role ${membership.role}) created a punch item (201) — authorization regression; the probe row remains in the sanitized tenant as evidence`);
        } else {
          throw new Error(`Wrong-role create returned ${wrongRoleResponse.status()} (expected 403)`);
        }
      }
    } catch (error) {
      failCase("N6", error);
    }
  } else {
    report.blocked.push({ ...WRONG_ROLE_BLOCKED, status: "BLOCKED" });
    console.log("BLOCKED N6: no low-permission staff identity provisioned");
  }
  await writeReport();

  // N7 cross-tenant: a project from another org must read as missing.
  const foreignProjectId = config.foreignProjectId;
  if (foreignProjectId) {
    try {
      await staffApiProbe("GET", `closeout/projects/${foreignProjectId}/closeout`, undefined, expectedStatusForCase("N7"), "Cross-tenant closeout read");
      passCase("N7", "foreign closeout reads as missing (404)");
    } catch (error) {
      failCase("N7", error);
    }
  } else {
    recordCase("N7", "NOT-APPLICABLE", "BETA_FOREIGN_PROJECT_ID is not provisioned");
    console.log("NOT-APPLICABLE N7: no foreign project id provisioned");
  }

  // N8 unauthenticated: no session must read or create.
  try {
    const anonContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    const anonRead = await anonContext.request.get(`/api/proxy/closeout/projects/${project.id}/closeout`);
    assert.equal(anonRead.status(), expectedStatusForCase("N8"), `Unauthenticated read returned ${anonRead.status()} (expected 401)`);
    const anonCreate = await anonContext.request.post(`/api/proxy/closeout/projects/${project.id}/closeout`, {
      // Same-origin value: the proxy rejects origin-less mutations (403)
      // before authentication, so an anonymous probe without it would
      // record 403 instead of the 401 the case is meant to prove.
      headers: { Origin: baseUrl },
      data: {},
    });
    assert.equal(anonCreate.status(), expectedStatusForCase("N8"), `Unauthenticated create returned ${anonCreate.status()} (expected 401)`);
    await anonContext.close();
    passCase("N8", "unauthenticated closeout read and create denied (401)");
  } catch (error) {
    failCase("N8", error);
  }

  // N9: unknown ids read as missing, never as server errors.
  try {
    await staffApiProbe("POST", `closeout/punch-items/${randomUUID()}/resolve`, {}, expectedStatusForCase("N9"), "Resolve unknown punch item");
    passCase("N9", "resolving an unknown punch item denied (404)");
  } catch (error) {
    failCase("N9", error);
  }
  try {
    await staffApiProbe(
      "POST",
      "closeout/projects/" + randomUUID() + "/punch-items",
      { title: `S069 unknown project ${suffix}` },
      expectedStatusForCase("N9"),
      "Create punch item for unknown project",
    );
    passCase("N9", "creating a punch item for an unknown project denied (404)");
  } catch (error) {
    failCase("N9", error);
  }

  // N10: the customer portal exposes no closeout mutation endpoint, and
  // its document route is GET-only. An anonymous document POST must 405:
  // the portal proxy route exports only GET, so Next.js rejects the POST
  // before any handler runs — that is the shipped proof that no mutation
  // action exists on the portal surface. An anonymous portal project read
  // must 401 (portal session required).
  try {
    const anonContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL: baseUrl });
    const portalDocumentPost = await anonContext.request.post(`/api/customer-portal/projects/${project.id}/closeout/document`, {
      headers: { Origin: baseUrl },
      data: {},
    });
    assert.equal(portalDocumentPost.status(), expectedStatusForCase("N10"), `Portal document POST returned ${portalDocumentPost.status()} (expected 405)`);
    const portalProject = await anonContext.request.get(`/api/customer-portal/projects/${project.id}`);
    assert.equal(portalProject.status(), 401, `Unauthenticated portal project read returned ${portalProject.status()} (expected 401)`);
    await anonContext.close();
    passCase("N10", "portal closeout document POST rejected (405 — route exports only GET); portal project read requires a session (401)");
  } catch (error) {
    failCase("N10", error);
  }

  report.credentialScan = { performedBy: "workflow", result: "pending" };
  await staffContext.close();
  if (technicianContext) await technicianContext.close();
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
console.log(`S069 browser evidence ${report.result}: ${report.viewports.length} viewports, ${report.cases.length} cases, ${report.blocked.length} blocked`);
if (report.result !== "PASS") process.exitCode = 1;
