import { NextRequest, NextResponse } from "next/server";
import {
  CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE,
  CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE_PATH,
  CUSTOMER_PORTAL_PENDING_ACCESS_MAX_AGE_SECONDS,
  isValidCustomerPortalAccessToken,
} from "@/lib/customer-portal-access";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const hasValidToken = isValidCustomerPortalAccessToken(token);
  const destination = new URL(hasValidToken ? "/customer-portal/access/confirm" : "/customer-portal/access-error", request.url);
  const result = NextResponse.redirect(destination, 303);
  result.headers.set("Cache-Control", "private, no-store, max-age=0");
  result.headers.set("Referrer-Policy", "no-referrer");
  result.headers.set("X-Content-Type-Options", "nosniff");

  if (hasValidToken) {
    result.cookies.set(CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE_PATH,
      maxAge: CUSTOMER_PORTAL_PENDING_ACCESS_MAX_AGE_SECONDS,
    });
  } else {
    result.cookies.set(CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE_PATH,
      maxAge: 0,
    });
  }

  return result;
}
