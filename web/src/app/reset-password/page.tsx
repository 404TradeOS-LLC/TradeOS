import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";
import { resolveInitialRecoveryState, resolveRecoverySessionState } from "./recovery-session-state";

export const metadata: Metadata = {
  title: "Reset password | TradeOS",
  description: "Choose a new password for your TradeOS account.",
};

type SearchParams = Promise<{ token?: string | string[]; error?: string | string[] }>;

const RECOVERY_ERROR_MESSAGES: Record<string, string> = {
  "invalid-link": "This password reset link is invalid, expired, or has already been used.",
};

function recoveryErrorMessage(error: string): string {
  return RECOVERY_ERROR_MESSAGES[error] ?? "This password reset link can no longer be used.";
}

function RecoveryErrorCard({ message }: { message: string }) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Reset link no longer valid</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/forgot-password" className="text-sm font-medium underline">
          Request a new reset link
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const error = typeof params.error === "string" ? params.error : "";

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      {await resolveContent(token, error)}
    </main>
  );
}

// The legacy backend-token flow (invite-style links) validates its token at
// submit time via the backend, so it's allowed to render the form directly.
// Every other link relies on Supabase recovery: /auth/confirm sets the
// short-lived tradeos-recovery cookie only after a successful exchange. The
// marker is necessary but not sufficient because it can outlive the underlying
// Supabase session; verify that the current user matches the recovery exchange before rendering
// the reset form so an expired, stale, or unrelated sign-in session fails closed at page load.
async function resolveContent(token: string, error: string) {
  if (token) return <ResetPasswordForm token={token} />;
  if (error) return <RecoveryErrorCard message={recoveryErrorMessage(error)} />;

  const cookieStore = await cookies();
  const recoveryUserId = cookieStore.get("tradeos-recovery")?.value ?? "";
  const initialState = resolveInitialRecoveryState("", "", Boolean(recoveryUserId));
  if (initialState.kind === "invalid-link") {
    return <RecoveryErrorCard message={recoveryErrorMessage("invalid-link")} />;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();
  const sessionState = resolveRecoverySessionState(Boolean(user && recoveryUserId && user.id === recoveryUserId), Boolean(sessionError));
  if (sessionState.kind === "invalid-link") {
    if (sessionError) console.error("Supabase recovery session validation failed:", sessionError.message);
    return <RecoveryErrorCard message={recoveryErrorMessage("invalid-link")} />;
  }

  return <ResetPasswordForm token="" />;
}
