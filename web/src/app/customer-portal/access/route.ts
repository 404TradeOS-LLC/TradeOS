import { NextRequest, NextResponse } from "next/server";
import { CUSTOMER_PORTAL_SESSION_COOKIE } from "@/lib/customer-portal-session";

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const response = await fetch(`${BACKEND_API_URL}/api/v1/customer-portal/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  const body = response.ok ? ((await response.json()) as { sessionToken: string; expiresAt: string }) : undefined;
  const destination = new URL(response.ok ? "/customer-portal" : "/customer-portal/access-error", request.url);
  const result = NextResponse.redirect(destination, 303);
  result.headers.set("Cache-Control", "private, no-store, max-age=0");
  result.headers.set("Referrer-Policy", "no-referrer");
  result.headers.set("X-Content-Type-Options", "nosniff");
  if (body?.sessionToken) {
    const maxAge = Math.max(1, Math.floor((Date.parse(body.expiresAt) - Date.now()) / 1000));
    result.cookies.set(CUSTOMER_PORTAL_SESSION_COOKIE, body.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  }
  return result;
}
