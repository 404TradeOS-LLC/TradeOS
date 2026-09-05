import { NextRequest } from "next/server";
import { getCustomerPortalSessionToken } from "@/lib/customer-portal-session";

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

async function handle(request: NextRequest, path: string[]): Promise<Response> {
  const token = await getCustomerPortalSessionToken();
  if (!token) return Response.json({ error: "Customer portal session is required" }, { status: 401 });
  const upstream = await fetch(`${BACKEND_API_URL}/api/v1/customer-portal/${path.join("/")}${request.nextUrl.search}`, {
    method: request.method,
    headers: { "x-tradeos-portal-session": token },
    cache: "no-store",
  });
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const disposition = upstream.headers.get("content-disposition");
  if (contentType) headers.set("content-type", contentType);
  if (disposition) headers.set("content-disposition", disposition);
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { status: upstream.status, headers });
}

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return handle(request, (await params).path);
}
