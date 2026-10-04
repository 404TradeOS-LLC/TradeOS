import Link from "next/link";
import { Camera, CheckCircle2, ClipboardList, Ruler, Sparkles } from "lucide-react";
import { createEstimateAction } from "@/app/actions/projects";
import { buttonVariants, Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProjectPhotoPanel } from "@/components/projects/project-photo-panel";
import { SiteVisitForm } from "@/components/projects/site-visit-form";
import { AIProgressIndicator } from "@/components/intake/ai-progress-indicator";
import { MeasurementsCard } from "@/components/intake/measurements-card";
import { SiteVisitSummaryCard } from "@/components/intake/site-visit-summary-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProject } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export default async function ProjectIntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jobId?: string | string[]; updated?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const token = await getSessionToken();
  const project = await getProject(token ?? "", id);
  const requestedJobId = Array.isArray(query.jobId) ? query.jobId[0] : query.jobId;
  const updated = Array.isArray(query.updated) ? query.updated[0] : query.updated;
  const linkedJob = requestedJobId
    ? project.jobs.find((job) => job.id === requestedJobId && !job.archivedAt) ?? null
    : null;
  const invalidJobContext = Boolean(requestedJobId && !linkedJob);
  const latestVisit = linkedJob
    ? project.siteVisits.find((visit) => visit.jobId === linkedJob.id) ?? null
    : project.siteVisits[0] ?? null;
  const latestEstimate = project.estimates[0] ?? null;
  const aiQuestions = Array.isArray(latestVisit?.aiQuestionsJson) ? latestVisit.aiQuestionsJson : [];
  const missingInfo = Array.isArray(latestVisit?.missingInfoJson) ? latestVisit.missingInfoJson : [];
  const measurements =
    latestVisit?.measurementsJson && typeof latestVisit.measurementsJson === "object"
      ? latestVisit.measurementsJson
      : null;
  const measurementCount = measurements ? Object.values(measurements).filter((value) => value !== null && value !== undefined && value !== "").length : 0;
  const photoCount = project.projectFiles.filter((file) => file.fileType === "photo").length;

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-border/70 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href={`/projects/${project.id}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              ← Back to lead
            </Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Site Visit</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.customer?.name ?? "No customer linked"} · {project.siteAddress ?? "No site address saved"}
            </p>
          </div>
          <StatusBadge status={project.status} />
        </div>
      </header>

      {updated === "visit" ? (
        <p className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success" role="status">
          Site Visit saved{linkedJob ? ` and linked to Job #${linkedJob.jobNumber}` : ""}.
        </p>
      ) : null}

      {linkedJob ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Linked scheduled job">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Scheduled job context</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">#{linkedJob.jobNumber} · {linkedJob.title}</p>
              <StatusBadge status={linkedJob.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              This capture will persist the existing SiteVisit.jobId link to this active Project Job.
            </p>
          </div>
          <Link href="/dispatch" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open Dispatch
          </Link>
        </section>
      ) : invalidJobContext ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground" role="status">
          The requested Job is not an active Job on this Project. This visit will remain Project-only unless you reopen it from an active scheduled Job.
        </p>
      ) : null}

      <section className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Site Visit capture summary">
        <div className="rounded-xl border border-border/70 bg-card p-3 sm:p-4">
          <Camera className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{photoCount}</p>
          <p className="text-xs text-muted-foreground">Photos</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-3 sm:p-4">
          <Ruler className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{measurementCount}</p>
          <p className="text-xs text-muted-foreground">Measurements</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-3 sm:p-4">
          <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-mono text-xl font-semibold">{latestVisit?.notes ? "Yes" : "No"}</p>
          <p className="text-xs text-muted-foreground">Notes</p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <SiteVisitForm projectId={project.id} jobId={linkedJob?.id} />

        <aside className="grid content-start gap-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                <CardTitle className="text-base">What still needs captured?</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <AIProgressIndicator label="Intake readiness" value={latestVisit?.confidenceScore ?? 0} />

              {!latestVisit ? (
                <p className="text-sm text-muted-foreground">
                  Finish the first Site Visit capture to generate the current missing-information and follow-up list.
                </p>
              ) : missingInfo.length > 0 || aiQuestions.length > 0 ? (
                <div className="grid gap-3">
                  {missingInfo.slice(0, 4).map((item) => (
                    <div key={item} className="rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{item}</span>
                    </div>
                  ))}
                  {missingInfo.length === 0
                    ? aiQuestions.slice(0, 3).map((question) => (
                        <div key={question} className="rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
                          {question}
                        </div>
                      ))
                    : null}
                  <p className="text-xs text-muted-foreground">
                    This panel shows the latest intake analysis. Saving another Site Visit refreshes it.
                  </p>
                </div>
              ) : (
                <div className="flex gap-2 rounded-xl border border-success/25 bg-success/5 p-3 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  No missing-information items were returned by the latest intake pass.
                </div>
              )}
            </CardContent>
          </Card>

          {latestVisit ? (
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Captured so far</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <SiteVisitSummaryCard visit={latestVisit} />
                <MeasurementsCard measurements={measurements} />
              </CardContent>
            </Card>
          ) : null}

          <ProjectPhotoPanel
            projectFiles={project.projectFiles}
            projectId={project.id}
            editable
            title="Saved project photos"
          />

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Estimate handoff</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!latestVisit ? (
                <p className="text-sm text-muted-foreground">
                  Finish a Site Visit first so the estimator has the captured field context available on this Project.
                </p>
              ) : latestEstimate ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    An Estimate already exists for this Project. Open it to review scope, items, pricing, and any remaining assumptions.
                  </p>
                  <Link
                    href={`/projects/${project.id}/estimates/${latestEstimate.id}`}
                    className={buttonVariants()}
                  >
                    Open Estimate
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Create the Project-linked Estimate when the capture is sufficient. Site Visit findings stay attached here for estimator review; they are not silently converted into priced line items.
                  </p>
                  <form action={createEstimateAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <Button type="submit" className="w-full">Create Estimate</Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
