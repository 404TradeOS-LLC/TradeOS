import Link from "next/link";
import { listCustomers } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerDirectory } from "@/components/customers/customer-directory";

export default async function CustomersPage() {
  const token = await getSessionToken();
  const customers = token ? await listCustomers(token) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        description="Keep the people and companies you work for in one place so estimates and invoices stay tied to the right job."
        action={
          <Link href="/customers/new" className={buttonVariants()}>
            Add customer
          </Link>
        }
      />

      <CustomerDirectory customers={customers} />
    </div>
  );
}
