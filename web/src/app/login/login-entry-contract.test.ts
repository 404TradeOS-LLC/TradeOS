import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("./page.tsx", import.meta.url);

async function readSource() {
  return readFile(sourceUrl, "utf8");
}

test("login keeps the existing auth action while adopting the canonical entry composition", async () => {
  const source = await readSource();

  assert.match(source, /useActionState\(loginAction, undefined\)/);
  assert.match(source, /action=\{formAction\}/);
  assert.match(source, /Built for what/);
  assert.match(source, /Welcome back\./);
  assert.match(source, /Sign in to your workspace\./);
  assert.match(source, /tradeos-entry-official-light\.svg/);
  assert.doesNotMatch(source, /Card(Header|Content|Description|Title)?/);
});

test("entry uses the canonical responsive copper identity artwork", async () => {
  const source = await readSource();

  assert.match(source, /tradeos-entry-copper-identity-mobile\.svg/);
  assert.match(source, /tradeos-entry-copper-identity-tablet\.svg/);
  assert.match(source, /tradeos-entry-copper-identity-desktop\.svg/);
  assert.match(source, /lg:grid-cols-\[minmax\(0,56\.7%\)_minmax\(0,43\.3%\)\]/);
  assert.match(source, /sm:min-h-\[220px\]/);
  assert.match(source, /lg:min-h-screen/);
});

test("login retains recovery and account creation while adding an accessible password reveal", async () => {
  const source = await readSource();

  assert.match(source, /href="\/forgot-password"/);
  assert.match(source, /href="\/signup"/);
  assert.match(source, /aria-pressed=\{showPassword\}/);
  assert.match(source, /aria-label=\{showPassword \? "Hide password" : "Show password"\}/);
  assert.match(source, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(source, /autoComplete="current-password"/);
});

test("entry does not add an alternate authentication or navigation path", async () => {
  const source = await readSource();

  assert.doesNotMatch(source, /clientFetch|apiFetch|fetch\(/);
  assert.doesNotMatch(source, /window\.location|router\.push|redirect\(/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});
