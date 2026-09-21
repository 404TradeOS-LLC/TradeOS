import { NextRequest, NextResponse } from "next/server";
import {
  CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE,
  CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE_PATH,
  isValidCustomerPortalAccessToken,
} from "@/lib/customer-portal-access";
import { CUSTOMER_PORTAL_SESSION_COOKIE } from "@/lib/customer-portal-session";
import { shouldRejectProxyMutation } from "@/lib/proxy-origin";

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (shouldRejectProxyMutation(request.method, request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Cross-origin portal redemption is not allowed" }, { status: 403 });
  }

  const token = request.cookies.get(CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE)?.value;
  if (!isValidCustomerPortalAccessToken(token)) {
    return buildPortalRedirect(request, "/customer-portal/access-error");
  }

  const response = await fetch(`${BACKEND_API_URL}/api/v1/customer-portal/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });
  const body = response.ok ? ((await response.json()) as { sessionToken: string; expiresAt: string }) : undefined;
  const result = buildPortalRedirect(request, response.ok ? "/customer-portal" : "/customer-portal/access-error");

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

function buildPortalRedirect(request: NextRequest, path: string): NextResponse {
  const result = NextResponse.redirect(new URL(path, request.url), 303);
  result.headers.set("Cache-Control", "private, no-store, max-age=0");
  result.headers.set("Referrer-Policy", "no-referrer");
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.cookies.set(CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE_PATH,
    maxAge: 0,
  });
  return result;
}
