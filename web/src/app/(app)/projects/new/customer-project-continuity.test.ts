import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("./page.tsx", import.meta.url);
const formUrl = new URL("./form.tsx", import.meta.url);
const actionUrl = new URL("../../../actions/projects.ts", import.meta.url);

async function sources() {
  const [page, form, actions] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(formUrl, "utf8"),
    readFile(actionUrl, "utf8"),
  ]);
  return { page, form, actions };
}

test("customer-context project creation loads the existing Customer and ServiceAddress records", async () => {
  const { page, form } = await sources();

  assert.ok(page.includes("getCustomer(token, customerId)"));
  assert.ok(page.includes("selectedCustomer={customerContext}"));
  assert.ok(form.includes("selectedCustomer?: CustomerProjectContext"));
  assert.ok(form.includes("selectedCustomer?.serviceAddresses"));
  assert.ok(form.includes("find((address) => address.isPrimary)"));
  assert.ok(form.includes('name="customerId" value={selectedCustomer.id}'));
});

test("saved ServiceAddress is copied into Project.siteAddress without inventing a relationship", async () => {
  const { form, actions } = await sources();

  assert.ok(form.includes('name="siteAddress"'));
  assert.ok(form.includes("formatServiceAddress(preferredAddress)"));
  assert.ok(form.includes("copied into Project.siteAddress"));
  assert.ok(form.includes("no hidden Project→ServiceAddress relationship is created"));
  assert.equal(form.includes('name="serviceAddressId"'), false);
  assert.equal(actions.includes("serviceAddressId"), false);
});

test("customer-context form exposes explicit create-project and create-and-start-estimate paths", async () => {
  const { form, actions } = await sources();

  assert.ok(form.includes("Create project"));
  assert.ok(form.includes('name="intent"'));
  assert.ok(form.includes('value="estimate"'));
  assert.ok(form.includes("Create & start estimate"));
  assert.ok(actions.includes('if (createIntent === "estimate")'));
  assert.ok(actions.includes('redirect(`/projects/${projectId}/estimates/${estimate.id}`)'));
});

test("ordinary Project creation opens the newly created workspace instead of the generic list", async () => {
  const { actions } = await sources();

  const projectRefresh = 'revalidatePath(`/projects/${projectId}`);';
  const projectRedirect = 'redirect(`/projects/${projectId}`);';
  assert.ok(actions.lastIndexOf(projectRefresh) < actions.lastIndexOf(projectRedirect));
  assert.equal(actions.includes('redirect("/projects");'), false);
});

test("forced Universal Create intents remain preserved", async () => {
  const { form, actions } = await sources();

  assert.ok(form.includes('createIntent ? <input type="hidden" name="intent" value={createIntent}'));
  assert.ok(actions.includes('if (createIntent === "job")'));
  assert.ok(actions.includes('buildProjectIntentDestination(projectId, "job")'));
});
