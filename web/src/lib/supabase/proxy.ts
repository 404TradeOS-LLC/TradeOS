import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { decodeLocalAccessToken, LOCAL_ACCESS_TOKEN_COOKIE, LOCAL_REFRESH_TOKEN_COOKIE, isUsableLocalAccessToken } from "@/lib/local-auth";

const BACKEND_API_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const localToken = request.cookies.get(LOCAL_ACCESS_TOKEN_COOKIE)?.value;
  if (localToken) {
    if (isUsableLocalAccessToken(localToken)) {
      return response;
    }

    const refreshToken = request.cookies.get(LOCAL_REFRESH_TOKEN_COOKIE)?.value;
    const refreshed = refreshToken ? await refreshLocalSession(refreshToken) : null;
    const refreshedClaims = refreshed ? decodeLocalAccessToken(refreshed.token) : null;
    const now = Math.floor(Date.now() / 1000);

    if (refreshed && refreshedClaims && refreshedClaims.exp && refreshedClaims.exp > now) {
      request.cookies.set(LOCAL_ACCESS_TOKEN_COOKIE, refreshed.token);
      request.cookies.set(LOCAL_REFRESH_TOKEN_COOKIE, refreshed.refreshToken);
      response = NextResponse.next({ request });
      const secure = process.env.NODE_ENV === "production";
      response.cookies.set(LOCAL_ACCESS_TOKEN_COOKIE, refreshed.token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: Math.max(1, refreshedClaims.exp - now),
      });
      response.cookies.set(LOCAL_REFRESH_TOKEN_COOKIE, refreshed.refreshToken, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return response;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    response = NextResponse.redirect(loginUrl);
    response.cookies.delete(LOCAL_ACCESS_TOKEN_COOKIE);
    response.cookies.delete(LOCAL_REFRESH_TOKEN_COOKIE);
    return response;
  }

  const { data } = await supabase.auth.getClaims();

  if (!data?.claims.sub) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

async function refreshLocalSession(refreshToken: string): Promise<{ token: string; refreshToken: string } | null> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { token?: unknown; refreshToken?: unknown };
    if (typeof body.token !== "string" || typeof body.refreshToken !== "string") return null;
    return { token: body.token, refreshToken: body.refreshToken };
  } catch {
    return null;
  }
}
