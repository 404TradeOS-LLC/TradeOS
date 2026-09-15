import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifyRecoveryIdentity } from "./recovery-core";

const ALLOWED_NEXT_PATHS = new Set(["/reset-password"]);

function resetRedirect(request: NextRequest, error: string) {
  const url = new URL("/reset-password", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const requestedNext = requestUrl.searchParams.get("next") ?? "/reset-password";
  const next = ALLOWED_NEXT_PATHS.has(requestedNext) ? requestedNext : "/reset-password";

  // Build the redirect response first. Supabase's recovery exchange writes the
  // access and refresh cookies through setAll; attaching them to this exact
  // response guarantees they survive the redirect to the password form.
  const response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Keep the request-side cookie view in sync so getUser() below can
            // verify the session that the recovery exchange just wrote, while
            // also attaching the same cookies to the redirect response.
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const verification = await verifyRecoveryIdentity(supabase, { code, tokenHash, type });
  if (!verification.ok) {
    if (verification.stage === "missing-parameters") {
      // Never log the query string: it can contain a still-valid recovery code
      // or token hash when companion parameters are malformed or unexpected.
      console.error("Password recovery callback missing recognized recovery parameters");
    } else if (verification.stage === "exchange") {
      console.error("Password recovery exchange failed:", verification.message ?? "unknown error");
    } else if (verification.message) {
      console.error("Password recovery identity validation failed:", verification.message);
    }
    return resetRedirect(request, "invalid-link");
  }

  // Bind the short-lived marker to the identity Supabase authenticated.
  // resetPasswordAction re-verifies the active user and requires this exact ID
  // before allowing updateUser({ password }).
  response.cookies.set("tradeos-recovery", verification.userId, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
