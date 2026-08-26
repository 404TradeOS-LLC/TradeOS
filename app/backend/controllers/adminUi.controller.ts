import { Request, Response } from "express";
import { z } from "zod";
import { verifyAuthToken } from "../auth/jwt";
import { resolveAuthContext } from "../auth/session";
import { AdminDashboardService } from "../../modules/admin-dashboard/service";
import { ApiError } from "../middleware/errorHandler";
import { OrganizationMembershipSnapshot } from "../../modules/admin-dashboard/types";
import { basePrisma } from "../../db/client";
import { runWithDatabaseSession } from "../../db/requestSession";

const service = new AdminDashboardService();
const HISTORY_PAGE_SIZE = 20;
const formSchema = z.object({
  bearerToken: z.string().trim().min(1),
  orgId: z.string().trim().min(1),
  membershipId: z.string().trim().min(1),
  actionType: z.enum(["created", "updated", "disabled"]).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  preset: z.enum(["7d", "30d"]).optional(),
  page: z.coerce.number().int().positive().default(1),
});

export const adminUiController = {
  async showMembershipHistoryForm(_req: Request, res: Response) {
    res.type("html").send(renderMembershipHistoryPage());
  },
  async submitMembershipHistoryForm(req: Request, res: Response) {
    try {
      const parsed = formSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).type("html").send(
          renderMembershipHistoryPage({
            input: extractFormFields(req.body),
            error: "Please provide a bearer token, organization id, and membership id.",
          })
        );
        return;
      }
      const input = applyDatePreset(parsed.data);
      const claims = verifyAuthToken(input.bearerToken, process.env.AUTH_JWT_SECRET ?? "");
      const auth = await resolveAuthContext(claims);
      if (auth.orgId !== input.orgId) {
        throw new ApiError(403, "Cross-organization access is not allowed");
      }
      if (!["owner", "admin"].includes(auth.role)) {
        throw new ApiError(403, "Admin access required");
      }

      const historyPage = await runWithDatabaseSession(basePrisma, auth, () =>
        service.listOrganizationMemberHistoryPage(input.orgId, input.membershipId, {
          actionType: input.actionType,
          dateFrom: parseDateInput(input.dateFrom),
          dateTo: parseDateInput(input.dateTo, true),
        }, input.page, HISTORY_PAGE_SIZE),
      "admin-ui:membership-history");
      res.type("html").send(renderMembershipHistoryPage({
        input: { ...input, page: historyPage.page },
        auth,
        historyPage,
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).type("html").send(
          renderMembershipHistoryPage({
            input: extractFormFields(req.body),
            error: error.message,
          })
        );
        return;
      }
      throw error;
    }
  },
};

