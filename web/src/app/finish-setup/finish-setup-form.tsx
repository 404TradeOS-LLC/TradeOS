"use client";

import { useActionState } from "react";
import { finishSetupAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FinishSetupForm() {
  const [state, formAction, isPending] = useActionState(finishSetupAction, undefined);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Finish setting up</CardTitle>
        <CardDescription>You&apos;re signed in — tell us your company name to finish setting up your organization.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="organizationName">Company name</Label>
            <Input id="organizationName" name="organizationName" required autoFocus />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Setting up…" : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
