import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Project } from "@/lib/api";

interface ProjectOverviewCardProps {
  project: Project;
}

export function ProjectOverviewCard({ project }: ProjectOverviewCardProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {project.simpleScope ? (
          <p className="text-sm text-muted-foreground">{project.simpleScope}</p>
        ) : (
          <EmptyState title="No short scope saved yet." description="Add a one-line summary so everyone can see what work the job includes." />
        )}
      </CardContent>
    </Card>
  );
}
