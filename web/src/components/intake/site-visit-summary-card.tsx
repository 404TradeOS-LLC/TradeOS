import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoPanel } from "@/components/shared/info-panel";
import type { SiteVisit } from "@/lib/api";
import { AIConfidenceMeter } from "./ai-confidence-meter";

interface SiteVisitSummaryCardProps {
  visit: SiteVisit | null;
}

export function SiteVisitSummaryCard({ visit }: SiteVisitSummaryCardProps) {
  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>Latest site visit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {visit ? (
          <>
            <AIConfidenceMeter confidence={visit.confidenceScore} />
            <InfoPanel title="Field notes">
              <p className="whitespace-pre-wrap text-muted-foreground">{visit.notes ?? "No notes saved."}</p>
            </InfoPanel>
            <InfoPanel title="Transcript">
              <p className="whitespace-pre-wrap text-muted-foreground">{visit.transcript ?? "No transcript saved."}</p>
            </InfoPanel>
          </>
        ) : (
          <EmptyState
            title="No site visit saved yet"
            description="Site visit notes will appear here once one is logged for this project."
          />
        )}
      </CardContent>
    </Card>
  );
}

