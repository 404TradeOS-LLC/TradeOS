import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Exercise the source-controlled staging v6-derived candidate without
// live credentials or network. DB calls use a fake BYPASSRLS service key, so
// all denials below must come from the function's authorization logic.
const edgeSource = readFileSync(
  resolve(__dirname, "../../supabase/functions/team-time/index.ts"), "utf8",
);
const orgA = "10000000-0000-4000-8000-000000000001";
const orgB = "20000000-0000-4000-8000-000000000002";
const userA = "10000000-0000-4000-8000-000000000011";
const userB = "20000000-0000-4000-8000-000000000021";
const jobA = "10000000-0000-4000-8000-000000000081";
const shiftB = "20000000-0000-4000-8000-000000000112";

type Call = { table: string; method: string; orgFilter: string | null; key: string | null; offset: string | null; query: string };
function harness({
  actorId = userA, role = "technician", membershipOrg = orgA,
  assigned = false, shiftsCount = 0, assignmentDeclined = false, distinctJobs = 0, modernKeys = false,
}: {
  actorId?: string; role?: string; membershipOrg?: string; assigned?: boolean; shiftsCount?: number; assignmentDeclined?: boolean; distinctJobs?: number; modernKeys?: boolean;
} = {}) {
  // Fixture job IDs the bootstrap can discover through assignments/shifts.
  // Distinct valid UUIDs so the jobs in-list filter is meaningful.
  const fixtureJobIds = distinctJobs > 0
    ? Array.from({length: distinctJobs}, (_, i) => `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`)
    : [jobA];
  let handle: ((request: Request) => Promise<Response>) | undefined;
  const calls: Call[] = [];
  const transport = async (input: URL | string, init: RequestInit = {}): Promise<Response> => {
    const u = new URL(String(input));
    if (u.pathname === "/auth/v1/user") return Response.json({ id: actorId });
    if (!u.pathname.startsWith("/rest/v1/")) throw new Error("Unexpected upstream path");
    const table = u.pathname.slice("/rest/v1/".length);
    const h = new Headers(init.headers);
    calls.push({ table, method: init.method ?? "GET", orgFilter: u.searchParams.get("org_id"), key: h.get("apikey"), offset: u.searchParams.get("offset"), query: u.search });
    if (table === "users") return Response.json([{ id: actorId, auth_subject: actorId, full_name: "Test Worker", is_active: true }]);
    if (table === "organization_memberships") {
      const wantedOrg = u.searchParams.get("org_id");
      if (wantedOrg && wantedOrg !== `eq.${membershipOrg}`) return Response.json([]);
      const wantedUser = u.searchParams.get("user_id");
      if (wantedUser && wantedUser !== `eq.${actorId}`) return Response.json([]);
      return Response.json([{ org_id: membershipOrg, role, user_id: actorId, status: "active" }]);
    }
    if (table === "team_time_profiles") return Response.json([{org_id: membershipOrg, user_id: actorId, active: true, worker_type:"employee"}]);
    if (table === "jobs") {
      // Honor the id=in.(...) filter like real PostgREST: only matching rows
      // come back, so a test cannot pass while requesting one job and
      // receiving hundreds.
      const wanted = u.searchParams.get("id");
      const wantedIds = wanted && wanted.startsWith("in.(") && wanted.endsWith(")")
        ? new Set(wanted.slice(4, -1).split(",").filter(Boolean))
        : null;
      const rows = fixtureJobIds
        .filter((id) => !wantedIds || wantedIds.has(id))
        .map((id) => ({ id, org_id: membershipOrg, title: id === jobA ? "Assigned Job" : `Job ${id}` }));
      const offset = Number(u.searchParams.get("offset") ?? "0");
      const limit = Number(u.searchParams.get("limit") ?? "200");
      return Response.json(rows.slice(offset, offset + limit));
    }
    if (table === "job_assignments") {
      if (assignmentDeclined) return Response.json(u.searchParams.get("declined_at") === "is.null" ? [] : [{ id: "10000000-0000-4000-8000-000000000099", user_id: actorId, job_id: jobA }]);
      const rows = assigned ? fixtureJobIds.map((jobId, i) => ({ id: `assignment-${i}`, user_id: actorId, job_id: jobId })) : [];
      const offset = Number(u.searchParams.get("offset") ?? "0");
      const limit = Number(u.searchParams.get("limit") ?? "200");
      return Response.json(rows.slice(offset, offset + limit));
    }
    if (table === "team_time_shifts") {
      const offset = Number(u.searchParams.get("offset") ?? "0");
      const limit = Number(u.searchParams.get("limit") ?? "200");
      const remaining = Math.max(0, shiftsCount - offset);
      return Response.json(Array.from({length: Math.min(limit,remaining)}, (_,i) => ({
        id: `shift-${offset + i}`, org_id: membershipOrg,
        worker_user_id: actorId, job_id: fixtureJobIds[0], status: "pending",
        started_at: "2026-10-30T10:00:00Z", ended_at: "2026-10-30T11:00:00Z",
      })));
    }
    if (table === "organizations") return Response.json([{ id: membershipOrg, name:"Test Org" }]);
    return Response.json([]);
  };
  const js = ts.transpileModule(edgeSource, {
    compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 },
    fileName: "supabase/functions/team-time/index.ts",
  }).outputText;
  vm.runInNewContext(js, {
    Deno: {
      env: { get: (name: string) => ({
        SUPABASE_URL: "https://staging.supabase.co",
        SUPABASE_ANON_KEY: "test-publishable",
        SUPABASE_SERVICE_ROLE_KEY: "test-bypass-role",
        ...(modernKeys ? {
          SUPABASE_PUBLISHABLE_KEYS: '{"default":"test-modern-publishable"}',
          SUPABASE_SECRET_KEYS: '{"default":"test-modern-secret"}',
        } : {}),
      } as Record<string, string>)[name] ?? "" },
      serve: (fn: (request: Request) => Promise<Response>) => { handle = fn; },
    },
    fetch: transport,
    Request, Response, Headers, URL, Date, JSON, Set, Map, Object,
  }, { filename: "team-time-edge-v6.js", timeout: 5000 });
  if (!handle) throw new Error("Edge Function did not register its request handler");
  const handler = handle;
  const request = async (body: Record<string, unknown>, token = "test-token") => {
    const res = await handler(new Request("https://staging.supabase.co/functions/v1/team-time", {
      method: "POST", headers: {Authorization: `Bearer ${token}`, "Content-Type":"application/json"},
      body: JSON.stringify(body),
    }));
    return { status: res.status, payload: await res.json() };
  };
  return { request, calls };
}

