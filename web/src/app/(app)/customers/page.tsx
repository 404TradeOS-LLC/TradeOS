import Link from "next/link";
import { getOrganizationSettings, listCustomers } from "@/lib/api";
import { loadCustomersPageData } from "@/lib/customer-page-load";
import { getSessionToken } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerDirectory } from "@/components/customers/customer-directory";

export default async function CustomersPage() {
  const token = await getSessionToken();
  // A failed read shows recovery copy and must not render an empty CustomerDirectory,
  // which would misrepresent unavailable data as a truly empty customer list.
  const { customers, settings, customersFailed } = token
    ? await loadCustomersPageData(token, { listCustomers, getOrganizationSettings })
    : { customers: [], settings: null, customersFailed: false };
  const canWrite = settings && ["owner", "admin", "dispatcher", "estimator"].includes(settings.currentRole);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description="Keep the people and companies you work for in one place so estimates and invoices stay tied to the right job."
        action={canWrite ? (
          <Link href="/customers/new" className={buttonVariants()}>
            Add customer
          </Link>
        ) : undefined}
      />

      {customersFailed ? (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning" role="status">
          Customers are temporarily unavailable. Try reloading the page.
        </div>
      ) : null}

      {!customersFailed ? <CustomerDirectory customers={customers} /> : null}
    </div>
  );
}
