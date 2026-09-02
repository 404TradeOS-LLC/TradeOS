import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

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
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedNext = requestUrl.searchParams.get("next") ?? "/reset-password";
  const next = ALLOWED_NEXT_PATHS.has(requestedNext) ? requestedNext : "/reset-password";

  // Build the redirect response first. Supabase's PKCE exchange writes the
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
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let error: { message: string } | null = null;
  let recoveryUserId: string | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
    recoveryUserId = result.data.session?.user.id ?? null;
  } else if (tokenHash && type === "recovery") {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    error = result.error;
    recoveryUserId = result.data.session?.user.id ?? null;
  } else {
    // No recognized recovery params at all — most commonly a link a mail
    // scanner already prefetched (consuming the PKCE code/OTP before the
    // real click) or a manually truncated URL. Never log the query string:
    // it can contain a still-valid recovery code or token hash when the
    // companion `type` value is malformed or unexpected.
    console.error("Password recovery callback missing recognized recovery parameters");
    return resetRedirect(request, "invalid-link");
  }

  if (error || !recoveryUserId) {
    // Server-side diagnostic only — the user-facing redirect below stays
    // generic so we never leak Supabase internals or confirm which emails
    // have accounts.
    if (error) console.error("Password recovery exchange failed:", error.message);
    else console.error("Password recovery exchange returned no user session");
    return resetRedirect(request, "invalid-link");
  }

  response.cookies.set("tradeos-recovery", recoveryUserId, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
