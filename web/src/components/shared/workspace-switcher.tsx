"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { switchWorkspaceAction } from "@/app/actions/auth";
import type { WorkspaceMembership } from "@/lib/api";

// Workspace switcher for people who belong to more than one workspace —
// e.g. someone who signed up (provisioning their own workspace) and was
// then attached to another org. Hidden entirely for single-workspace
// users: there is nothing to switch between.
export function WorkspaceSwitcher({
  memberships,
  currentOrgId,
}: {
  memberships: WorkspaceMembership[];
  currentOrgId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (memberships.length < 2) return null;

  const current = memberships.find((membership) => membership.orgId === currentOrgId) ?? memberships[0];

  async function handleChange(nextOrgId: string) {
    if (nextOrgId === current.orgId || pending) return;
    setPending(true);
    setError(null);
    const result = await switchWorkspaceAction(nextOrgId);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    // router.refresh() reconciles the server payload while preserving
    // this client component's state (and there is no workspace-dependent
    // key to remount it), so re-enable the select explicitly — otherwise
    // it stays disabled until a full page reload.
    router.refresh();
    setPending(false);
  }

  return (
    <div className="min-w-0">
      <label className="sr-only" htmlFor="workspace-switcher">
        Switch workspace
      </label>
      <select
        id="workspace-switcher"
        value={current.orgId}
        disabled={pending}
        onChange={(event) => void handleChange(event.target.value)}
        className="w-full max-w-[14rem] truncate rounded-md border border-border/70 bg-background px-2 py-1 text-xs font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
      >
        {memberships.map((membership) => (
          <option key={membership.orgId} value={membership.orgId}>
            {membership.organizationName} — {membership.role}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
