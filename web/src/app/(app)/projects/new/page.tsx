import { getCustomer, listCustomers } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { getSessionToken } from "@/lib/session";
import { getAthenaEstimateHandoffAuth } from "@/lib/athena-estimate-handoff-auth";
import { resolveNewProjectCreateIntent } from "@/lib/universal-create";
import { NewProjectForm } from "./form";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; intent?: string }>;
}) {
  const [token, { customerId, intent }] = await Promise.all([getSessionToken(), searchParams]);
  const createIntent = resolveNewProjectCreateIntent(intent);
  const focusScope = createIntent === "estimate";
  const handoff = focusScope ? await getAthenaEstimateHandoffAuth() : null;

  const [customers, selectedCustomer] = token
    ? await Promise.all([
        listCustomers(token),
        customerId ? getCustomer(token, customerId).catch(() => null) : Promise.resolve(null),
      ])
    : [[], null];

  const customerContext = selectedCustomer ?? undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={customerContext ? `Create project for ${customerContext.name}` : "Create project"}
        description={
          customerContext
            ? "Carry the existing Customer and a saved service address into a new Project without creating a second relationship model."
            : focusScope
              ? "Start with plain-language scope. TradeOS will carry it into the estimate workflow."
              : createIntent === "task"
                ? "Create this Project, then continue directly into its existing task form."
              : "Give the job a clear name now so site notes, estimates, and invoices stay easy to find later."
        }
        backHref={customerContext ? `/customers/${customerContext.id}` : "/projects"}
        backLabel={customerContext ? `Back to ${customerContext.name}` : "Back to projects"}
      />
      <NewProjectForm
        key={handoff?.identity ?? "no-estimate-handoff"}
        customers={customers}
        defaultCustomerId={customerContext?.id ?? customerId}
        selectedCustomer={customerContext}
        focusScope={focusScope}
        createIntent={createIntent ?? undefined}
        estimateHandoffIdentity={handoff?.identity ?? null}
      />
    </div>
  );
}
