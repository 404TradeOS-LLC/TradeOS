import { redirect } from "next/navigation";
import { AppNav } from "@/components/shared/app-nav";
import { getOrganizationSettings } from "@/lib/api";
import { isAthenaOperatorRole } from "@/lib/athena-state";
import { getSession, getSessionToken } from "@/lib/session";

// Bounds how long AppLayout waits on the organization-settings lookup below.
// apiFetch (lib/api.ts) wraps plain `fetch` with no AbortController/timeout
// wiring, and getOrganizationSettings's signature doesn't expose one either,
// so every authenticated page render currently blocks on this call for as
// long as the backend takes (or hangs). Fixing that at the source belongs in
// lib/api.ts, which is shared by several other call sites (settings page,
// dashboard, athena-access.ts) outside this pass's web-Athena-UI scope -
// this local race is the least invasive guard available here: it stops a
// slow/hung call from blocking the whole app without touching that shared
// contract.
//
// Investigated the two alternatives the underlying finding suggested:
//  - React's cache(): would be the real fix, since getOrganizationSettings
//    is genuinely re-fetched again in the same request by every Athena page
//    (getAthenaOperatorContext in athena-access.ts) and by the Settings/
//    Dashboard pages - but cache() only dedupes calls that share one wrapped
//    function reference, so it has to wrap the shared export in lib/api.ts
//    to help across files. Out of scope here; flagged as a follow-up.
//  - Reading currentRole from session claims instead of fetching it: not
//    available - web/src/lib/session.ts's SessionClaims only carries
//    sub/email, so this fetch is the only source of currentRole today.
const ORG_SETTINGS_TIMEOUT_MS = 5000;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Athena observability (A10) is owner/admin-only - see
  // web/src/lib/athena-access.ts. Reusing the same getOrganizationSettings
  // currentRole lookup the Settings page already relies on so the nav link
  // only appears for roles that can actually open the section, instead of
  // showing a link that immediately dead-ends into a denied page. A failure
  // here (e.g. a transient backend hiccup, or the timeout below) hides the
  // link rather than breaking navigation for the whole app - it's still
  // logged so the failure isn't silently invisible.
  let canViewAthena = false;
  try {
    const token = await getSessionToken();
    if (token) {
      const settings = await Promise.race([
        getOrganizationSettings(token),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`getOrganizationSettings timed out after ${ORG_SETTINGS_TIMEOUT_MS}ms`)), ORG_SETTINGS_TIMEOUT_MS)
        ),
      ]);
      canViewAthena = isAthenaOperatorRole(settings.currentRole);
    }
  } catch (error) {
    console.error("AppLayout: failed to resolve Athena nav visibility", error);
    canViewAthena = false;
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppNav email={session.email} canViewAthena={canViewAthena} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
