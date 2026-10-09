import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { SettingsConsole } from "@/components/settings/settings-console";
import { getOrganizationSettings } from "@/lib/api";
import { mergeTradeOsSettingsDraft } from "@/lib/settings";
import { resolveSupplierWorkflowIdentity } from "@/lib/supplierWorkflowIdentity";
import { getSession, getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Settings | TradeOS",
  description: "TradeOS Control Center for company administration, branding, AI, estimating, security, and platform operations.",
};

export default async function SettingsPage() {
  const token = await getSessionToken();
  const [persisted, session] = token
    ? await Promise.all([getOrganizationSettings(token), getSession()])
    : [null, null];
  const supplierWorkflowIdentity = resolveSupplierWorkflowIdentity(persisted, session?.email);
  const gitCommit =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    "local-dev";

  return (
    <>
      <div className="mx-auto mb-4 flex w-full max-w-7xl justify-end">
        <Link
          href="/settings/billing"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-(--elev-1) transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <CreditCard className="size-4 text-primary" aria-hidden="true" />
          Billing & Plan
        </Link>
      </div>
      <SettingsConsole
        supplierWorkflowIdentity={supplierWorkflowIdentity}
        initialDraft={mergeTradeOsSettingsDraft(persisted?.settings)}
        persistedSettingKeys={Object.keys(persisted?.settings ?? {})}
        initialWorkspaceData={{
          currentRole: persisted?.currentRole ?? "technician",
          canManageWorkspace: persisted?.canManageWorkspace ?? false,
          teamMembers: persisted?.teamMembers ?? [],
          roleProfiles: persisted?.roleProfiles ?? [],
        }}
        developerMeta={{
          version: "0.1.0",
          environment: process.env.NODE_ENV === "production" ? "Production" : "Development",
          gitCommit,
          buildNumber: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "Unavailable",
          databaseVersion: "Not exposed",
          featureFlags: "Not exposed",
          healthStatus: "Not exposed",
        }}
      />
    </>
  );
}
