import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

// GAP-1 (S059): the four customer-portal detail pages used to let a portal
// fetch failure (expired/invalid session) escape as an uncaught throw, which
// Next.js surfaces as its generic error page. They must render the same
// "Portal access required" state as the portal home page instead.
// These tests render the real page components with a portal fetch that throws
// like an expired session would, following the vm-render pattern in
// src/app/(app)/field/page.test.ts.

const ACCESS_REQUIRED_HEADING = "Portal access required";
const ACCESS_REQUIRED_COPY = "Open the customer portal invitation from your contractor to continue.";
const ACCESS_REQUIRED_SHELL = "mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6";

function nullComponent() {
  return null;
}

function stubRequire(specifier: string) {
  if (specifier === "react/jsx-runtime") return jsxRuntime;
  if (specifier === "next/link") return { default: nullComponent };
  if (specifier === "lucide-react") {
    return new Proxy({}, { get: () => nullComponent });
  }
  if (specifier === "@/components/shared/status-badge") return { StatusBadge: nullComponent };
  if (specifier === "@/components/ui/badge") return { Badge: nullComponent };
  if (specifier === "@/components/ui/button") return { buttonVariants: () => "", Button: nullComponent };
  if (specifier === "@/components/ui/card") {
    return { Card: nullComponent, CardContent: nullComponent, CardHeader: nullComponent, CardTitle: nullComponent };
  }
  if (specifier === "@/components/shared/activity-timeline") return { ActivityTimeline: nullComponent };
  if (specifier === "@/components/proposals/proposal-selections-allowances-readonly") {
    return { ProposalSelectionsAllowancesReadonly: nullComponent };
  }
  if (specifier === "@/components/proposals/portal-proposal-approval-form") {
    return { PortalProposalApprovalForm: nullComponent };
  }
  if (specifier === "@/lib/api") {
    const expiredSession = async () => {
      throw new Error("Customer portal session is required");
    };
    return {
      ApiClientError: class extends Error {},
      getPortalProjects: expiredSession,
      getPortalProject: expiredSession,
      getPortalProposal: expiredSession,
      getPortalInvoice: expiredSession,
      getPortalContract: expiredSession,
    };
  }
  if (specifier === "@/lib/document-workflow") {
    return new Proxy({}, { get: () => () => "" });
  }
  if (specifier === "@/lib/utils") return { cn: (...parts: Array<unknown>) => parts.filter(Boolean).join(" ") };
  if (specifier === "@/app/(app)/projects/[id]/contracts/[contractId]/sign-form") {
    return { SignContractForm: nullComponent };
  }
  throw new Error(`Unexpected import: ${specifier}`);
}

async function renderPage(pagePath: string, props: Record<string, unknown>) {
  const source = await readFile(new URL(pagePath, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const moduleExports: Record<string, unknown> = {};
  vm.runInNewContext(compiled, {
    module: { exports: moduleExports },
    exports: moduleExports,
    require: stubRequire,
  });
  const page = moduleExports.default as (input: Record<string, unknown>) => Promise<ReturnType<typeof createElement>>;
  return renderToStaticMarkup(await page(props));
}

function assertAccessRequired(markup: string, forbidden: string) {
  assert.ok(markup.includes(ACCESS_REQUIRED_HEADING), "renders the access-required heading");
  assert.ok(markup.includes(ACCESS_REQUIRED_COPY), "renders the access-required copy");
  assert.ok(markup.includes(ACCESS_REQUIRED_SHELL), "reuses the home page access-required shell");
  assert.equal(markup.includes(forbidden), false, `does not render the success content (${forbidden})`);
}

test("portal home renders the access-required state when the session is expired", async () => {
  const markup = await renderPage("./page.tsx", {});
  assertAccessRequired(markup, "Your projects");
});

test("portal project detail renders the access-required state when the session is expired", async () => {
  const markup = await renderPage("./projects/[id]/page.tsx", { params: Promise.resolve({ id: "project-1" }) });
  assertAccessRequired(markup, "Shared documents");
});

test("portal proposal detail renders the access-required state when the session is expired", async () => {
  const markup = await renderPage("./proposals/[proposalId]/page.tsx", {
    params: Promise.resolve({ proposalId: "proposal-1" }),
  });
  assertAccessRequired(markup, "Proposal review");
});

test("portal invoice detail renders the access-required state when the session is expired", async () => {
  const markup = await renderPage("./invoices/[invoiceId]/page.tsx", {
    params: Promise.resolve({ invoiceId: "invoice-1" }),
  });
  assertAccessRequired(markup, "Invoice summary");
});

test("portal contract detail renders the access-required state when the session is expired", async () => {
  const markup = await renderPage("./contracts/[contractId]/page.tsx", {
    params: Promise.resolve({ contractId: "contract-1" }),
  });
  assertAccessRequired(markup, "Contract review");
});
