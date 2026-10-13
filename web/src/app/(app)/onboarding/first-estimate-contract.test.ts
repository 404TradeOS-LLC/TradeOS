import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("./page.tsx", import.meta.url);
const formUrl = new URL("./first-estimate-form.tsx", import.meta.url);
const dashboardUrl = new URL("../dashboard/page.tsx", import.meta.url);
const projectActionUrl = new URL("../../../actions/projects.ts", import.meta.url);

async function sources() {
  const [page, form, dashboard, actions] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(formUrl, "utf8"),
    readFile(dashboardUrl, "utf8"),
    readFile(projectActionUrl, "utf8"),
  ]);
  return { page, form, dashboard, actions };
}

test("quick-start keeps the authenticated application boundary and offers a skip path", async () => {
  const { page } = await sources();

  assert.ok(page.includes('getSessionToken()'));
  assert.ok(page.includes('if (!token) redirect("/login")'));
  assert.ok(page.includes('href="/dashboard"'));
  assert.ok(page.includes("customerLookupUnavailable"));
  assert.ok(page.includes("Customer lookup is temporarily unavailable"));
});

test("first-estimate form uses existing real persistence rather than a demo-only action", async () => {
  const { form, actions } = await sources();

  assert.ok(form.includes("useActionState(createProjectAction, undefined)"));
  assert.ok(form.includes('name="intent" value="estimate"'));
  assert.ok(form.includes('name="name"'));
  assert.ok(form.includes('name="simpleScope"'));
  assert.ok(form.includes("required"));
  assert.ok(form.includes('name="customerId"'));
  assert.ok(actions.includes('method: "POST"'));
  assert.ok(actions.includes('simpleScope: simpleScope || undefined'));
  assert.ok(actions.includes('if (createIntent === "estimate")'));
  assert.ok(actions.includes('redirect(`/projects/${projectId}/estimates/${estimate.id}`)'));
  assert.equal(form.includes("priceApplied: true"), false);
});

test("empty Today points to the real quick-start without redirecting returning users", async () => {
  const { dashboard } = await sources();

  assert.ok(dashboard.includes("token && projects.length === 0"));
  assert.ok(dashboard.includes('href="/onboarding"'));
  assert.ok(dashboard.includes("<TodayCommandBoard"));
  assert.ok(dashboard.includes("Build first estimate"));
});
