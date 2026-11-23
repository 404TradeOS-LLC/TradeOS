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

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ abc_oauth?: string | string[] }>;
}) {
  const token = await getSessionToken();
  const persisted = token ? await getOrganizationSettings(token) : null;
  const supplierWorkflowIdentity = resolveSupplierWorkflowIdentity(persisted);
  // The session subject IS the authentication subject: bootstrap stores
  // claims.sub as AppUser.authSubject, local tokens sign sub as the auth
  // subject, and resolveAuthContext matches on it. It is not the application
  // user UUID (AppUser.id) shown under Supplier workflow IDs — the Add
  // member form needs this value, so the console shows it as the person's
  // sign-in ID for them to share with a workspace owner.
  const session = await getSession();
  const authSubject = session?.sub ?? null;
  const gitCommit =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    "local-dev";
  // Server-read OAuth result flag: passed as a prop so the server render and
  // the client hydration agree (reading window.location in the client would
  // produce a hydration mismatch).
  const rawAbcOAuth = (await searchParams).abc_oauth;
  const initialAbcOAuthResult =
    rawAbcOAuth === "success" || rawAbcOAuth === "error" ? rawAbcOAuth : null;

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
        authSubject={authSubject}
        initialDraft={mergeTradeOsSettingsDraft(persisted?.settings)}
        persistedSettingKeys={Object.keys(persisted?.settings ?? {})}
        initialAbcOAuthResult={initialAbcOAuthResult}
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
