import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Exercise the actual source-controlled copy of deployed staging v6 without
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
const jobB = "20000000-0000-4000-8000-000000000082";
const shiftB = "20000000-0000-4000-8000-000000000112";

type Call = { table: string; method: string; orgFilter: string | null; key: string | null };
function harness({
  actorId = userA, role = "technician", membershipOrg = orgA,
  assigned = false,
}: {
  actorId?: string; role?: string; membershipOrg?: string; assigned?: boolean;
} = {}) {
  let handle: ((request: Request) => Promise<Response>) | undefined;
  const calls: Call[] = [];
  const transport = async (input: URL | string, init: RequestInit = {}): Promise<Response> => {
    const u = new URL(String(input));
    if (u.pathname === "/auth/v1/user") return Response.json({ id: actorId });
    if (!u.pathname.startsWith("/rest/v1/")) throw new Error("Unexpected upstream path");
    const table = u.pathname.slice("/rest/v1/".length);
    const h = new Headers(init.headers);
    calls.push({ table, method: init.method ?? "GET", orgFilter: u.searchParams.get("org_id"), key: h.get("apikey") });
    if (table === "users") return Response.json([{ id: actorId, auth_subject: actorId, full_name: "Test Worker", is_active: true }]);
    if (table === "organization_memberships") {
      const wantedOrg = u.searchParams.get("org_id");
      if (wantedOrg && wantedOrg !== `eq.${membershipOrg}`) return Response.json([]);
      const wantedUser = u.searchParams.get("user_id");
      if (wantedUser && wantedUser !== `eq.${actorId}`) return Response.json([]);
      return Response.json([{ org_id: membershipOrg, role, user_id: actorId, status: "active" }]);
    }
    if (table === "team_time_profiles") return Response.json([{org_id: membershipOrg, user_id: actorId, active: true, worker_type:"employee"}]);
    if (table === "jobs") return Response.json([{id: jobA, org_id: membershipOrg, title:"Assigned Job"}]);
    if (table === "job_assignments") return Response.json(assigned ? [{ id: "10000000-0000-4000-8000-000000000099", user_id: actorId }] : []);
    if (table === "team_time_shifts") return Response.json([]);
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
