import Link from "next/link";
import { getPortalProjects } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CustomerPortalHomePage() {
  let projects: Awaited<ReturnType<typeof getPortalProjects>> = [];
  let accessUnavailable = false;
  try {
    projects = await getPortalProjects();
  } catch {
    accessUnavailable = true;
  }

  if (accessUnavailable) return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6"><h1 className="text-2xl font-semibold">Portal access required</h1><p className="text-muted-foreground">Open the customer portal invitation from your contractor to continue.</p></main>;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="space-y-3"><p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Customer portal</p><h1 className="text-3xl font-semibold tracking-tight">Your projects</h1><p className="text-muted-foreground">Review proposals, agreements, invoices, and project updates shared with you.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => <Card key={project.id}><CardHeader><CardTitle>{project.name}</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{project.siteAddress ?? "Address to be confirmed"}</p><Link href={`/customer-portal/projects/${project.id}`} className={buttonVariants()}>View project</Link></CardContent></Card>)}
        {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects have been shared with you yet.</p>}
      </div>
    </main>
  );
}
