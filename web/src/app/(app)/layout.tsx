import { redirect } from "next/navigation";
import { AppNav } from "@/components/shared/app-nav";
import { apiFetch } from "@/lib/api";
import { isAthenaOperatorRole } from "@/lib/athena-state";
import { getSession, getSessionToken } from "@/lib/session";
import type { OrganizationSettingsResponse } from "@/lib/settings";

// Bounds how long AppLayout waits on the organization-settings lookup below.
// The request is explicitly aborted when this deadline expires so a stalled
// backend does not leave an orphaned outbound fetch running after the layout
// falls back to hiding the Athena navigation entry.
const ORG_SETTINGS_TIMEOUT_MS = 5000;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Athena observability (A10) is owner/admin-only - see
  // web/src/lib/athena-access.ts. The navigation lookup uses the same settings
  // endpoint that supplies currentRole elsewhere. A failure here (including a
  // timeout) hides the link rather than breaking navigation for the whole app,
  // while still logging the failure for operators.
  let canViewAthena = false;
  try {
    const token = await getSessionToken();
    if (token) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ORG_SETTINGS_TIMEOUT_MS);
      try {
        const settings = await apiFetch<OrganizationSettingsResponse>("/api/v1/settings", {
          token,
          signal: controller.signal,
        });
        canViewAthena = isAthenaOperatorRole(settings.currentRole);
      } finally {
        clearTimeout(timeoutId);
      }
    }
  } catch (error) {
    console.error("AppLayout: failed to resolve Athena nav visibility", error);
    canViewAthena = false;
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppNav email={session.email} canViewAthena={canViewAthena} />
      <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</main>
    </div>
  );
}
