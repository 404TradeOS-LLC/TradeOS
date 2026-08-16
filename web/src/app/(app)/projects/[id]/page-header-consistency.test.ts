import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// No jest/vitest/RTL harness exists for `web/`'s App Router pages (see
// auth.test.ts for the established precedent), so these pin the *shape* of
// each page's source rather than rendering it. Each project sub-detail page
// previously hand-rolled its own title/back-link block instead of using the
// shared PageHeader component every other list/detail page in the app uses
// (Projects, Customers, Costbook, Athena). Two of them (proposals/new,
// invoices/new) had no back-link at all -- a real navigation dead end, not
// just a style drift. These tests fail if a future edit reintroduces either
// problem.

const HERE = path.dirname(fileURLToPath(import.meta.url));

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(HERE, relativePath), "utf8");
}

const PAGE_HEADER_IMPORT = /import\s*\{\s*PageHeader\s*\}\s*from\s*["']@\/components\/shared\/page-header["']/;

const PAGES_WITH_BACK_NAV = [
  "proposals/new/page.tsx",
  "invoices/new/page.tsx",
  "proposals/[proposalId]/page.tsx",
  "contracts/[contractId]/page.tsx",
  "invoices/[invoiceId]/page.tsx",
  "estimates/compare/page.tsx",
  "estimates/[estimateId]/builder.tsx",
];

for (const relativePath of PAGES_WITH_BACK_NAV) {
  test(`${relativePath} uses the shared PageHeader with a backHref, not a hand-rolled title block`, () => {
    const source = readSource(relativePath);
    assert.match(source, PAGE_HEADER_IMPORT, "must import the shared PageHeader component");
    assert.match(source, /<PageHeader/, "must render <PageHeader ... />");
    assert.match(source, /<PageHeader[\s\S]*?backHref=/, "PageHeader must be given a backHref back to its parent");
    assert.doesNotMatch(source, /←\s*Back to/, "must not still contain the old hand-rolled '← Back to ...' link text");
  });
}

test("proposals/new and invoices/new no longer render a raw <h1> title outside PageHeader", () => {
  for (const relativePath of ["proposals/new/page.tsx", "invoices/new/page.tsx"]) {
    const source = readSource(relativePath);
    assert.doesNotMatch(source, /<h1\b/, `${relativePath} should delegate its title to PageHeader`);
  }
});
