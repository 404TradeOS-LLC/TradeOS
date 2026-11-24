import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Settings shows the signed-in user's own sign-in ID under Team & Access", async () => {
  const page = await readSource("../../app/(app)/settings/page.tsx");
  const consoleSource = await readSource("./settings-console.tsx");

  // The page resolves the session subject (the Supabase Auth UUID, or
  // local:<uuid> for a local-auth account) and hands it to the console.
  assert.match(page, /getSession\(\)/);
  assert.match(page, /signInId=\{session\?\.sub \?\? null\}/);

  // The console renders it as its own card in the team section, from the
  // signInId prop — never from the application user UUID.
  assert.match(consoleSource, /signInId: string \| null/);
  assert.match(consoleSource, /Your TradeOS sign-in ID/);
  assert.match(consoleSource, /selectedSection\.id === "team" && signInId/);
  const card = consoleSource.match(/Your TradeOS sign-in ID[\s\S]*?AddMemberForm/);
  assert.ok(card, "expected the sign-in ID card directly above the Add member form");
  assert.match(card[0], /\{signInId\}/);
  assert.doesNotMatch(card[0], /supplierWorkflowIdentity\.userId/);
});

test("Add member form placeholder is a recognizably fake example UUID", async () => {
  const form = await readSource("./add-member-form.tsx");

  assert.match(form, /placeholder=\{SIGN_IN_ID_PLACEHOLDER\}/);
  // Regression: the placeholder previously was a real staging account's
  // application user ID, which owners pasted into the form and the submit
  // failed with a duplicate-record error (staging, 2026-11-23).
  assert.doesNotMatch(form, /6daf2a3b-d4be-4479-8540-dd64356dbdb5/);
});
