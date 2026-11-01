import { PageHeader } from "@/components/shared/page-header";
import { getProject } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { EditProjectForm } from "../edit-form";

export default async function ProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  const project = await getProject(token ?? "", id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit project"
        description={`Update the name, work type, site address, and scope for ${project.name}.`}
        breadcrumbs={[
          { label: "Projects", href: "/projects" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: "Edit project" },
        ]}
      />
      <div className="max-w-2xl">
        <EditProjectForm project={project} />
      </div>
    </div>
  );
}
