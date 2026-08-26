import {
  MaterialPriceAuditDTO,
  OrganizationMembershipAuditDTO,
  PricingUpdateSummary,
} from "../../modules/admin-dashboard/types";

export interface AdminPricingInput {
  bearerToken?: string;
  orgId?: string;
  materialQuery?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  staleSinceDays?: number;
}

export interface AdminPricingState {
  input?: AdminPricingInput;
  auth?: { email?: string; orgId: string; role: string };
  summary?: PricingUpdateSummary;
  priceHistory?: MaterialPriceAuditDTO[];
  membershipActivity?: OrganizationMembershipAuditDTO[];
  error?: string;
}

export function renderAdminPricingShell(state: AdminPricingState = {}): string {
  const input = state.input ?? {};
  const history = state.priceHistory ?? [];
  const activity = state.membershipActivity ?? [];
  const staleCount = state.summary?.staleMaterialsCount ?? 0;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pricing & Audit | TradeOS</title>
  <link rel="stylesheet" href="/admin/assets/admin.css" />
</head>
<body>
  <div class="admin-layout">
    <aside class="sidebar">
      <a class="brand" href="/admin" aria-label="TradeOS admin home"><strong>TRADE<span>OS</span></strong><small>Cost Book</small></a>
      <nav aria-label="Admin navigation">
        <a href="/admin">Overview</a>
        <a href="/admin/member-history">Members</a>
        <a class="active" href="/admin/pricing-history" aria-current="page">Pricing</a>
        <a href="/admin/member-history">Audit trail</a>
      </nav>
      <div class="sidebar-foot"><span>TradeOS Cost Book</span><small>Internal administration</small></div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div><span class="building-mark" aria-hidden="true">▥</span>${escapeHtml(state.auth ? `Organization ${state.auth.orgId}` : "Organization administration")}</div>
        <div class="identity">${state.auth ? `${escapeHtml(state.auth.email ?? "Administrator")} <small>${escapeHtml(state.auth.role)}</small>` : "Secure internal access"}</div>
      </header>
      <main>
        <header class="page-heading">
          <div><h1>Pricing &amp; Audit</h1><p>Review stale material pricing, trace cost changes, and monitor membership activity.</p></div>
          <a class="secondary-action" href="/admin/member-history">Membership history</a>
        </header>

        <section class="access-panel" aria-labelledby="access-title">
          <div><h2 id="access-title">Admin access</h2><p>Credentials stay in this request and are not stored by the browser.</p></div>
          <form method="post" action="/admin/pricing-history">
            <label>Bearer token<textarea name="bearerToken" rows="2" required>${escapeHtml(input.bearerToken ?? "")}</textarea></label>
            <label>Organization ID<input name="orgId" value="${escapeHtml(input.orgId ?? "")}" required /></label>
            <button type="submit">Load workspace</button>
          </form>
          ${state.error ? `<p class="error" role="alert">${escapeHtml(state.error)}</p>` : ""}
        </section>

        <section aria-labelledby="summary-title">
          <h2 class="section-title" id="summary-title">Stale price summary</h2>
          <div class="summary-strip">
            <article class="metric warning"><span>Stale materials</span><strong>${staleCount}</strong><small>Older than ${input.staleSinceDays ?? 30} days</small></article>
            <article class="metric"><span>Recorded changes</span><strong>${history.length}</strong><small>In the current result</small></article>
            <article class="metric"><span>Recent member events</span><strong>${activity.length}</strong><small>Newest organization activity</small></article>
          </div>
        </section>

        <div class="content-grid">
          <section class="data-panel" aria-labelledby="price-history-title">
            <form class="filters" method="post" action="/admin/pricing-history">
              <input type="hidden" name="bearerToken" value="${escapeHtml(input.bearerToken ?? "")}" />
              <input type="hidden" name="orgId" value="${escapeHtml(input.orgId ?? "")}" />
              <label>Material<input name="materialQuery" value="${escapeHtml(input.materialQuery ?? "")}" placeholder="Search material name" /></label>
              <label>Source<input name="source" value="${escapeHtml(input.source ?? "")}" placeholder="manual" /></label>
              <label>From<input type="date" name="dateFrom" value="${escapeHtml(input.dateFrom ?? "")}" /></label>
              <label>To<input type="date" name="dateTo" value="${escapeHtml(input.dateTo ?? "")}" /></label>
              <label>Stale after<input type="number" min="1" max="3650" name="staleSinceDays" value="${input.staleSinceDays ?? 30}" /></label>
              <button type="submit">Apply filters</button>
            </form>
            <div class="panel-heading"><div><h2 id="price-history-title">Material price history</h2><p>Immutable changes, newest first.</p></div><span>${history.length} records</span></div>
            <div class="table-scroll">
              ${renderPriceHistory(history)}
            </div>
          </section>

          <aside class="activity-panel" aria-labelledby="activity-title">
            <div class="panel-heading"><div><h2 id="activity-title">Recent membership activity</h2><p>Latest role and status changes.</p></div></div>
            ${renderMembershipActivity(activity)}
            <a class="outline-action" href="/admin/member-history">View full audit trail</a>
          </aside>
        </div>
      </main>
    </div>
  </div>
</body>
</html>`;
}

function renderPriceHistory(rows: MaterialPriceAuditDTO[]): string {
  if (!rows.length) {
    return `<div class="empty-state"><strong>No price changes found</strong><span>Update a material price or broaden the current filters.</span></div>`;
  }
  return `<table>
    <thead><tr><th>Material</th><th>Previous</th><th>New price</th><th>Change</th><th>Source</th><th>Actor</th><th>Effective date</th></tr></thead>
    <tbody>${rows.map((row) => {
      const delta = row.newUnitCost - row.oldUnitCost;
      const deltaClass = delta > 0 ? "increase" : delta < 0 ? "decrease" : "neutral";
      return `<tr>
        <td><strong>${escapeHtml(row.materialName)}</strong><small>${escapeHtml(row.materialId)}</small></td>
        <td>${formatCurrency(row.oldUnitCost)}</td>
        <td>${formatCurrency(row.newUnitCost)}</td>
        <td><span class="delta ${deltaClass}">${delta >= 0 ? "+" : ""}${formatCurrency(delta)}</span></td>
        <td>${escapeHtml(row.source)}</td>
        <td>${escapeHtml(row.actorRole ?? "system")}</td>
        <td>${escapeHtml(formatDate(row.createdAt))}</td>
      </tr>`;
    }).join("")}</tbody>
  </table>`;
}

function renderMembershipActivity(rows: OrganizationMembershipAuditDTO[]): string {
  if (!rows.length) return `<div class="empty-state compact"><strong>No activity loaded</strong><span>Authenticate to load recent events.</span></div>`;
  return `<ol class="activity-list">${rows.map((row) => {
    const target = row.afterState ?? row.beforeState;
    return `<li><span class="avatar">${escapeHtml(getInitials(target?.fullName ?? target?.email ?? "User"))}</span><div><strong>${escapeHtml(target?.fullName ?? target?.email ?? "Member")}</strong><p>${escapeHtml(describeMembershipAction(row))}</p><small>${escapeHtml(formatDate(row.createdAt))}</small></div></li>`;
  }).join("")}</ol>`;
}

function describeMembershipAction(row: OrganizationMembershipAuditDTO): string {
  if (row.action === "created") return `Added as ${row.afterState?.role ?? "member"}`;
  if (row.action === "disabled") return "Membership disabled";
  const before = row.beforeState;
  const after = row.afterState;
  if (before?.role !== after?.role) return `Role changed from ${before?.role ?? "unknown"} to ${after?.role ?? "unknown"}`;
  return `Status changed to ${after?.status ?? "updated"}`;
}

function getInitials(value: string): string {
  return value.split(/\s+|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}

export const adminShellCss = `
:root{--ink:#102131;--nav:#0c2131;--nav-2:#12314a;--paper:#f7f5ef;--surface:#fffefa;--line:#d8d7d1;--muted:#68737b;--orange:#e95a13;--blue:#285d83;--green:#25765f;--danger:#a83a20}
*{box-sizing:border-box}body{margin:0;color:var(--ink);background:var(--paper);font-family:"Gill Sans","Trebuchet MS",sans-serif}.admin-layout{min-height:100vh;display:grid;grid-template-columns:210px minmax(0,1fr)}.sidebar{position:sticky;top:0;height:100vh;background:linear-gradient(180deg,var(--nav),#091925);color:#d9e0e4;padding:28px 0 22px;display:flex;flex-direction:column}.brand{color:#fff;text-decoration:none;padding:0 26px 42px;display:grid;gap:1px}.brand strong{font:800 1.65rem/1 "Avenir Next Condensed","DIN Condensed",sans-serif;letter-spacing:.06em}.brand strong span{color:var(--orange)}.brand small{text-transform:uppercase;letter-spacing:.22em;color:#9cabb5}.sidebar nav{display:grid;gap:6px}.sidebar nav a{color:#b7c3ca;text-decoration:none;padding:14px 26px;border-left:4px solid transparent}.sidebar nav a:hover,.sidebar nav a:focus-visible{background:rgba(255,255,255,.06);color:#fff}.sidebar nav a.active{color:#fff;background:var(--nav-2);border-left-color:var(--orange);font-weight:700}.sidebar-foot{margin:auto 22px 0;padding-top:18px;border-top:1px solid #2b4150;display:grid;gap:5px;color:#b7c3ca}.sidebar-foot small{color:#748894}.workspace{min-width:0;background-color:var(--paper);background-image:linear-gradient(rgba(30,65,88,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(30,65,88,.035) 1px,transparent 1px);background-size:24px 24px}.topbar{height:68px;background:rgba(255,255,255,.92);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 28px;font-weight:700}.building-mark{font-size:1.35rem;margin-right:10px}.identity{display:grid;text-align:right}.identity small{color:var(--muted);font-weight:400}main{padding:32px 30px 56px;max-width:1600px;margin:0 auto}.page-heading{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:24px}.page-heading h1{margin:0;font:900 clamp(2.6rem,5vw,4.6rem)/.88 "Avenir Next Condensed","DIN Condensed",sans-serif;text-transform:uppercase;letter-spacing:-.02em}.page-heading p,.panel-heading p,.access-panel p{color:var(--muted);margin:.65rem 0 0}.secondary-action,.outline-action{border:1px solid var(--ink);color:var(--ink);text-decoration:none;padding:11px 15px;text-transform:uppercase;letter-spacing:.05em;font-size:.78rem;font-weight:800}.access-panel{background:var(--surface);border:1px solid var(--line);padding:18px;display:grid;grid-template-columns:minmax(180px,.7fr) minmax(500px,2fr);gap:20px;align-items:end;margin-bottom:26px}.access-panel h2,.panel-heading h2{margin:0;font:800 1.15rem/1.1 "Avenir Next Condensed","DIN Condensed",sans-serif;text-transform:uppercase;letter-spacing:.04em}.access-panel form{display:grid;grid-template-columns:minmax(260px,2fr) minmax(180px,1fr) auto;gap:12px;align-items:end}label{display:grid;gap:6px;font-size:.76rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}input,textarea{width:100%;border:1px solid #bfc3c3;background:#fff;padding:10px 11px;color:var(--ink);font:400 .92rem/1.3 "Gill Sans","Trebuchet MS",sans-serif}textarea{resize:vertical}input:focus-visible,textarea:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid rgba(40,93,131,.28);outline-offset:2px}button{border:0;background:var(--orange);color:#fff;padding:11px 18px;font:800 .78rem/1 "Gill Sans",sans-serif;text-transform:uppercase;letter-spacing:.05em;cursor:pointer}.error{grid-column:1/-1;color:var(--danger);font-weight:700}.section-title{font:800 .95rem/1 "Avenir Next Condensed","DIN Condensed",sans-serif;text-transform:uppercase;letter-spacing:.05em}.summary-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}.metric{background:var(--surface);border:1px solid var(--line);padding:18px;display:grid;gap:6px}.metric.warning{border-color:var(--orange)}.metric span,.metric small{color:var(--muted)}.metric strong{font:900 2.4rem/1 "Avenir Next Condensed","DIN Condensed",sans-serif}.metric.warning strong{color:var(--orange)}.content-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px}.data-panel,.activity-panel{background:var(--surface);border:1px solid var(--line);padding:16px}.filters{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr .7fr auto;gap:10px;align-items:end;padding-bottom:18px;border-bottom:1px solid var(--line)}.panel-heading{display:flex;justify-content:space-between;align-items:start;gap:16px;padding:18px 4px 12px}.panel-heading>span{color:var(--muted);font-size:.8rem}.table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:820px}th,td{padding:12px 10px;border:1px solid var(--line);text-align:left;font-size:.82rem;vertical-align:top}th{background:#f2f1ec;font-size:.7rem;text-transform:uppercase;letter-spacing:.04em}td strong,td small{display:block}td small{color:var(--muted);margin-top:4px;max-width:180px;overflow:hidden;text-overflow:ellipsis}.delta{font-weight:800}.delta.increase{color:var(--danger)}.delta.decrease{color:var(--green)}.activity-list{list-style:none;margin:0;padding:0}.activity-list li{display:grid;grid-template-columns:38px 1fr;gap:10px;padding:14px 2px;border-bottom:1px solid var(--line)}.avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--blue);color:#fff;font-size:.74rem;font-weight:800}.activity-list p{margin:4px 0;color:var(--muted);font-size:.86rem;line-height:1.35}.activity-list small{color:var(--muted)}.outline-action{display:block;text-align:center;margin-top:18px}.empty-state{padding:42px 18px;display:grid;gap:7px;text-align:center;color:var(--muted);border:1px dashed var(--line)}.empty-state strong{color:var(--ink)}.empty-state.compact{padding:24px 12px}
.data-panel,.activity-panel{min-width:0}.table-scroll{max-width:100%}
.access-panel.with-membership form{grid-template-columns:minmax(220px,1.6fr) minmax(140px,.8fr) minmax(140px,.8fr) auto}
.filter-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:14px 0 0}
.chip{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid var(--line);background:var(--surface);font-size:.78rem;color:var(--muted)}
.chip strong{color:var(--ink)}
.chip-form,.pagination-form{display:inline-flex;gap:8px;align-items:center}
.chip-clear{border:1px solid var(--line);background:#fff;color:var(--muted);padding:4px 9px;font-size:.7rem;text-transform:none;font-weight:600;letter-spacing:0;cursor:pointer}
button.outline-action,button.secondary-action{background:none}
.pagination{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}
details summary{cursor:pointer;color:var(--blue);font-weight:700;font-size:.78rem}
pre{margin:6px 0 0;white-space:pre-wrap;word-break:break-word;font-size:.76rem;background:#f2f1ec;border:1px solid var(--line);padding:8px;max-width:320px}
@media(max-width:1100px){.content-grid{grid-template-columns:1fr}.filters{grid-template-columns:repeat(3,1fr)}.activity-panel{max-width:none}.access-panel,.access-panel.with-membership{grid-template-columns:1fr}.access-panel form,.access-panel.with-membership form{grid-template-columns:1fr 1fr auto}}
@media(max-width:760px){.admin-layout{grid-template-columns:1fr}.sidebar{position:static;height:auto;padding:16px;min-width:0}.brand{padding:0 0 16px}.sidebar nav{display:flex;overflow-x:auto;min-width:0}.sidebar nav a{border-left:0;border-bottom:3px solid transparent;padding:10px 14px;white-space:nowrap}.sidebar nav a.active{border-bottom-color:var(--orange)}.sidebar-foot{display:none}.topbar{height:auto;padding:14px 18px;gap:14px}.topbar>div:first-child{display:none}main{padding:24px 16px}.page-heading{align-items:start;flex-direction:column}.page-heading h1{font-size:3.25rem}.access-panel form,.access-panel.with-membership form,.filters,.summary-strip{grid-template-columns:1fr}.secondary-action{align-self:stretch;text-align:center}.pagination{flex-direction:column;align-items:stretch}}
`;
