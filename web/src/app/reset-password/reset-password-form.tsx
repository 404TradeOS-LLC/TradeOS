"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, undefined);
  const missingToken = token.length === 0;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>Use at least eight characters. Your old sessions will be signed out after the change.</CardDescription>
      </CardHeader>
      <CardContent>
        {missingToken ? (
          <div className="flex flex-col gap-4">
            <p role="alert" className="text-sm text-destructive">This reset link is missing or invalid.</p>
            <Link href="/forgot-password" className="text-sm font-medium text-foreground underline">Request a new link</Link>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
            {state?.success && (
              <p role="status" className="text-sm text-emerald-700">
                {state.success}{" "}
                <Link href="/login" className="font-medium underline">Sign in</Link>
              </p>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Updating password…" : "Update password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
