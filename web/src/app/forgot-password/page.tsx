"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, undefined);

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Enter your TradeOS email and we&apos;ll send a secure reset link if an account exists.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
            {state?.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending link…" : "Send reset link"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link href="/login" className="font-medium text-foreground underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
