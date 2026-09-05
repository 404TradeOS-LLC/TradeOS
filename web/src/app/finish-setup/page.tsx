import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { FinishSetupForm } from "./finish-setup-form";

export const metadata: Metadata = {
  title: "Finish setting up | TradeOS",
  description: "Complete organization setup for an authenticated account.",
};

// Reachable only by an authenticated Supabase session with no application
// organization yet (loginAction redirects here specifically for that case).
// Requires its own auth gate rather than living under (app)'s layout,
// since (app)'s layout renders the full authenticated nav (Customers,
// Projects, Dispatch, Settings) — all of which would 403 for a user who
// hasn't finished setup yet.
export default async function FinishSetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <FinishSetupForm />
    </main>
  );
}
