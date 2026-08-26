import type { Metadata } from "next";
import { SettingsConsole } from "@/components/settings/settings-console";
import { getOrganizationSettings } from "@/lib/api";
import { mergeTradeOsSettingsDraft } from "@/lib/settings";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Settings | TradeOS",
  description: "TradeOS Control Center for company administration, branding, AI, estimating, security, and platform operations.",
};

export default async function SettingsPage() {
  const token = await getSessionToken();
  const persisted = token ? await getOrganizationSettings(token) : null;
  const gitCommit =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    "local-dev";

  return (
    <SettingsConsole
      initialDraft={mergeTradeOsSettingsDraft(persisted?.settings)}
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
        buildNumber: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "2026.07.03-rc1",
        databaseVersion: "Awaiting backend diagnostics endpoint",
        featureFlags: "project-workspace, ai-estimate-assist, estimate-compare",
        healthStatus: "Nominal",
      }}
    />
  );
}
