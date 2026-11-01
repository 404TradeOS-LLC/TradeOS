import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getInvoice, getOrganizationSettings, getProject } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { EditInvoiceForm } from "./form";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  const { id: projectId, invoiceId } = await params;
  const token = await getSessionToken();
  const [project, invoice, settings] = await Promise.all([
    getProject(token ?? "", projectId),
    getInvoice(token ?? "", invoiceId),
    getOrganizationSettings(token ?? ""),
  ]);

  // Keep this list in exact lockstep with the backend billing.write role grant
  // (see the invoice detail page and its page.test.ts): the edit surface is
  // offered only to roles the backend will not 403.
  const canEditInvoice = ["owner", "admin", "dispatcher", "estimator"].includes(settings.currentRole);
  const isDraft = invoice.status === "draft";
  const editable = isDraft && canEditInvoice;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit invoice #${invoice.invoiceNumber}`}
        breadcrumbs={[
          { label: project.name, href: `/projects/${projectId}` },
          { label: `Invoice #${invoice.invoiceNumber}`, href: `/projects/${projectId}/invoices/${invoiceId}` },
          { label: "Edit invoice" },
        ]}
      />
      {editable ? (
        <EditInvoiceForm projectId={projectId} invoice={invoice} />
      ) : (
        <Card className="max-w-md">
          <CardContent className="pt-5">
            <p className="font-medium text-foreground">This invoice cannot be edited</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {!isDraft
                ? "Only draft invoices can be edited. Once an invoice is sent, paid, or voided, it is no longer editable."
                : "Your current role can review billing but cannot edit invoices."}
            </p>
            <Link href={`/projects/${projectId}/invoices/${invoiceId}`} className={buttonVariants({ variant: "outline", className: "mt-4" })}>
              Back to invoice
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
