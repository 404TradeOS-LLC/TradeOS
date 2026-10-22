import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

async function renderDeniedPage(token: string | null, role: string) {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const calls: string[] = [];
  const forbidden = (name: string) => async () => {
    calls.push(name);
    throw new Error(`Unauthorized page requested ${name}`);
  };
  const exports: Record<string, unknown> = {};
  const unusedComponent = () => null;
  vm.runInNewContext(compiled, {
    exports,
    require(specifier: string) {
      if (specifier === "react/jsx-runtime") return jsxRuntime;
      if (specifier === "@/lib/session") return { getSessionToken: async () => token };
      if (specifier === "@/lib/api") return {
        ApiClientError: class extends Error {},
        getOrganizationSettings: async () => { calls.push("settings"); return { currentRole: role, settings: { timezone: "UTC" } }; },
        getDispatchSummary: forbidden("summary"), listFieldJobs: forbidden("list"), getFieldJob: forbidden("detail"),
      };
      if (specifier === "@/components/ui/empty-state") return {
        EmptyState: ({ title }: { title: string }) => createElement("h1", null, title),
      };
      if (specifier === "@/components/field/field-job-actions") return { FieldJobActions: unusedComponent };
      if (specifier === "@/components/field/field-note-form") return { FieldNoteForm: unusedComponent };
      if (specifier === "@/components/shared/status-badge") return { StatusBadge: unusedComponent };
      if (specifier === "@/lib/document-workflow" || specifier === "@/lib/field-workspace") {
        return new Proxy({}, { get: (_target, name) => () => { throw new Error(`Denied page reached ${String(name)}`); } });
      }
      throw new Error(`Unexpected import: ${specifier}`);
    },
  });
  const page = exports.default as (props: { searchParams: Promise<{ job: string }> }) => Promise<ReturnType<typeof createElement>>;
  const result = await page({ searchParams: Promise.resolve({ job: "unassigned-direct-link" }) });
  return { markup: renderToStaticMarkup(result), calls };
}

test("unauthenticated Field requests return before settings or any job request", async () => {
  const result = await renderDeniedPage(null, "technician");
  assert.match(result.markup, /Sign in to view your field day/);
  assert.deepEqual(result.calls, []);
});

// Settings returns a canonical role, not the raw persisted membership role.
// Legacy viewer normalizes to technician; never assert that it is denied here.
for (const role of ["owner", "admin", "manager", "dispatcher"]) {
  test(`Field role ${role || "missing"} cannot fetch jobs even with a direct job link`, async () => {
    const result = await renderDeniedPage("authenticated-token", role);
    assert.match(result.markup, /Technician workspace/);
    assert.deepEqual(result.calls, ["settings"]);
  });
}

test("legacy viewer is canonicalized to technician before the Field page receives settings", async () => {
  const contracts = await readFile(new URL("../../../../../app/domain/contracts.ts", import.meta.url), "utf8");
  const normalized = ts.transpileModule(contracts, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exported: Record<string, unknown> = {};
  vm.runInNewContext(normalized, { exports: exported });
  const normalizeRole = exported.normalizeRole as (role: string) => string;
  assert.equal(normalizeRole("viewer"), "technician");
  assert.equal(normalizeRole("estimator"), "dispatcher");
  // Execute the actual settings producer with a legacy membership and isolated reads.
  const settingsSource = await readFile(new URL("../../../../../app/modules/settings/service.ts", import.meta.url), "utf8");
  const settingsCompiled = ts.transpileModule(settingsSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const settingsExports: Record<string, unknown> = {};
  const db = {
    organization: { findUnique: async () => ({ id: "org-1", name: "", phone: null, address: null, logoUrl: null }) },
    organizationSettings: { findUnique: async () => null },
    brandProfile: { findUnique: async () => null },
  };
  vm.runInNewContext(settingsCompiled, {
    exports: settingsExports,
    require(specifier: string) {
      if (specifier === "../admin-dashboard/service") return { AdminDashboardService: class {} };
      if (specifier === "../../db/client") return { prisma: db };
      if (specifier === "../../db/requestSession") return { runInDatabaseTransaction: async () => { throw new Error("Unexpected write"); } };
      if (specifier === "../../backend/middleware/errorHandler") return { ApiError: class extends Error {} };
      if (specifier === "../../domain") return {
        canonicalRoles: ["owner", "admin", "dispatcher", "technician"],
        isLegacyRole: (value: string) => value === "viewer" || value === "estimator",
        normalizeRole,
      };
      if (specifier === "@prisma/client") return { Prisma: {} };
      throw new Error(`Unexpected settings import: ${specifier}`);
    },
  });
  const SettingsService = settingsExports.OrganizationSettingsService as new () => {
    getSettings(orgId: string, auth: { userId: string; role: string }): Promise<{ currentRole: string }>;
  };
  const settings = await new SettingsService().getSettings("org-1", { userId: "legacy-tech", role: "viewer" });
  assert.equal(settings.currentRole, "technician");
  // The page receives settings.currentRole, not the raw persisted membership.
  // Backend assignment and forced-RLS tests independently cover job authorization.
});
