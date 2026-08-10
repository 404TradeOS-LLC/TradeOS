import { listCustomers } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { NewProjectForm } from "./form";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const [token, { customerId }] = await Promise.all([getSessionToken(), searchParams]);
  const customers = token ? await listCustomers(token) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Create project</h1>
        <p className="text-sm text-muted-foreground">Give the job a clear name now so site notes, estimates, and invoices stay easy to find later.</p>
      </div>
      <NewProjectForm customers={customers} defaultCustomerId={customerId} />
    </div>
  );
}
