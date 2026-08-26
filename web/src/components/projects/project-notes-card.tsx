import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

interface ProjectNotesCardProps {
  title: string;
  notes: string | null;
}

export function ProjectNotesCard({ title, notes }: ProjectNotesCardProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{notes ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{notes}</p> : <EmptyState title="No notes saved yet." description="Add a short job summary so the project stays easy to scan." />}</CardContent>
    </Card>
  );
}
