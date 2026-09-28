import Link from "next/link";
import { Camera, CheckCircle2, ClipboardList, Mail, MapPin, Phone, Ruler, Sparkles } from "lucide-react";
import { createEstimateAction } from "@/app/actions/projects";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Customer, Estimate, Project, ProjectFile, SiteVisit } from "@/lib/api";
import { formatDateTime } from "@/lib/document-workflow";
import { cn } from "@/lib/utils";

interface LeadOverviewProps {
  project: Project;
  customer: Customer | null;
  estimates: Estimate[];
  siteVisits: SiteVisit[];
  projectFiles: ProjectFile[];
}

function truthyEntries(value: Record<string, unknown> | null) {
  return value ? Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== "") : [];
}

function formatMeasurement(label: string, value: unknown) {
  const names: Record<string, string> = {
    squareFeet: "Square feet",
    linearFeet: "Linear feet",
    fixtureCount: "Fixture count",
  };
  return { label: names[label] ?? label.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()), value: String(value) };
}

function ProgressStep({ label, complete, active }: { label: string; complete?: boolean; active?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
          complete && "border-success/30 bg-success/10 text-success",
          active && !complete && "border-primary/40 bg-primary/10 text-primary",
          !complete && !active && "border-border bg-background text-muted-foreground"
        )}
      >
        {complete ? "✓" : active ? "●" : "○"}
      </span>
      <span className={cn("text-xs font-medium", active || complete ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </div>
  );
}

