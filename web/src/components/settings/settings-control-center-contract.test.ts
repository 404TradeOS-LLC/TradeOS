import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Settings opens on Pricing and separates contractor controls from Advanced", async () => {
  const source = await readSource("./settings-console.tsx");

  assert.match(source, /useState\("costbook"\)/);
  assert.match(source, /const contractorSectionIds = \["company", "costbook", "estimating", "team", "notifications", "ai", "integrations"\]/);
  assert.match(source, /Advanced \/ admin/);
  assert.match(source, /<optgroup label="Contractor settings">/);
  assert.match(source, /<optgroup label="Advanced \/ admin">/);
  assert.doesNotMatch(source, /selectedSection\.stats\.map/);
});

test("Settings labels match the canonical contractor language", async () => {
  const schema = await readSource("./settings-schema.tsx");

  assert.match(schema, /id: "costbook",\n\s+title: "Pricing"/);
  assert.match(schema, /id: "team",\n\s+title: "Team & Access"/);
  assert.match(schema, /id: "notifications",\n\s+title: "Communication"/);
  assert.match(schema, /id: "ai",\n\s+title: "Athena"/);
  assert.match(schema, /id: "integrations",\n\s+title: "Connections"/);
});

test("Settings sends the complete draft required by PATCH /settings", async () => {
  const source = await readSource("./settings-console.tsx");

  assert.match(source, /PATCH \/settings currently validates the complete organization settings/);
  assert.match(source, /body: JSON\.stringify\(draft\)/);
  assert.match(source, /setPersistedKeys\(new Set\(Object\.keys\(draft\)\)\)/);
  assert.doesNotMatch(source, /Object\.fromEntries\(changedEntries\)|JSON\.stringify\(patch\)/);
});

test("organization-specific fallback values are blank rather than fabricated business facts", async () => {
  const settings = await readSource("../../lib/settings.ts");

  assert.match(settings, /companyName: ""/);
  assert.match(settings, /address: ""/);
  assert.match(settings, /licenseNumber: ""/);
  assert.match(settings, /costRegion: ""/);
  assert.match(settings, /laborRate: ""/);
  assert.match(settings, /supplierPreference: ""/);
  assert.match(settings, /aiMonthlyBudget: ""/);
  assert.doesNotMatch(settings, /TradeOS Roofing & Exteriors|742 Market Street|Builders Mutual|Beacon \+ ABC Supply|1800/);
  assert.match(settings, /timezone: "America\/Indiana\/Indianapolis"/);
});

test("missing persisted settings are disclosed as product defaults", async () => {
  const source = await readSource("./settings-console.tsx");
  const page = await readSource("../../app/(app)/settings/page.tsx");

  assert.match(page, /persistedSettingKeys=\{Object\.keys\(persisted\?\.settings \?\? \{\}\)\}/);
  assert.match(source, /Product default; not yet saved for this organization/);
  assert.match(source, /persistedKeys\.has\(String\(item\.key\)\)/);
});

test("Pricing preserves Costbook provenance boundaries and does not invent trust", async () => {
  const source = await readSource("./settings-console.tsx");

  assert.match(source, /Costbook provenance still governs actual price trust/);
  assert.match(source, /never turn stale, placeholder, or unverified supplier pricing into trusted precision/);
  assert.match(source, /href="\/costbook"/);
});

test("developer metadata does not claim live health or hidden inventory", async () => {
  const page = await readSource("../../app/(app)/settings/page.tsx");
  const source = await readSource("./settings-console.tsx");

  assert.match(page, /databaseVersion: "Not exposed"/);
  assert.match(page, /featureFlags: "Not exposed"/);
  assert.match(page, /healthStatus: "Not exposed"/);
  assert.match(source, /sampleData: true/);
  assert.doesNotMatch(page, /healthStatus: "Nominal"/);
  assert.doesNotMatch(page, /project-workspace, ai-estimate-assist, estimate-compare/);
});
