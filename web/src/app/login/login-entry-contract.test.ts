import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const entry = () =>
  readFile(
    new URL("../../components/entry/login-entry.tsx", import.meta.url),
    "utf8",
  );
test("login delegates presentation to the approved entry without replacing authentication", async () => {
  const page = await readFile(new URL("./page.tsx", import.meta.url), "utf8"),
    source = await entry();
  assert.match(page, /<LoginEntry/);
  assert.match(source, /useActionState\(loginAction,\s*undefined\)/);
  assert.match(source, /action=\{formAction\}/);
  assert.match(source, /Built for what you/);
  assert.doesNotMatch(
    source,
    /clientFetch|apiFetch|fetch\(|router\.push|window\.location|redirect\(/,
  );
});
test("recovery, account creation and masked password retain their established routes and semantics", async () => {
  const source = await entry();
  assert.match(source, /href="\/forgot-password"/);
  assert.match(source, /href="\/signup"/);
  assert.match(source, /aria-pressed=\{showPassword\}/);
  assert.match(
    source,
    /showPassword\s*\?\s*"Hide password"\s*:\s*"Show password"/,
  );
  assert.match(source, /autoComplete="current-password"/);
  assert.match(source, /disabled=\{isPending\}/);
  assert.match(source, /role="alert"/);
});
test("the product entry contains no preview fixtures, prototype destinations or fake sign-in", async () => {
  const source = await entry();
  assert.doesNotMatch(
    source,
    /figma\.com|Design preview|Preview workspace|Simulate|scene=hero|device=mobile/,
  );
  assert.match(source, /noValidate/);
  assert.match(source, /aria-invalid/);
  assert.match(source, /aria-describedby/);
});
test("the intro remains bounded and never loads the renderer until mounted", async () => {
  const source = await readFile(
    new URL("../../components/entry/cinematic-intro.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /setTimeout\(onComplete,\s*duration\)/);
  assert.match(source, /import\("\.\/cinema"\)/);
  assert.match(source, /cancelled\s*=\s*true/);
  assert.match(source, /dispose\?\.\(\)/);
  assert.match(source, /Skip intro/);
  assert.match(source, /e\.key\s*===\s*"Tab"/);
});
