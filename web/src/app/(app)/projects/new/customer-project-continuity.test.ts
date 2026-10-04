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

  assert.match(page, /getCustomer(token, customerId)/);
  assert.match(page, /selectedCustomer={customerContext}/);
  assert.match(form, /selectedCustomer?: CustomerProjectContext/);
  assert.match(form, /selectedCustomer?.serviceAddresses/);
  assert.match(form, /find((address) => address.isPrimary)/);
  assert.match(form, /name="customerId" value={selectedCustomer.id}/);
});

test("saved ServiceAddress is copied into Project.siteAddress without inventing a relationship", async () => {
  const { form, actions } = await sources();

  assert.match(form, /name="siteAddress"/);
  assert.match(form, /formatServiceAddress(preferredAddress)/);
  assert.match(form, /copied into Project.siteAddress/);
  assert.match(form, /no hidden Project→ServiceAddress relationship is created/);
  assert.doesNotMatch(form, /name="serviceAddressId"/);
  assert.doesNotMatch(actions, /serviceAddressId/);
});

test("customer-context form exposes explicit create-project and create-and-start-estimate paths", async () => {
  const { form, actions } = await sources();

  assert.match(form, />Create project</);
  assert.match(form, /name="intent"/);
  assert.match(form, /value="estimate"/);
  assert.match(form, /Create & start estimate/);
  assert.match(actions, /if (createIntent === "estimate")/);
  assert.match(actions, /redirect(`\/projects\/${projectId}\/estimates\/${estimate.id}`)/);
});

test("ordinary Project creation opens the newly created workspace instead of the generic list", async () => {
  const { actions } = await sources();

  assert.match(actions, /revalidatePath(`\/projects\/${projectId}`);\s*redirect(`\/projects\/${projectId}`);/);
  assert.doesNotMatch(actions, /redirect("\/projects");\s*\n}/);
});

test("forced Universal Create intents remain preserved", async () => {
  const { form, actions } = await sources();

  assert.match(form, /createIntent \? <input type="hidden" name="intent" value={createIntent}/);
  assert.match(actions, /if (createIntent === "job")/);
  assert.match(actions, /buildProjectIntentDestination(projectId, "job")/);
});
