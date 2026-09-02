import Link from "next/link";
import { redirect } from "next/navigation";
import { JobCreateForm } from "./job-create-form";
import { buttonVariants } from "@/components/ui/button";
import { getOrganizationSettings, getProject } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

const JOB_MANAGER_ROLES = new Set(["owner", "admin", "dispatcher"]);

export default async function NewProjectJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  const [project, settings] = await Promise.all([
    getProject(token ?? "", id),
    getOrganizationSettings(token ?? ""),
  ]);

  if (!JOB_MANAGER_ROLES.has(settings.currentRole)) {
    redirect(`/projects/${project.id}`);
  }

  if (!project.customer) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 py-8">
        <h1 className="text-2xl font-semibold">Create field job</h1>
        <p className="text-muted-foreground">This project needs a customer before a field job can be created.</p>
        <Link href={`/projects/${project.id}`} className={buttonVariants({ variant: "outline" })}>Back to project</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{project.name}</p>
          <h1 className="text-2xl font-semibold">Create field job</h1>
        </div>
        <Link href={`/projects/${project.id}`} className={buttonVariants({ variant: "outline" })}>Back to project</Link>
      </div>
      <JobCreateForm
        projectId={project.id}
        customerId={project.customer.id}
        projectName={project.name}
        projectSiteAddress={project.siteAddress ?? null}
      />
    </div>
  );
}
