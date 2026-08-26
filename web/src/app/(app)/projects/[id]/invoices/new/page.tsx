import { getProject } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { getSessionToken } from "@/lib/session";
import { NewInvoiceForm } from "./form";

export default async function NewInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  const project = await getProject(token ?? "", id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New invoice" backHref={`/projects/${id}`} backLabel="Back to project" />
      <NewInvoiceForm projectId={id} estimates={project.estimates} />
    </div>
  );
}
