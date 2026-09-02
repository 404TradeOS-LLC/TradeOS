import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

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
    <div className="flex flex-1 items-center justify-center px-6">
      {await resolveContent(token, error)}
    </div>
  );
}

// The legacy backend-token flow (invite-style links) validates its token at
// submit time via the backend, so it's allowed to render the form directly.
// Every other link relies on Supabase recovery: /auth/confirm sets the
// short-lived tradeos-recovery cookie only after a successful exchange, so
// its absence (or an explicit ?error= from that redirect) means the link was
// invalid, expired, reused, or consumed by a scanner before the user opened
// it — and the form must never be shown in that case.
async function resolveContent(token: string, error: string) {
  if (token) return <ResetPasswordForm token={token} />;

  if (error) return <RecoveryErrorCard message={recoveryErrorMessage(error)} />;

  const cookieStore = await cookies();
  const hasRecoverySession = cookieStore.get("tradeos-recovery")?.value === "1";
  if (!hasRecoverySession) {
    return <RecoveryErrorCard message={recoveryErrorMessage("invalid-link")} />;
  }

  return <ResetPasswordForm token={token} />;
}
