import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/shared/app-nav";
import { getAthenaCapabilities, getOrganizationSettings, getWorkspaceMemberships, type WorkspaceMembership } from "@/lib/api";
import { getSession, getSessionToken } from "@/lib/session";
import { isTeamTimeEnabled } from "@/lib/team-time-config";

const ATHENA_CAPABILITY_TIMEOUT_MS = 1500;

// The memberships lookup gets its own, larger budget than the advisory
// capability/settings lookups. GET /api/v1/auth/memberships takes
// 311–2202ms against the staging API (Vercel runtime logs, 2026-11-24),
// so the shared 1500ms budget aborted real lookups — and
// resolveWorkspaceMemberships fails closed to [] on abort, which hides the
// workspace switcher for multi-workspace users even though their
// memberships exist and the endpoint answered 200. 5000ms covers the worst
// observed latency by more than 2x while still bounding shell delay.
const WORKSPACE_MEMBERSHIPS_TIMEOUT_MS = 5000;

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
  const timeoutId = setTimeout(() => controller.abort(), WORKSPACE_MEMBERSHIPS_TIMEOUT_MS);
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

  // Keyed by the active workspace: switching workspaces must remount
  // the whole shell subtree, not just refresh server data — otherwise
  // tenant-owned client state (e.g. a Settings draft initialized from
  // workspace A's props) survives the switch and a later save would
  // overwrite workspace B's data with A's values. The key only changes
  // when the active org changes, so single-workspace users are unaffected.
  return (
    <div key={identity.orgId ?? "unknown"} className="flex flex-1 flex-col">
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
        athenaEnabled={athenaCapability.enabled}
        athenaCapabilityRetryKey={athenaCapabilityRetryKey}
        teamTimeEnabled={isTeamTimeEnabled()}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] outline-none sm:px-6 sm:pt-6 sm:pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:px-8"
      >
        {children}
      </main>
    </div>
  );
}
