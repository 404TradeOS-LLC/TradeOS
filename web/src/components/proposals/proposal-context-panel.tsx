import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectFile, SiteVisit } from "@/lib/api";
import { ProjectPhotoPanel } from "@/components/projects/project-photo-panel";
import { InfoPanel } from "@/components/shared/info-panel";
import { SummaryList } from "@/components/shared/summary-list";

interface ProposalContextPanelProps {
  latestVisit: SiteVisit | null;
  projectFiles: ProjectFile[];
}

export async function ProposalContextPanel({ latestVisit, projectFiles }: ProposalContextPanelProps) {
  const measurements = latestVisit?.measurementsJson && typeof latestVisit.measurementsJson === "object" ? latestVisit.measurementsJson : null;

  return (
    <div className="grid gap-6">
      <Card className="border-border/70 bg-card/90">
        <CardHeader>
          <CardTitle>Latest intake context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!latestVisit ? (
            <p className="text-muted-foreground">No site visit saved yet. The proposal can still be drafted, but it will be stronger once field notes are attached.</p>
          ) : (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">AI confidence</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {latestVisit.confidenceScore !== null ? `${latestVisit.confidenceScore}%` : "Not scored"}
                </div>
              </div>
              <InfoPanel title="Field notes">
                <p className="whitespace-pre-wrap text-muted-foreground">{latestVisit.notes ?? "No notes saved."}</p>
              </InfoPanel>
              <InfoPanel title="Transcript">
                <p className="whitespace-pre-wrap text-muted-foreground">{latestVisit.transcript ?? "No transcript saved."}</p>
              </InfoPanel>
              <InfoPanel title="Measurements">
                {measurements && Object.keys(measurements).length > 0 ? (
                  <SummaryList
                    items={Object.entries(measurements).map(([key, value]) => ({
                      label: formatMeasurementKey(key),
                      value: String(value),
                    }))}
                  />
                ) : (
                  <p className="text-muted-foreground">No measurements saved.</p>
                )}
              </InfoPanel>
            </>
          )}
        </CardContent>
      </Card>

      <ProjectPhotoPanel projectFiles={projectFiles} title="Photo evidence" emptyMessage="No project photos attached yet." />
    </div>
  );
}

function formatMeasurementKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}
