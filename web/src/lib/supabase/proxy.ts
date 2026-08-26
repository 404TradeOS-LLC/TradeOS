import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCAL_ACCESS_TOKEN_COOKIE, LOCAL_REFRESH_TOKEN_COOKIE, isUsableLocalAccessToken } from "@/lib/local-auth";

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
