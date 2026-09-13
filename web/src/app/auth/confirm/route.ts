import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_NEXT_PATHS = new Set(["/reset-password"]);

type RecoveryError = { message: string };
type RecoveryUser = { id: string };

type RecoveryClient = {
  auth: {
    exchangeCodeForSession(code: string): Promise<{ error: RecoveryError | null }>;
    verifyOtp(input: { token_hash: string; type: "recovery" }): Promise<{ error: RecoveryError | null }>;
    getUser(): Promise<{ data: { user: RecoveryUser | null }; error: RecoveryError | null }>;
  };
};

type RecoveryClientFactory = (response: NextResponse) => RecoveryClient;

function resetRedirect(request: NextRequest, error: string) {
  const url = new URL("/reset-password", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function handleRecoveryRequest(request: NextRequest, createRecoveryClient: RecoveryClientFactory) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedNext = requestUrl.searchParams.get("next") ?? "/reset-password";
  const next = ALLOWED_NEXT_PATHS.has(requestedNext) ? requestedNext : "/reset-password";

  // Build the redirect response first. Supabase's recovery exchange writes the
  // access and refresh cookies through setAll; attaching them to this exact
  // response guarantees they survive the redirect to the password form.
  const response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createRecoveryClient(response);

  let error: RecoveryError | null = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type === "recovery") {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    // No recognized recovery params at all — most commonly a link a mail
    // scanner already prefetched (consuming the PKCE code/OTP before the
    // real click) or a manually truncated URL. Never log the query string:
    // it can contain a still-valid recovery code or token hash when the
    // companion `type` value is malformed or unexpected.
    console.error("Password recovery callback missing recognized recovery parameters");
    return resetRedirect(request, "invalid-link");
  }

  if (error) {
    // Server-side diagnostic only — the user-facing redirect below stays
    // generic so we never leak Supabase internals or confirm which emails
    // have accounts.
    console.error("Password recovery exchange failed:", error.message);
    return resetRedirect(request, "invalid-link");
  }

  // Bind the short-lived recovery marker to the identity Supabase just
  // authenticated. resetPasswordAction re-verifies the active Supabase user
  // and requires this exact ID before allowing updateUser({ password }).
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    if (userError) console.error("Password recovery identity validation failed:", userError.message);
    return resetRedirect(request, "invalid-link");
  }

  response.cookies.set("tradeos-recovery", user.id, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export async function GET(request: NextRequest) {
  return handleRecoveryRequest(request, (response) =>
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Keep the request-side cookie view in sync so getUser() below
              // can verify the session that the recovery exchange just wrote,
              // while also attaching the same cookies to the redirect response.
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    )
  );
}
