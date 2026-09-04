import { redirect } from "next/navigation";
import { AppNav } from "@/components/shared/app-nav";
import { apiFetch } from "@/lib/api";
import { isAthenaOperatorRole } from "@/lib/athena-state";
import { getSession, getSessionToken } from "@/lib/session";
import type { OrganizationSettingsResponse } from "@/lib/settings";
import { handleAthenaNavLookupFailure } from "./layout-athena-error.mjs";

// Bounds how long AppLayout waits on the organization-settings lookup below.
// The Control Dock's advisory dispatch badge loads after the shell renders so
// a stalled summary request cannot delay the authenticated page shell.
const ORG_SETTINGS_TIMEOUT_MS = 5000;

async function resolveCanViewAthena(token: string | null): Promise<boolean> {
  // Athena observability (A10) is owner/admin-only - see
  // web/src/lib/athena-access.ts. The navigation lookup uses the same settings
  // endpoint that supplies currentRole elsewhere. A failure here (including a
  // timeout) hides the link rather than breaking navigation for the whole app,
  // while still logging the failure for operators.
  if (!token) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ORG_SETTINGS_TIMEOUT_MS);
    try {
      const settings = await apiFetch<OrganizationSettingsResponse>("/api/v1/settings", {
        token,
        signal: controller.signal,
      });
      return isAthenaOperatorRole(settings.currentRole);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    return handleAthenaNavLookupFailure(error);
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const token = await getSessionToken();
  const canViewAthena = await resolveCanViewAthena(token);

  return (
    <div className="flex flex-1 flex-col">
      <AppNav email={session.email} canViewAthena={canViewAthena} />
      <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:px-6 sm:pt-6 sm:pb-[calc(env(safe-area-inset-bottom)+5.5rem)] 2xl:pb-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
