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

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>Use at least eight characters. Your old sessions will be signed out after the change.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {token && <input type="hidden" name="token" value={token} />}
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
                {state.recoveryError && (
                  <>
                    {" "}
                    <Link href="/forgot-password" className="font-medium underline">
                      Request a new link
                    </Link>
                  </>
                )}
              </p>
            )}
            {state?.success && (
              <p role="status" className="text-sm text-success">
                {state.success}{" "}
                <Link href="/login" className="font-medium underline">Sign in</Link>
              </p>
            )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Updating password…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
