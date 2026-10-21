import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assertCostbookEvidenceIdentity } from "./costbook-identity.mjs";

const org = "9814bd72-626a-42f4-8871-cd755cb9d685";
const allowed = { organizationId: org, permissions: { canRead: true, canWrite: true, canManage: true } };
const reader = { organizationId: org, permissions: { canRead: true, canWrite: false, canManage: false } };

test("accepts authenticated owner and read-only Costbook workspace DTOs", () => {
  assert.doesNotThrow(() => assertCostbookEvidenceIdentity(allowed, org, "true"));
  assert.doesNotThrow(() => assertCostbookEvidenceIdentity(reader, org, "false"));
});

test("rejects wrong tenant, role, and unverified permission claims", () => {
  for (const args of [
    [reader, org, "true"],
    [allowed, org, "false"],
    [{ ...reader, organizationId: "other" }, org, "false"],
    [{ ...reader, permissions: { canRead: false, canWrite: false, canManage: false } }, org, "false"],
    [{ ...reader, permissions: { canRead: true, canWrite: false, canManage: true } }, org, "false"],
    [null, org, "false"],
    [reader, org, undefined],
    [reader, undefined, "false"],
  ]) assert.throws(() => assertCostbookEvidenceIdentity(...args));
});

test("read-only Assembly evidence avoids the Settings page and identifies both role permissions", () => {
  const script = fs.readFileSync(new URL("../auth-setup.mjs", import.meta.url), "utf8");
  const start = script.indexOf('if (process.env.BETA_SMOKE_TENANT_VERIFY_MODE === "costbook_read_only")');
  assert.ok(start > 0, "Read-only evidence identity branch missing");
  const end = script.indexOf("} else {", start);
  const readOnly = script.slice(start, end);
  assert.match(readOnly, /\/api\/proxy\/costbook\/workspace/);
  assert.match(readOnly, /assertCostbookEvidenceIdentity/);
  assert.doesNotMatch(readOnly, /\/settings|\/api\/proxy\/settings/);
  assert.doesNotMatch(readOnly, /\.post\(|\.put\(|\.patch\(|\.delete\(/);
});