test("rejects a valid user's cross-organization selection before any Team & Time table read", async () => {
  const h = harness();
  const r = await h.request({action:"bootstrap",orgId:orgB});
  expect(r.status).toBe(403);
  expect(h.calls.some(c => c.table.startsWith("team_time_"))).toBe(false);
  expect(h.calls.every(c => c.key==="test-bypass-role")).toBe(true);
});

test("rejects an unassigned worker before creating a shift even if the job exists", async () => {
  const h = harness();
  const r = await h.request({action:"clock_in",orgId:orgA,jobId:jobA});
  expect(r.status).toBe(403);
  expect(h.calls.some(c => c.table==="job_assignments")).toBe(true);
  expect(h.calls.some(c => c.table==="team_time_shifts" && c.method==="POST")).toBe(false);
});

test("rejects a foreign shift ID under tenant-scoped lookup", async () => {
  const h = harness();
  const r = await h.request({action:"break_start",orgId:orgA,shiftId:shiftB});
  expect(r.status).toBe(404);
  expect(h.calls.filter(c => c.table==="team_time_shifts").every(c => c.orgFilter===`eq.${orgA}`)).toBe(true);
  expect(h.calls.every(c => c.method==="GET")).toBe(true);
});

test("rejects a non-supervisor's profile configuration and approval", async () => {
  const h = harness({role:"technician"});
  const profile = await h.request({action:"configure_profile",orgId:orgA,workerId:userB,workerType:"employee"});
  const approve = await h.request({action:"approve",orgId:orgA,shiftId:shiftB});
  expect(profile.status).toBe(403);
  expect(approve.status).toBe(403);
  expect(h.calls.some(c => c.method!=="GET")).toBe(false);
});

