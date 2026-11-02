import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CRM_SOURCE_TIMEOUT_MS,
  createCrmLoadSignal,
  loadCrmPageData,
  loadCustomersPageData,
} from "./customer-page-load.ts";

function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

const timeoutError = () => {
  const error = new Error("The operation timed out.");
  error.name = "TimeoutError";
  return error;
};

test("CRM overview reads share one bounded timeout signal", () => {
  assert.ok(CRM_SOURCE_TIMEOUT_MS >= 15_000, "bound must be at least 15 seconds");
  assert.ok(CRM_SOURCE_TIMEOUT_MS <= 30_000, "bound must be at most 30 seconds");
  assert.equal(CRM_SOURCE_TIMEOUT_MS, 20_000);
  assert.equal(createCrmLoadSignal().aborted, false);
});

test("CRM overview load shares one signal across all five sources", async () => {
  const seenSignals: AbortSignal[] = [];
  const capture = async <T>(value: T, signal: AbortSignal): Promise<T> => {
    seenSignals.push(signal);
    return value;
  };

  const results = await loadCrmPageData("token", {
    listProjects: (token, signal) => {
      assert.equal(token, "token");
      return capture([{ id: "project-1" }], signal);
    },
    listCustomers: (token, signal) => {
      assert.equal(token, "token");
      return capture([{ id: "customer-1" }], signal);
    },
    listOrganizationProjectTasks: (token, signal) => {
      assert.equal(token, "token");
      return capture([{ id: "task-1" }], signal);
    },
    listProposalQueue: (token, signal) => {
      assert.equal(token, "token");
      return capture({ items: [{ id: "proposal-1" }], nextCursor: null, total: 1 }, signal);
    },
    listActivityEvents: (token, signal) => {
      assert.equal(token, "token");
      return capture([{ id: "event-1" }], signal);
    },
  });

  assert.equal(seenSignals.length, 5);
  for (const signal of seenSignals) {
    assert.equal(signal, seenSignals[0], "all five sources must share one timeout signal");
    assert.equal(signal.aborted, false);
  }
  assert.deepEqual(
    results.map((result) => result.status),
    ["fulfilled", "fulfilled", "fulfilled", "fulfilled", "fulfilled"],
  );
});

test("CRM overview load degrades a timed-out source to a rejected result instead of hanging", async () => {
  const results = await loadCrmPageData("token", {
    listProjects: async () => {
      throw timeoutError();
    },
    listCustomers: async () => [{ id: "customer-1" }],
    listOrganizationProjectTasks: async () => [],
    listProposalQueue: async () => ({ items: [], nextCursor: null, total: 0 }),
    listActivityEvents: async () => [],
  });

  // The page's existing per-source banner logic keys off rejected results,
  // so a timeout must surface as rejected — never as a thrown page failure.
  assert.equal(results[0]?.status, "rejected");
  assert.equal(results[1]?.status, "fulfilled");
});

test("CRM overview page wires the bounded loader and keeps the fallback banner", () => {
  const source = readSource("../app/(app)/crm/page.tsx");

  assert.match(source, /loadCrmPageData\(token/);
  assert.match(source, /Customers are temporarily unavailable\./);
  assert.match(source, /Projects are temporarily unavailable\./);
  assert.doesNotMatch(source, /Promise\.allSettled\(\[/);
});

test("customers load degrades a list error to an empty list plus a failure flag", async () => {
  const outcome = await loadCustomersPageData("token", {
    listCustomers: async () => {
      throw new Error("backend unavailable");
    },
    getOrganizationSettings: async () => ({ currentRole: "owner" }),
  });

  assert.deepEqual(outcome.customers, []);
  assert.equal(outcome.customersFailed, true);
  assert.deepEqual(outcome.settings, { currentRole: "owner" });
});

test("customers load passes the list through unchanged on success", async () => {
  const outcome = await loadCustomersPageData("token", {
    listCustomers: async () => [{ id: "customer-1" }],
    getOrganizationSettings: async () => {
      throw new Error("settings unavailable");
    },
  });

  assert.deepEqual(outcome.customers, [{ id: "customer-1" }]);
  assert.equal(outcome.customersFailed, false);
  assert.equal(outcome.settings, null);
});

test("customers page wires the guarded loader and renders the fallback banner", () => {
  const source = readSource("../app/(app)/customers/page.tsx");

  assert.match(source, /loadCustomersPageData\(token/);
  assert.match(source, /Customers are temporarily unavailable\. Try reloading the page\./);
  assert.match(source, /<CustomerDirectory customers=\{customers\} \/>/);
});
