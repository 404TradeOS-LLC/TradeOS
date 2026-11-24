"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { addMemberRoleOptions, SIGN_IN_ID_PLACEHOLDER, submitAddMember } from "@/lib/add-member";
import type { SettingsTeamMember } from "@/lib/settings";

interface AddMemberFormProps {
  orgId: string;
  currentRole: string;
  /** Called with the created member so the parent can show it in the directory immediately. */
  onMemberAdded: (member: SettingsTeamMember) => void;
}

/**
 * Owner/admin form that attaches an existing TradeOS auth user to the
 * workspace via POST /organizations/:id/members. It does not create a
 * sign-in and does not send an email invite: the person signs up first,
 * then the owner pastes their TradeOS sign-in ID here. Team-invite email is
 * not offered — production cannot send it (issue #872).
 */
export function AddMemberForm({ orgId, currentRole, onMemberAdded }: AddMemberFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [authSubject, setAuthSubject] = useState("");
  const [role, setRole] = useState("technician");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const roleOptions = addMemberRoleOptions(currentRole);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const member = await submitAddMember(orgId, {
        email,
        fullName,
        authSubject,
        role: role as (typeof roleOptions)[number],
      });
      setEmail("");
      setFullName("");
      setAuthSubject("");
      setSuccess(`${member.email} is now ${member.role} on this workspace. They can switch to it from the workspace menu once they sign in.`);
      onMemberAdded(member);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this member. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="rounded-[24px] border-border/70">
      <CardHeader>
        <CardTitle>Add member</CardTitle>
        <CardDescription>
          Attach a person who already has a TradeOS sign-in to this workspace. This does not create a
          sign-in or send an email invite — the person signs up first, then you add their account here
          with the sign-in ID from their Settings page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-member-email">Work email</Label>
              <Input
                id="add-member-email"
                type="email"
                autoComplete="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-member-full-name">Full name</Label>
              <Input
                id="add-member-full-name"
                type="text"
                autoComplete="name"
                placeholder="Jordan Lee"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-member-user-id">TradeOS sign-in ID</Label>
            <Input
              id="add-member-user-id"
              type="text"
              autoComplete="off"
              placeholder={SIGN_IN_ID_PLACEHOLDER}
              value={authSubject}
              onChange={(event) => setAuthSubject(event.target.value)}
              disabled={isSubmitting}
              required
            />
            <p className="text-sm text-muted-foreground">
              The sign-in ID shown on the person&rsquo;s Settings page under Team &amp; Access → Your TradeOS
              sign-in ID. Do not use the application user UUID under Supplier workflow IDs — the member
              lookup matches on the sign-in ID, not the application user ID.
            </p>
          </div>
          <SelectField
            id="add-member-role"
            label="Role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            disabled={isSubmitting}
            hint="Technicians see only their assigned work. Only owners can grant the owner role."
            className="h-11 rounded-xl"
          >
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </option>
            ))}
          </SelectField>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              Could not add member: {error}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="text-sm text-muted-foreground">
              {success}
            </p>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
            {isSubmitting ? "Adding member..." : "Add member"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
