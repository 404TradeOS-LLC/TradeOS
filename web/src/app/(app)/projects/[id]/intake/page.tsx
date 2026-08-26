import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProjectPhotoPanel } from "@/components/projects/project-photo-panel";
import { SiteVisitForm } from "@/components/projects/site-visit-form";
import { AIChatPanel } from "@/components/intake/ai-chat-panel";
import { AIConversationHeader } from "@/components/intake/ai-conversation-header";
import { AIProgressIndicator } from "@/components/intake/ai-progress-indicator";
import { AIMissingInformationPanel } from "@/components/intake/ai-missing-information-panel";
import { MeasurementsCard } from "@/components/intake/measurements-card";
import { SiteVisitSummaryCard } from "@/components/intake/site-visit-summary-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProject } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export default async function ProjectIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  const project = await getProject(token ?? "", id);
  const latestVisit = project.siteVisits[0] ?? null;
  const aiQuestions = Array.isArray(latestVisit?.aiQuestionsJson) ? latestVisit.aiQuestionsJson : [];
  const missingInfo = Array.isArray(latestVisit?.missingInfoJson) ? latestVisit.missingInfoJson : [];
  const measurements = latestVisit?.measurementsJson && typeof latestVisit.measurementsJson === "object" ? latestVisit.measurementsJson : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href={`/projects/${project.id}`} className="text-sm text-muted-foreground underline">
            ← Back to project
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">AI Site Visit Intake</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Capture the field notes once, let AI flag missing information, and keep everything attached to this project.
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <Card className="border-border/70 bg-muted/10">
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div>
            <div className="font-medium text-foreground">Customer</div>
            <div>{project.customer?.name ?? "No customer linked yet"}</div>
          </div>
          <div>
            <div className="font-medium text-foreground">Project address</div>
            <div>{project.siteAddress ?? "Add a jobsite address"}</div>
          </div>
          <div>
            <div className="font-medium text-foreground">Simple scope</div>
            <div>{project.simpleScope ?? "Add a simple scope first"}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <SiteVisitForm projectId={project.id} />

        <div className="grid gap-6">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle>
                <AIConversationHeader
                  title="Latest AI Follow-Up"
                  subtitle="Capture the questions, missing items, and confidence so the project stays proposal-ready."
                  status={project.status}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AIProgressIndicator label="Intake readiness" value={latestVisit?.confidenceScore ?? 0} />
              <SiteVisitSummaryCard visit={latestVisit} />
              <AIChatPanel
                title="Questions to clarify"
                subtitle="Open questions from the latest intake pass."
                status={latestVisit ? "assistant notes" : "waiting"}
                messages={
                  aiQuestions.length > 0
                    ? aiQuestions.map((question, index) => ({
                        id: question,
                        role: "assistant" as const,
                        title: `Question ${index + 1}`,
                        text: question,
                        meta: "AI follow-up",
                      }))
                    : [
                        {
                          role: "assistant" as const,
                          title: "No follow-up questions yet.",
                          text: "Save notes or photos to prompt the intake assistant.",
                          meta: "Ready for more context",
                        },
                      ]
                }
              />
              <AIMissingInformationPanel items={missingInfo} />
              <MeasurementsCard measurements={measurements} />
            </CardContent>
          </Card>

          <ProjectPhotoPanel projectFiles={project.projectFiles} projectId={project.id} editable title="Saved project photos" />

          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle>Next step</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Once the notes feel good, create the client-facing proposal draft and refine the wording before you send it.
              </p>
              <Link href={`/projects/${project.id}/proposals/new`} className={buttonVariants()}>
                Continue to proposal draft
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
