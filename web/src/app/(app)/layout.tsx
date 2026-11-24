import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/shared/app-nav";
import { TenantQueryProvider } from "@/components/shared/tenant-query-provider";
import { getAthenaCapabilities, getOrganizationSettings, getWorkspaceMemberships, type WorkspaceMembership } from "@/lib/api";
import { isAuthorizedBetaOperator } from "@/lib/beta-control";
import { decodeLocalAccessToken } from "@/lib/local-auth";
import { getSession, getSessionToken } from "@/lib/session";
import { isTeamTimeEnabled } from "@/lib/team-time-config";
import { resolveWorkspaceKey } from "@/lib/workspace-key";

const ATHENA_CAPABILITY_TIMEOUT_MS = 1500;

interface AthenaCapabilityResolution {
  enabled: boolean;
  retryOnClient: boolean;
}

async function resolveAthenaEnabled(token: string | null): Promise<AthenaCapabilityResolution> {
  if (!token) return { enabled: false, retryOnClient: false };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ATHENA_CAPABILITY_TIMEOUT_MS);
  try {
    const capabilities = await getAthenaCapabilities(token, controller.signal);
    return { enabled: capabilities.kernelEnabled === true, retryOnClient: false };
  } catch {
    // Capability discovery is advisory UI gating. Fail closed on the initial
    // render, but let the client make one bounded retry so a transient timeout
    // does not hide Athena for the lifetime of the mounted app shell.
    return { enabled: false, retryOnClient: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function resolveSettingsIdentity(token: string | null): Promise<{ role: string | null; orgId: string | null }> {
  if (!token) return { role: null, orgId: null };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ATHENA_CAPABILITY_TIMEOUT_MS);
  try {
    const settings = await getOrganizationSettings(token, controller.signal);
    return { role: settings.currentRole, orgId: settings.orgId };
  } catch {
    return { role: null, orgId: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Workspace memberships power the nav switcher. Advisory like the
// capability check: fail closed to no switcher on any error so a slow or
// failed lookup never blocks the shell.
async function resolveWorkspaceMemberships(token: string | null): Promise<WorkspaceMembership[]> {
  if (!token) return [];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ATHENA_CAPABILITY_TIMEOUT_MS);
  try {
    return await getWorkspaceMemberships(token, controller.signal);
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const token = await getSessionToken();
  const [athenaCapability, identity, workspaceMemberships] = await Promise.all([
    resolveAthenaEnabled(token),
    resolveSettingsIdentity(token),
    resolveWorkspaceMemberships(token),
  ]);
  const athenaCapabilityRetryKey = athenaCapability.retryOnClient ? randomUUID() : null;
  // The Beta readiness link is gated by the same server-side operator
  // authorization as the route: role alone is never enough, and the
  // configured operator organization ID never leaves the server. Customer
  // owners/admins — and everyone else when operator access is unconfigured
  // — simply never see a link that would always 404 for them.
  const betaReadinessVisible = isAuthorizedBetaOperator(
    identity.role,
    identity.orgId,
    process.env.TRADEOS_BETA_OPERATOR_ORG_ID,
  );

  // Remount key from the session token first: every session the backend
  // issues signs the active orgId into the token, and a workspace switch
  // replaces the token atomically before the refresh, so the token claim
  // changes exactly when the workspace does. Deriving the key from the
  // settings lookup alone left it stuck on "unknown" whenever that lookup
  // failed or exceeded 1.5s in both workspaces, so tenant-owned client
  // state (for example a Settings draft) survived the switch. The settings
  // org stays as the fallback for sessions whose token carries no org claim.
  const workspaceKey = resolveWorkspaceKey({
    tokenOrgId: token ? decodeLocalAccessToken(token)?.orgId ?? null : null,
    settingsOrgId: identity.orgId,
  });

  // Keyed by the active workspace: switching workspaces must remount
  // the whole shell subtree, not just refresh server data — otherwise
  // tenant-owned client state (e.g. a Settings draft initialized from
  // workspace A's props) survives the switch and a later save would
  // overwrite workspace B's data with A's values. The key only changes
  // when the active org changes, so single-workspace users are unaffected.
  // The query cache is tenant-scoped the same way: TenantQueryProvider
  // lives inside the keyed boundary so its QueryClient is discarded with
  // the shell on every switch, instead of serving the previous workspace's
  // cached catalog searches under the new workspace.
  return (
    <div key={workspaceKey} className="flex flex-1 flex-col">
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Skip to content
      </a>
      <AppNav
        email={session.email}
        currentRole={identity.role}
        currentOrgId={identity.orgId}
        workspaceMemberships={workspaceMemberships}
        betaReadinessVisible={betaReadinessVisible}
        athenaEnabled={athenaCapability.enabled}
        athenaCapabilityRetryKey={athenaCapabilityRetryKey}
        teamTimeEnabled={isTeamTimeEnabled()}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] outline-none sm:px-6 sm:pt-6 sm:pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:px-8"
      >
        <TenantQueryProvider>{children}</TenantQueryProvider>
      </main>
    </div>
  );
}
