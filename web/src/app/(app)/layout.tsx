import { redirect } from "next/navigation";
import { AppNav } from "@/components/shared/app-nav";
import { getOrganizationSettings } from "@/lib/api";
import { isAthenaOperatorRole } from "@/lib/athena-state";
import { getSession, getSessionToken } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Athena observability (A10) is owner/admin-only - see
  // web/src/lib/athena-access.ts. Reusing the same getOrganizationSettings
  // currentRole lookup the Settings page already relies on so the nav link
  // only appears for roles that can actually open the section, instead of
  // showing a link that immediately dead-ends into a denied page. A failure
  // here (e.g. a transient backend hiccup) hides the link rather than
  // breaking navigation for the whole app.
  let canViewAthena = false;
  try {
    const token = await getSessionToken();
    if (token) {
      const settings = await getOrganizationSettings(token);
      canViewAthena = isAthenaOperatorRole(settings.currentRole);
    }
  } catch {
    canViewAthena = false;
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppNav email={session.email} canViewAthena={canViewAthena} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
