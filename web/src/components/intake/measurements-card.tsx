import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SummaryList } from "@/components/shared/summary-list";

interface MeasurementsCardProps {
  measurements: Record<string, unknown> | null;
}

export function MeasurementsCard({ measurements }: MeasurementsCardProps) {
  const items = measurements ? Object.entries(measurements) : [];

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>Measurements</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title="No measurements saved." description="Add square footage, linear footage, or fixture counts during intake." />
        ) : (
          <SummaryList items={items.map(([key, value]) => ({ label: formatMeasurementKey(key), value: String(value) }))} />
        )}
      </CardContent>
    </Card>
  );
}

function formatMeasurementKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}

