import Link from "next/link";
import { ChevronRight, FolderKanban, LockKeyhole } from "lucide-react";
import { getPortalProjects } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

export default async function CustomerPortalHomePage() {
  let projects: Awaited<ReturnType<typeof getPortalProjects>> = [];
  let accessUnavailable = false;
  try {
    projects = await getPortalProjects();
  } catch {
    accessUnavailable = true;
  }

  if (accessUnavailable) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">Portal access required</h1>
        <p className="text-muted-foreground">Open the customer portal invitation from your contractor to continue.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border/70 bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="font-heading text-base font-semibold text-foreground">TradeOS Customer Portal</p>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">Secure project documents shared by your contractor</p>
          </div>
          <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/10 text-success">
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            Secure customer session
          </Badge>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-7 sm:px-6 sm:py-10">
        <header className="border-b border-border/70 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Customer portal</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-foreground">Your projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review the proposals, agreements, invoices, and project information your contractor has shared with you.
          </p>
        </header>

        <section className="py-2" aria-labelledby="projects-heading">
          <h2 id="projects-heading" className="sr-only">Shared projects</h2>
          {projects.length > 0 ? (
            <div className="divide-y divide-border/60">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/customer-portal/projects/${project.id}`}
                  className="group flex min-h-24 items-center gap-3 py-5 outline-none transition-colors hover:bg-muted/20 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-2"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/30 text-muted-foreground">
                    <FolderKanban className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-lg font-semibold text-foreground">{project.name}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{project.siteAddress ?? "Address to be confirmed"}</span>
                  </span>
                  <span className="hidden shrink-0 text-sm font-medium text-foreground sm:block">Open project</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-12">
              <p className="font-medium text-foreground">Nothing shared yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Projects will appear here when your contractor shares them with you.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
