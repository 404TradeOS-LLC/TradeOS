"use server";

import { redirect } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api";
import { clearSessionCookie } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = { error?: string } | undefined;

// Falls back to localhost for local dev. In Preview/Production this must be
// set to this deployment's real origin (e.g. https://app.404tradeos.com) —
// it's passed to Supabase as emailRedirectTo below, and Supabase only
// honors it if the same URL is also added to the project's Auth > URL
// Configuration > Redirect URLs allowlist in the Supabase dashboard.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function signupAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!organizationName || !email || !password) {
    return { error: "Company name, email, and password are required." };
  }

  const supabase = await createClient();
  const { error: signupError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${APP_URL}/login`,
      data: {
        full_name: fullName || undefined,
        // Carried in Supabase's own user metadata so it survives the
        // signup -> email confirmation -> first login round trip, where no
        // application state exists yet to remember it. loginAction reads
        // this back to bootstrap the organization on first sign-in.
        organization_name: organizationName,
      },
    },
  });

  if (signupError) return { error: signupError.message };

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      error: "Account created. Check your email to confirm your address, then sign in to finish setting up your organization.",
    };
  }

  // Only reached when email confirmation is disabled and signUp() returned
  // a session immediately.
  try {
    await bootstrapOrganization(session.access_token, organizationName, fullName || undefined);
  } catch (err) {
    return { error: err instanceof ApiClientError ? err.message : "Unable to finish account setup." };
  }

  redirect("/dashboard");
}

export async function loginAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  const accessToken = data.session?.access_token;
  if (accessToken) {
    // Idempotent server-side (looks up an existing membership before
    // creating anything), so safe to call on every login — this is what
    // actually bootstraps a user who confirmed their email and is now
    // logging in for the first time, since signupAction's own bootstrap
    // call never ran for them (no session existed right after signUp()
    // while email confirmation was pending). Best-effort: a returning user
    // with an existing membership never touches organizationName at all,
    // so failures here only affect a first-time login, and shouldn't lock
    // an otherwise-authenticated user out of the app entirely.
    const metadata = data.session?.user.user_metadata as Record<string, unknown> | undefined;
    const organizationName = typeof metadata?.organization_name === "string" ? metadata.organization_name : undefined;
    const fullName = typeof metadata?.full_name === "string" ? metadata.full_name : undefined;

    try {
      await bootstrapOrganization(accessToken, organizationName, fullName);
    } catch (err) {
      console.error("Post-login organization bootstrap check failed:", err);
    }
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

// Calls the backend's idempotent bootstrap endpoint: it looks up an
// existing active membership for the caller (derived from the verified
// JWT, not from any of these arguments) before creating anything, so
// calling this for an already-bootstrapped user is a safe no-op that
// returns their existing organization/role. organizationName is only
// required the first time, to provision a brand-new organization.
async function bootstrapOrganization(accessToken: string, organizationName: string | undefined, fullName: string | undefined) {
  await apiFetch("/api/v1/auth/bootstrap", {
    method: "POST",
    token: accessToken,
    body: JSON.stringify({
      organizationName,
      fullName,
    }),
  });
}
