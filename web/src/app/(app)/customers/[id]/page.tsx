import Link from "next/link";
import { deleteCustomerAction } from "@/app/actions/customers";
import { CustomerPortalLink } from "./customer-portal-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRowLink } from "@/components/shared/list-row-link";
import { PageHeader } from "@/components/shared/page-header";
import { getCustomer, getOrganizationSettings } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { EditCustomerForm } from "./edit-form";
import { ServiceAddresses } from "./service-addresses";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  const [customer, settings] = await Promise.all([
    getCustomer(token ?? "", id),
    getOrganizationSettings(token ?? ""),
  ]);
  const canIssuePortalLink = ["owner", "admin", "dispatcher", "estimator"].includes(settings.currentRole);
  const canWrite = ["owner", "admin", "dispatcher", "estimator"].includes(settings.currentRole);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={customer.name} backHref="/customers" backLabel="All customers" />

      <Card className="max-w-md">
        <CardHeader>
        <CardTitle>Customer details</CardTitle>
        </CardHeader>
        <CardContent>
          {canWrite ? <EditCustomerForm customer={customer} /> : (
            <div className="text-sm">
              <p>{customer.email || "No email saved"}</p>
              <p>{customer.phone || "No phone saved"}</p>
              <p>{customer.billingAddress || "No billing address saved"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Service addresses</CardTitle></CardHeader>
        <CardContent><ServiceAddresses customerId={customer.id} addresses={customer.serviceAddresses ?? []} canWrite={canWrite} /></CardContent>
      </Card>

      {canIssuePortalLink ? (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Customer portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Create a single-use link for this customer. The raw link is shown only once.</p>
            <CustomerPortalLink customerId={customer.id} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.projects.length === 0 ? (
            <EmptyState
              title="No projects for this customer yet."
              description="New projects linked to this customer will show up here."
              action={canWrite ? (
                <Link href={`/projects/new?customerId=${customer.id}`} className={buttonVariants({ variant: "outline" })}>
                  New project
                </Link>
              ) : undefined}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {customer.projects.map((project) => (
                <li key={project.id}>
                  <ListRowLink href={`/projects/${project.id}`} title={project.name} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canWrite ? <form action={deleteCustomerAction} className="max-w-md">
        <input type="hidden" name="customerId" value={customer.id} />
        <Button type="submit" variant="destructive">
          Remove customer
        </Button>
      </form> : null}
    </div>
  );
}
