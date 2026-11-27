import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getProxyCacheControl, getProxyCacheMaxAge } from "@/lib/proxy-cache";
import { shouldRejectProxyMutation } from "@/lib/proxy-origin";

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

// Generic authenticated proxy for Client Components. The httpOnly session
// cookie is only readable server-side, so any client-side fetch (e.g.
// TanStack Query) has to go through a route handler like this one rather
// than calling the Express API directly — this is that one route handler
// for every backend resource, instead of hand-writing one per resource.
async function handle(request: NextRequest, segments: string[]): Promise<Response> {
  if (shouldRejectProxyMutation(request.method, request.url, request.headers.get("origin"))) {
    return Response.json({ error: "Cross-origin proxy mutation is not allowed" }, { status: 403 });
  }

  const token = await getSessionToken();
  if (!token) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const url = `${BACKEND_API_URL}/api/v1/${segments.join("/")}${request.nextUrl.search}`;
  const hasBody = !["GET", "HEAD"].includes(request.method);

  const upstream = await fetch(url, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal: request.signal,
    body: hasBody ? await request.text() : undefined,
  });

  const text = await upstream.text();
  // Allowlisted GETs are browser-cacheable (`private, max-age=<TTL>` +
  // `Vary: Cookie` — see web/src/lib/proxy-cache.ts for the allowlist and
  // the workspace-switch reasoning). A repeat read inside the TTL is
  // served from the browser cache and never reaches this handler, which
  // is what cuts Fluid invocations. Everything else keeps `no-store`.
  // A cached response must never carry a cookie, so upstream Set-Cookie
  // is stripped on allowlisted responses; the ABC OAuth browser-binding
  // cookie below only ever arrives on a POST, which is never allowlisted.
  const cacheMaxAge = getProxyCacheMaxAge(request.method, segments);
  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    "Cache-Control": cacheMaxAge === null ? "no-store" : getProxyCacheControl(cacheMaxAge),
  });
  if (cacheMaxAge !== null) {
    headers.set("Vary", "Cookie");
  } else {
    // Forward upstream Set-Cookie headers (e.g. the ABC OAuth browser-binding
    // cookie set by POST /api/v1/supplier-integrations/abc/oauth/authorize).
    // The backend is first-party and trusted; without this the browser never
    // receives server-set cookies issued through the proxy.
    for (const setCookie of upstream.headers.getSetCookie()) {
      headers.append("Set-Cookie", setCookie);
    }
  }
  return new Response(text || null, {
    status: upstream.status,
    headers,
  });
}

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return handle(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: RouteParams) {
  return handle(request, (await params).path);
}
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return handle(request, (await params).path);
}
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return handle(request, (await params).path);
}
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return handle(request, (await params).path);
}
