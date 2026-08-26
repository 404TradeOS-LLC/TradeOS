import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  LOCAL_ACCESS_TOKEN_COOKIE,
  LOCAL_REFRESH_TOKEN_COOKIE,
  decodeLocalAccessToken,
  isUsableLocalAccessToken,
} from "@/lib/local-auth";

export interface SessionClaims {
  sub: string;
  email?: string;
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const localToken = cookieStore.get(LOCAL_ACCESS_TOKEN_COOKIE)?.value;
  if (localToken && isUsableLocalAccessToken(localToken)) return localToken;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function getSession(): Promise<SessionClaims | null> {
  const cookieStore = await cookies();
  const localToken = cookieStore.get(LOCAL_ACCESS_TOKEN_COOKIE)?.value;
  const localClaims = localToken ? decodeLocalAccessToken(localToken) : null;
  if (localClaims && isUsableLocalAccessToken(localToken!)) {
    return {
      sub: localClaims.sub,
      email: localClaims.email,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return {
    sub: user.id,
    email: user.email,
  };
}

export async function setLocalSession(accessToken: string, refreshToken: string): Promise<void> {
  const claims = decodeLocalAccessToken(accessToken);
  const now = Math.floor(Date.now() / 1000);
  if (!claims || typeof claims.exp !== "number" || claims.exp <= now) {
    throw new Error("Cannot set an invalid or expired local access token");
  }

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set(LOCAL_ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, claims.exp - now),
  });
  cookieStore.set(LOCAL_REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearLocalSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(LOCAL_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(LOCAL_REFRESH_TOKEN_COOKIE);
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(LOCAL_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(LOCAL_REFRESH_TOKEN_COOKIE)?.value;
  let logoutToken = accessToken;

  if (!logoutToken || !isUsableLocalAccessToken(logoutToken)) {
    if (refreshToken) {
      try {
        const response = await fetch(`${process.env.BACKEND_API_URL ?? "http://localhost:4000"}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
          cache: "no-store",
        });
        if (response.ok) {
          const body = (await response.json()) as { token?: unknown };
          logoutToken = typeof body.token === "string" ? body.token : undefined;
        }
      } catch {
        // Cookie cleanup still runs if the backend is unavailable.
      }
    }
  }

  if (logoutToken) {
    try {
      await fetch(`${process.env.BACKEND_API_URL ?? "http://localhost:4000"}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${logoutToken}`,
        },
        cache: "no-store",
      });
    } catch {
      // Cookie cleanup still runs if the backend is unavailable.
    }
  }

  await clearLocalSessionCookies();

  const supabase = await createClient();
  await supabase.auth.signOut();
}