test("supervisor bootstrap pages beyond 100 shifts without dropping pending approvals or export rows", async () => {
  const h = harness({role:"manager",shiftsCount:201});
  const r = await h.request({action:"bootstrap",orgId:orgA});
  expect(r.status).toBe(200);
  const payload = r.payload as {shifts: unknown[]};
  expect(payload.shifts).toHaveLength(201);
  const pages=h.calls.filter(c=>c.table==="team_time_shifts");
  expect(pages.map(p=>p.offset)).toEqual(["0","200"]);
  expect(pages.every(p=>p.orgFilter===`eq.${orgA}`)).toBe(true);
  expect(pages.every(p=>p.key==="test-bypass-role")).toBe(true);
});

test("clock_in denies a declined assignment whose row still exists", async () => {
  const h = harness({assigned: true, assignmentDeclined: true});
  const r = await h.request({action:"clock_in",orgId:orgA,jobId:jobA});
  expect(r.status).toBe(403);
  expect(h.calls.some(c => c.table==="team_time_shifts" && c.method==="POST")).toBe(false);
  expect(h.calls.some(c => c.table==="job_assignments" && c.query.includes("declined_at=is.null"))).toBe(true);
});

test("bootstrap pages job metadata beyond the old 100-row page", async () => {
  const h = harness({role:"manager", assigned: true, distinctJobs: 250});
  const r = await h.request({action:"bootstrap",orgId:orgA});
  expect(r.status).toBe(200);
  const payload = r.payload as {jobs: unknown[]};
  expect(payload.jobs).toHaveLength(250);
  const jobCalls = h.calls.filter(c => c.table==="jobs");
  // Job IDs travel in bounded chunks, never one giant in-list.
  expect(jobCalls).toHaveLength(3);
  const chunkSizes = jobCalls.map(c => {
    const id = new URLSearchParams(c.query).get("id") ?? "";
    return id.startsWith("in.(") ? id.slice(4, -1).split(",").filter(Boolean).length : 0;
  });
  expect(chunkSizes.every(n => n > 0 && n <= 100)).toBe(true);
  expect(chunkSizes.reduce((a, b) => a + b, 0)).toBe(250);
  expect(jobCalls.every(c => c.key==="test-bypass-role")).toBe(true);
});

test("modern Supabase key maps are read as values, not environment names", async () => {
  const h = harness({modernKeys: true});
  const r = await h.request({action:"bootstrap",orgId:orgA});
  expect(r.status).toBe(200);
  // The publishable key feeds only the unrecorded /auth/v1/user call; the
  // secret key on every recorded REST call exercises the same key() path.
  const restCalls = h.calls.filter(c => c.key !== null);
  expect(restCalls.length).toBeGreaterThan(0);
  expect(restCalls.every(c => c.key === "test-modern-secret")).toBe(true);
});

test("oversized workspace fails explicitly rather than exporting a partial 10000-row subset", async () => {
  const h = harness({role:"manager",shiftsCount:10001});
  const r = await h.request({action:"bootstrap",orgId:orgA});
  expect(r.status).toBe(503);
  expect((r.payload as {error:string}).error).toMatch(/too many time records/i);
  expect(h.calls.some(c=>c.table==="team_time_shifts"&&c.offset==="10000")).toBe(true);
});

test("rejects absent bearer token before any privileged database read", async () => {
  const h = harness();
  const res = await h.request({action:"bootstrap",orgId:orgA},"");
  expect(res.status).toBe(401);
  expect(h.calls).toHaveLength(0);
});

test("the live-source security contract retains server JWT checks and member/job scoping", () => {
  expect(edgeSource).toMatch(/\/auth\/v1\/user/);
  expect(edgeSource).toMatch(/organization_memberships/);
  expect(edgeSource).toMatch(/job_assignments/);
  expect(edgeSource).toMatch(/service_role|key\('secret'\)/);
  expect(edgeSource).not.toMatch(/Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\).*console/);
});
