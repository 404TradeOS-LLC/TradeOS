import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

// Binary-safe sibling to /api/proxy/*. PDF responses must not go through
// .text()/JSON parsing (that would corrupt the bytes) — this streams the
// upstream body through unchanged, still attaching the session's bearer
// token server-side so the cookie never reaches client JS.
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const token = await getSessionToken();
  if (!token) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const url = `${BACKEND_API_URL}/api/v1/${path.join("/")}${request.nextUrl.search}`;
  const upstream = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text || null, { status: upstream.status });
  }

  const buffer = await upstream.arrayBuffer();
  return new Response(buffer, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": upstream.headers.get("content-disposition") ?? "inline",
    },
  });
}
