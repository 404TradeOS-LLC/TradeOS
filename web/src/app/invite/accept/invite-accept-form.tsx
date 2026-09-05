"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptInviteAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteAcceptForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(acceptInviteAction, undefined);
  const missingToken = token.length === 0;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Join your TradeOS workspace</CardTitle>
        <CardDescription>Create your account password and we&apos;ll take you straight into the workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        {missingToken ? (
          <div className="flex flex-col gap-4">
            <p role="alert" className="text-sm text-destructive">This invitation link is missing or invalid.</p>
            <Link href="/login" className="text-sm font-medium text-foreground underline">Back to sign in</Link>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" autoComplete="name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Joining workspace…" : "Accept invitation"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
