import { listCustomers } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { getSessionToken } from "@/lib/session";
import { NewProjectForm } from "./form";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const [token, { customerId }] = await Promise.all([getSessionToken(), searchParams]);
  const customers = token ? await listCustomers(token) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Create project"
        description="Give the job a clear name now so site notes, estimates, and invoices stay easy to find later."
        backHref="/projects"
        backLabel="Back to projects"
      />
      <NewProjectForm customers={customers} defaultCustomerId={customerId} />
    </div>
  );
}