function renderMembershipHistoryPage(state?: {
  input?: Partial<z.infer<typeof formSchema>>;
  auth?: { email?: string; orgId: string; role: string };
  error?: string;
  historyPage?: Awaited<ReturnType<AdminDashboardService["listOrganizationMemberHistoryPage"]>>;
}): string {
  const input = state?.input ?? {};
  const history = state?.historyPage?.items ?? [];
  const appliedFilters = getAppliedFilters(input);
  const hasSubmittedHistoryQuery = state?.historyPage !== undefined;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Membership History | TradeOS</title>
  <link rel="stylesheet" href="/admin/assets/admin.css" />
</head>
<body>
  <div class="admin-layout">
    <aside class="sidebar">
      <a class="brand" href="/admin" aria-label="TradeOS admin home"><strong>TRADE<span>OS</span></strong><small>Cost Book</small></a>
      <nav aria-label="Admin navigation">
        <a href="/admin">Overview</a>
        <a class="active" href="/admin/member-history" aria-current="page">Members</a>
        <a href="/admin/pricing-history">Pricing</a>
        <a class="active" href="/admin/member-history" aria-current="page">Audit trail</a>
      </nav>
      <div class="sidebar-foot"><span>TradeOS Cost Book</span><small>Internal administration</small></div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div><span class="building-mark" aria-hidden="true">▥</span>${escapeHtml(state?.auth ? `Organization ${state.auth.orgId}` : "Organization administration")}</div>
        <div class="identity">${state?.auth ? `${escapeHtml(state.auth.email ?? "Administrator")} <small>${escapeHtml(state.auth.role)}</small>` : "Secure internal access"}</div>
      </header>
      <main>
        <header class="page-heading">
          <div><h1>Membership History</h1><p>Inspect the audit trail for a single membership — newest first, with before/after snapshots for every role and status change.</p></div>
          <a class="secondary-action" href="/admin/pricing-history">Pricing &amp; Audit</a>
        </header>

        <section class="access-panel with-membership" aria-labelledby="access-title">
          <div><h2 id="access-title">Admin access</h2><p>Credentials stay in this request and are not stored by the browser.</p></div>
          <form method="post" action="/admin/member-history">
            <label>Bearer token<textarea name="bearerToken" rows="2" required>${escapeHtml(input.bearerToken ?? "")}</textarea></label>
            <label>Organization ID<input name="orgId" value="${escapeHtml(input.orgId ?? "")}" required /></label>
            <label>Membership ID<input name="membershipId" value="${escapeHtml(input.membershipId ?? "")}" required /></label>
            <button type="submit">View history</button>
          </form>
          ${state?.error ? `<p class="error" role="alert">${escapeHtml(state.error)}</p>` : ""}
        </section>

        <section class="data-panel" aria-labelledby="history-title">
          <form class="filters" method="post" action="/admin/member-history">
            <input type="hidden" name="bearerToken" value="${escapeHtml(input.bearerToken ?? "")}" />
            <input type="hidden" name="orgId" value="${escapeHtml(input.orgId ?? "")}" />
            <input type="hidden" name="membershipId" value="${escapeHtml(input.membershipId ?? "")}" />
            <label>Action type<input name="actionType" value="${escapeHtml(input.actionType ?? "")}" placeholder="updated" /></label>
            <label>From<input type="date" name="dateFrom" value="${escapeHtml(input.dateFrom ?? "")}" /></label>
            <label>To<input type="date" name="dateTo" value="${escapeHtml(input.dateTo ?? "")}" /></label>
            <label>Quick range<button class="outline-action" type="submit" name="preset" value="7d">Last 7 days</button></label>
            <label>&nbsp;<button class="outline-action" type="submit" name="preset" value="30d">Last 30 days</button></label>
            <button type="submit">Apply filters</button>
          </form>
          ${
            appliedFilters.length
              ? `<div class="filter-row">
                  <span>Active filters</span>
                  ${appliedFilters.map((filter) => renderFilterChip(input, filter)).join("")}
                  ${renderClearAllFilters(input)}
                </div>`
              : ""
          }
          <div class="panel-heading">
            <div><h2 id="history-title">Audit trail</h2><p>Entries are newest first and include the actor plus before/after snapshots for each membership change.</p></div>
            <span>${
              state?.historyPage
                ? `Showing <strong>${getPageStart(state.historyPage)}</strong>-<strong>${getPageEnd(state.historyPage)}</strong> of <strong>${state.historyPage.total}</strong>`
                : `Records loaded: <strong>0</strong>`
            }</span>
          </div>
          <div class="table-scroll">
            ${
              history.length
                ? `<table>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Before</th>
                        <th>After</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${history
                        .map(
                          (row) => `<tr>
                            <td>${escapeHtml(formatDate(row.createdAt))}</td>
                            <td>${escapeHtml(row.action)}</td>
                            <td>${escapeHtml(row.actorRole ?? "n/a")} ${row.actorUserId ? `(${escapeHtml(row.actorUserId)})` : ""}</td>
                            <td>${renderSnapshot(row.beforeState)}</td>
                            <td>${renderSnapshot(row.afterState)}</td>
                          </tr>`
                        )
                        .join("")}
                    </tbody>
                  </table>`
                : renderEmptyState(hasSubmittedHistoryQuery, appliedFilters.length > 0)
            }
          </div>
          ${state?.historyPage && state.historyPage.totalPages > 1 ? renderPagination(input, state.historyPage) : ""}
        </section>
      </main>
    </div>
  </div>
</body>
</html>`;
}

function extractFormFields(body: unknown): Partial<z.infer<typeof formSchema>> | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const bearerToken = typeof record.bearerToken === "string" ? record.bearerToken : undefined;
  const orgId = typeof record.orgId === "string" ? record.orgId : undefined;
  const membershipId = typeof record.membershipId === "string" ? record.membershipId : undefined;
  const actionType =
    record.actionType === "created" || record.actionType === "updated" || record.actionType === "disabled"
      ? record.actionType
      : undefined;
  const dateFrom = typeof record.dateFrom === "string" ? record.dateFrom : undefined;
  const dateTo = typeof record.dateTo === "string" ? record.dateTo : undefined;
  const preset = record.preset === "7d" || record.preset === "30d" ? record.preset : undefined;
  const pageValue = typeof record.page === "string" || typeof record.page === "number" ? Number(record.page) : 1;
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;

  if (!bearerToken && !orgId && !membershipId && !actionType && !dateFrom && !dateTo && !preset) {
    return undefined;
  }

  return { bearerToken, orgId, membershipId, actionType, dateFrom, dateTo, preset, page };
}

function renderSnapshot(snapshot: OrganizationMembershipSnapshot | null): string {
  if (!snapshot) {
    return `<span class="meta">-</span>`;
  }
  return `<details><summary>View snapshot</summary><pre>${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre></details>`;
}

type FilterKey = "actionType" | "dateFrom" | "dateTo";

interface AppliedFilter {
  key: FilterKey;
  label: string;
}

function getAppliedFilters(input: Partial<z.infer<typeof formSchema>>): AppliedFilter[] {
  const filters: AppliedFilter[] = [];

  if (input.actionType) {
    filters.push({ key: "actionType", label: `Action <strong>${escapeHtml(input.actionType)}</strong>` });
  }
  if (input.dateFrom) {
    filters.push({ key: "dateFrom", label: `From <strong>${escapeHtml(input.dateFrom)}</strong>` });
  }
  if (input.dateTo) {
    filters.push({ key: "dateTo", label: `To <strong>${escapeHtml(input.dateTo)}</strong>` });
  }

  return filters;
}

function renderFilterChip(input: Partial<z.infer<typeof formSchema>>, filter: AppliedFilter): string {
  return `<form class="chip chip-form" method="post" action="/admin/member-history">
    ${renderHiddenFields(input, [filter.key, "page"])}
    <span>${filter.label}</span>
    <button class="chip-clear" type="submit" aria-label="Clear ${filter.key} filter">Clear</button>
  </form>`;
}

function renderClearAllFilters(input: Partial<z.infer<typeof formSchema>>): string {
  return `<form class="chip-form" method="post" action="/admin/member-history">
    ${renderHiddenFields(input, ["actionType", "dateFrom", "dateTo", "page"])}
    <button class="button-secondary" type="submit">Clear all filters</button>
  </form>`;
}

function renderPagination(
  input: Partial<z.infer<typeof formSchema>>,
  historyPage: Awaited<ReturnType<AdminDashboardService["listOrganizationMemberHistoryPage"]>>
): string {
  return `<div class="pagination">
    <span class="meta">Page <strong>${historyPage.page}</strong> of <strong>${historyPage.totalPages}</strong></span>
    <form class="pagination-form" method="post" action="/admin/member-history">
      ${renderHiddenFields(input, ["page"])}
      <button class="button-secondary" type="submit" name="page" value="${historyPage.page - 1}" ${historyPage.page === 1 ? "disabled" : ""}>Previous</button>
      <button class="button-secondary" type="submit" name="page" value="${historyPage.page + 1}" ${historyPage.page === historyPage.totalPages ? "disabled" : ""}>Next</button>
    </form>
  </div>`;
}

function renderHiddenFields(input: Partial<z.infer<typeof formSchema>>, omitted: Array<keyof z.infer<typeof formSchema>> = []): string {
  const fields: Array<keyof z.infer<typeof formSchema>> = [
    "bearerToken",
    "orgId",
    "membershipId",
    "actionType",
    "dateFrom",
    "dateTo",
    "page",
  ];
  return fields
    .filter((field) => !omitted.includes(field) && input[field] !== undefined && input[field] !== "")
    .map((field) => `<input type="hidden" name="${field}" value="${escapeHtml(String(input[field]))}" />`)
    .join("");
}

function applyDatePreset(input: z.infer<typeof formSchema>, now = new Date()): z.infer<typeof formSchema> {
  if (!input.preset) {
    return input;
  }
  const days = input.preset === "7d" ? 7 : 30;
  const dateTo = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dateFrom = new Date(dateTo);
  dateFrom.setUTCDate(dateFrom.getUTCDate() - (days - 1));
  return {
    ...input,
    dateFrom: formatDateInput(dateFrom),
    dateTo: formatDateInput(dateTo),
    preset: undefined,
    page: 1,
  };
}

function parseDateInput(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) {
    return undefined;
  }
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
}

function formatDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getPageStart(historyPage: { total: number; page: number; pageSize: number }): number {
  return historyPage.total === 0 ? 0 : (historyPage.page - 1) * historyPage.pageSize + 1;
}

function getPageEnd(historyPage: { total: number; page: number; pageSize: number }): number {
  return Math.min(historyPage.page * historyPage.pageSize, historyPage.total);
}

function renderEmptyState(hasSubmittedHistoryQuery: boolean, hasAppliedFilters: boolean): string {
  if (hasSubmittedHistoryQuery) {
    return `<div class="empty">
      <strong>No audit entries matched this search.</strong>
      <span>${hasAppliedFilters ? "Try widening the date range or clearing one of the active filters." : "This membership does not have any recorded audit entries yet."}</span>
    </div>`;
  }

  return `<div class="empty">
    <strong>No membership history loaded yet.</strong>
    <span>Submit the form above to inspect a membership audit trail.</span>
  </div>`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
