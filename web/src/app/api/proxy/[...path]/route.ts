import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
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
  return new Response(text || null, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
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
