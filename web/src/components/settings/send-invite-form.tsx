"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { sendInviteRoles, submitSendInvite } from "@/lib/send-invite";
import type { SendInviteRole } from "@/lib/send-invite";

/**
 * Owner-only form that emails a team invite to a person who does not have a
 * TradeOS account yet, via POST /api/v1/account/invites. The recipient
 * accepts at /invite/accept and creates their sign-in there. This is the
 * counterpart to Add member, which attaches a person who already has a
 * sign-in: invites are for people with no account, and only Technician and
 * Dispatcher roles can be invited. The invite is not listed in the team
 * directory until the recipient accepts — the members list only shows
 * memberships, so a pending invite shows up here only in the confirmation
 * below, not in the directory.
 */
export function SendInviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<SendInviteRole>("technician");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const invite = await submitSendInvite({ email, role });
      const roleLabel = invite.role.charAt(0).toUpperCase() + invite.role.slice(1);
      const expires = new Date(invite.expiresAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
      setEmail("");
      setSuccess(
        `Invite sent to ${invite.email} as ${roleLabel}. It expires ${expires} — they'll get an email with a link to accept and create their TradeOS sign-in.`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send this invite. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="rounded-[24px] border-border/70">
      <CardHeader>
        <CardTitle>Send invite</CardTitle>
        <CardDescription>
          Invite a person who does not have a TradeOS account yet. They&rsquo;ll get an email with a link
          to accept the invite and create their sign-in. Invites are for Technician or Dispatcher only
          and expire in 7 days. A pending invite is not listed in the team directory — the person shows
          up there once they accept.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="send-invite-email">Work email</Label>
              <Input
                id="send-invite-email"
                type="email"
                autoComplete="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <SelectField
              id="send-invite-role"
              label="Role"
              value={role}
              onChange={(event) => setRole(event.target.value as SendInviteRole)}
              disabled={isSubmitting}
              hint="Technicians see only their assigned work."
              className="h-11 rounded-xl"
            >
              {sendInviteRoles.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </SelectField>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              Could not send invite: {error}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="text-sm text-muted-foreground">
              {success}
            </p>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
            {isSubmitting ? "Sending invite..." : "Send invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