export function LeadOverview({ project, customer, estimates, siteVisits, projectFiles }: LeadOverviewProps) {
  const latestVisit = siteVisits[0] ?? null;
  const readyToEstimate = Boolean(latestVisit && estimates.length === 0);
  const photoCount = projectFiles.filter((file) => file.fileType === "photo").length;
  const measurements = truthyEntries(latestVisit?.measurementsJson ?? null).map(([key, value]) => formatMeasurement(key, value));
  const missingInfo = Array.isArray(latestVisit?.missingInfoJson) ? latestVisit.missingInfoJson : [];
  const aiQuestions = Array.isArray(latestVisit?.aiQuestionsJson) ? latestVisit.aiQuestionsJson : [];

  return (
    <div className="grid gap-5">
      <header className="border-b border-border/70 pb-5">
        <Link href="/projects" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Leads & projects
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                {customer?.name ?? project.name}
              </h1>
              <Badge variant="outline" className={readyToEstimate ? "border-success/30 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary"}>
                {readyToEstimate ? "Ready to Estimate" : "New Lead"}
              </Badge>
            </div>
            <p className="mt-1 text-lg font-medium text-foreground">{project.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[project.jobType, project.siteAddress].filter(Boolean).join(" · ") || "Project-backed lead"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {customer?.phone ? (
              <a href={`tel:${customer.phone}`} className={buttonVariants({ variant: "outline" })}>
                <Phone className="size-4" aria-hidden="true" />
                Call
              </a>
            ) : null}
            {customer?.email ? (
              <a href={`mailto:${customer.email}`} className={buttonVariants({ variant: "outline" })}>
                <Mail className="size-4" aria-hidden="true" />
                Email
              </a>
            ) : null}
            {readyToEstimate ? (
              <form action={createEstimateAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <Button type="submit">Create Estimate</Button>
              </form>
            ) : (
              <Link href={`/projects/${project.id}/intake`} className={buttonVariants()}>
                Start Site Visit
              </Link>
            )}
          </div>
        </div>

        <nav className="mt-5 flex gap-2 overflow-x-auto" aria-label="Lead workspace">
          <span className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">Overview</span>
          <Link href={`/projects/${project.id}?tab=activity`} className="rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            Activity
          </Link>
          <Link href={`/projects/${project.id}?tab=documents`} className="rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            Files
          </Link>
        </nav>
      </header>

      <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Lead progress</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <ProgressStep label="Inquiry" complete />
          <ProgressStep label="Site Visit" complete={Boolean(latestVisit)} active={!latestVisit} />
          <ProgressStep label="Estimate" active={readyToEstimate} complete={estimates.length > 0} />
          <ProgressStep label="Won" complete={project.status === "awarded"} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          TradeOS currently persists this pre-job workflow on the Project record; qualification is not a separate Lead-stage field.
        </p>
      </section>

      {readyToEstimate ? (
        <section className="rounded-2xl border border-success/30 bg-success/5 p-4 sm:p-5">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">Site visit captured. The Project is ready for Estimate review.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {photoCount} photo{photoCount === 1 ? "" : "s"} · {measurements.length} measurement{measurements.length === 1 ? "" : "s"} · {latestVisit?.notes ? "notes captured" : "no visit notes"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Creating the Estimate links it to this Project. Site Visit findings remain attached here for estimator review; TradeOS does not claim they are automatically converted into priced line items.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
          <p className="font-medium text-foreground">New inquiry</p>
          <p className="mt-1 text-sm text-muted-foreground">Capture the jobsite conditions and estimate-impacting unknowns before pricing.</p>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="grid content-start gap-5">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">What they need</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {project.simpleScope ?? "No simple scope has been captured yet."}
              </p>
            </CardContent>
          </Card>

          {latestVisit ? (
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">Captured on the latest Site Visit</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <Camera className="size-4 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-2 font-mono text-lg font-semibold">{photoCount}</p>
                    <p className="text-xs text-muted-foreground">Project photos</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <Ruler className="size-4 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-2 font-mono text-lg font-semibold">{measurements.length}</p>
                    <p className="text-xs text-muted-foreground">Measurements</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-2 font-mono text-lg font-semibold">{latestVisit.notes ? "Yes" : "No"}</p>
                    <p className="text-xs text-muted-foreground">Visit notes</p>
                  </div>
                </div>

                {measurements.length > 0 ? (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {measurements.map((item) => (
                      <div key={item.label} className="rounded-xl border border-border/60 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">{item.label}</dt>
                        <dd className="mt-0.5 text-sm font-medium">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {latestVisit.notes ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{latestVisit.notes}</p> : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-4">
          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-base">Opportunity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Property</p>
                <p className="mt-1 font-medium">{project.siteAddress ?? "Not recorded"}</p>
              </div>
              <div className="border-t border-border/60 pt-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Work type</p>
                <p className="mt-1 font-medium">{project.jobType ?? "Not recorded"}</p>
              </div>
              <div className="border-t border-border/60 pt-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Budget / timeline / source</p>
                <p className="mt-1 text-muted-foreground">Not stored as dedicated Project fields today.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                <CardTitle className="text-base">Estimate readiness</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!latestVisit ? (
                <p className="text-sm text-muted-foreground">Complete a Site Visit to generate the current AI follow-up and missing-information list.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Confidence: {latestVisit.confidenceScore == null ? "not scored" : `${Math.round(latestVisit.confidenceScore * 100)}%`}
                  </p>
                  {missingInfo.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Still missing</p>
                      <ul className="mt-2 grid gap-2 text-sm">
                        {missingInfo.slice(0, 5).map((item) => <li key={item}>— {item}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-success">No missing-information items were returned by the latest intake pass.</p>
                  )}
                  {aiQuestions.length > 0 ? (
                    <p className="text-xs text-muted-foreground">{aiQuestions.length} follow-up question{aiQuestions.length === 1 ? "" : "s"} remain available in Site Visit Intake.</p>
                  ) : null}
                  <Link href={`/projects/${project.id}/intake`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Review Site Visit
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Recent</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div>
                <p className="font-medium">Lead created</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(project.createdAt)}</p>
              </div>
              {latestVisit ? (
                <div className="border-t border-border/60 pt-3">
                  <p className="font-medium">Site Visit captured</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(latestVisit.createdAt)}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
