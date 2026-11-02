import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jobExpensesLib from "../../lib/job-expenses.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("./job-expense-section.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function renderSection(props: Record<string, unknown>) {
  const runtime: { exports: Record<string, unknown> } = { exports: {} };
  vm.runInNewContext(code, {
    module: runtime,
    exports: runtime.exports,
    Intl,
    Date,
    require: (name: string) => {
      if (name === "react/jsx-runtime") return require(name);
      if (name === "@/components/field/job-expense-form") return { JobExpenseForm: () => React.createElement("form", null, "Expense form") };
      if (name === "@/lib/job-expenses") return jobExpensesLib;
      throw new Error(`Unexpected job expense section dependency: ${name}`);
    },
  });
  const section = runtime.exports.JobExpenseSection as (input: Record<string, unknown>) => React.ReactNode;
  return renderToStaticMarkup(section(props));
}

const summary = {
  jobId: "job-1",
  projectId: "project-1",
  expenseCount: 2,
  actualCents: 7000,
  byCategoryCents: { material: 2000, labor: 5000 },
  estimatedCents: 97510,
  estimateId: "estimate-9",
  varianceCents: 90510,
};

const expenses = [
  { id: "e1", jobId: "job-1", orgId: "org-1", amountCents: 2000, category: "material", vendor: "ABC Supply", receiptNote: "Shingles", incurredOn: "2026-11-01", createdById: "u1", createdAt: "2026-11-01T12:00:00.000Z", updatedAt: "2026-11-01T12:00:00.000Z" },
  { id: "e2", jobId: "job-1", orgId: "org-1", amountCents: 5000, category: "labor", vendor: "", receiptNote: "", incurredOn: "2026-10-31", createdById: "u1", createdAt: "2026-10-31T12:00:00.000Z", updatedAt: "2026-10-31T12:00:00.000Z" },
];

test("job expense section renders actual-vs-estimate rollup, expense list, and add form", () => {
  const html = renderSection({ jobId: "job-1", expenses, summary, loadError: null, defaultIncurredOn: "2026-11-02" });
  for (const text of ["Actual costs", "$70.00", "$975.10", "$905.10", "Materials", "ABC Supply", "Shingles", "Nov 1, 2026", "Expense form"]) {
    assert.ok(html.includes(text), text);
  }
  assert.equal(html.includes("No expenses recorded"), false);
});

test("job costs separate customer-paid material from contractor actuals", () => {
  const html = renderSection({
    jobId: "job-1",
    expenses: [
      { ...expenses[0], amountCents: 2500, paymentResponsibility: "contractor" },
      { ...expenses[1], amountCents: 4000, category: "material", paymentResponsibility: "customer" },
    ],
    summary: { ...summary, actualCents: 2500, customerPaidCents: 4000, byCategoryCents: { material: 2500 }, varianceCents: 95010 },
    loadError: null,
    defaultIncurredOn: "2026-11-02",
  });
  assert.ok(html.includes("Contractor-paid"), "contractor cost metric must be explicitly labeled");
  assert.ok(html.includes("Customer-paid"), "customer purchases must be separately totaled");
  assert.ok(html.includes("$40.00"), "customer-paid total remains visible");
  assert.ok(html.includes("Customer paid"), "expense history identifies who paid");
});

test("job expense section reports no estimate instead of a fabricated zero", () => {
  const html = renderSection({ jobId: "job-1", expenses: [], summary: { ...summary, expenseCount: 0, actualCents: 0, estimatedCents: null, estimateId: null, varianceCents: null }, loadError: null, defaultIncurredOn: "2026-11-02" });
  assert.ok(html.includes("No estimate"));
  assert.ok(html.includes("No expenses recorded for this job yet."));
});

test("job expense section flags over-estimate spend and degrades on load failure", () => {
  const html = renderSection({ jobId: "job-1", expenses, summary: { ...summary, actualCents: 100000, varianceCents: -2490 }, loadError: "Job costs couldn't load.", defaultIncurredOn: "2026-11-02" });
  assert.ok(html.includes("$24.90 over"));
  assert.ok(html.includes("Job costs couldn&#x27;t load."));
});
