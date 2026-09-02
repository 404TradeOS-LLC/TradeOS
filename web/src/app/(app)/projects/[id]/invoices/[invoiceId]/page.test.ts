import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The invoice detail page decides whether to render the RecordPaymentForm
// from a hardcoded role list (`canRecordPayment`) that duplicates, rather
// than imports, the backend's `billing.write` permission grant
// (app/domain/contracts.ts). The two have no shared source of truth, so a
// role change on either side silently desyncs them: showing the form to a
// role the backend will 403 (broken beta UX), or hiding it from a role the
// backend would allow (a beta contractor who can never record a payment).
// This pins today's verified-matching role sets so a future edit to either
// file fails a test instead of failing silently in production.

function readPageSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "page.tsx"), "utf8");
}

function readDomainContractsSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // web/src/app/(app)/projects/[id]/invoices/[invoiceId] -> repo root -> app/domain/contracts.ts
  return fs.readFileSync(path.join(here, "..", "..", "..", "..", "..", "..", "..", "..", "app", "domain", "contracts.ts"), "utf8");
}

function extractFrontendCanRecordPaymentRoles(): string[] {
  const source = readPageSource();
  const match = source.match(/const canRecordPayment = \[([^\]]+)\]\.includes\(settings\.currentRole\);/);
  assert.ok(match, "expected a canRecordPayment role-list guard in the invoice detail page");
  return match[1].split(",").map((role) => role.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

function extractBackendBillingWriteRoles(): string[] {
  const source = readDomainContractsSource();
  const rolePermissionsStart = source.indexOf("const rolePermissions:");
  assert.notEqual(rolePermissionsStart, -1, "expected a rolePermissions map in app/domain/contracts.ts");
  const rolePermissionsEnd = source.indexOf("\n};", rolePermissionsStart);
  assert.notEqual(rolePermissionsEnd, -1, "expected the rolePermissions map to be closed with \"\\n};\"");
  const rolePermissionsSource = source.slice(rolePermissionsStart, rolePermissionsEnd);

  const roles: string[] = [];
  const roleEntryPattern = /^\s*(\w+):\s*(domainPermissions|\[[^\]]*\]),?$/gm;
  let entry: RegExpExecArray | null;
  while ((entry = roleEntryPattern.exec(rolePermissionsSource))) {
    const [, role, permissions] = entry;
    if (permissions === "domainPermissions" || permissions.includes('"billing.write"')) {
      roles.push(role);
    }
  }
  return roles;
}

test("the invoice detail page's canRecordPayment role list exactly matches the backend's billing.write grant", () => {
  const frontendRoles = extractFrontendCanRecordPaymentRoles().sort();
  const backendRoles = extractBackendBillingWriteRoles().sort();

  assert.deepEqual(
    frontendRoles,
    backendRoles,
    `canRecordPayment roles ${JSON.stringify(frontendRoles)} must match billing.write roles ${JSON.stringify(backendRoles)}`
  );
});

test("canRecordPayment excludes technician and viewer, matching their lack of billing.write", () => {
  const frontendRoles = extractFrontendCanRecordPaymentRoles();
  assert.ok(!frontendRoles.includes("technician"), "technician does not have billing.write and must not see the payment form");
  assert.ok(!frontendRoles.includes("viewer"), "viewer does not have billing.write and must not see the payment form");
});

test("the payment form is gated on a positive balance, not shown once an invoice is fully paid", () => {
  const source = readPageSource();
  assert.match(source, /canRecordPayment && invoice\.balanceDue > 0 \? <RecordPaymentForm/);
});
