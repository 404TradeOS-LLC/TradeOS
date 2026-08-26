import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline } from "@/components/shared/timeline";
import type { Project } from "@/lib/api";

interface ProjectStatusTimelineProps {
  project: Project;
  hasIntake: boolean;
  hasProposal: boolean;
  hasContract?: boolean;
  hasInvoice?: boolean;
}

export function ProjectStatusTimeline({ project, hasIntake, hasProposal, hasContract = false, hasInvoice = false }: ProjectStatusTimelineProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Workflow</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline
          items={[
            { label: "Customer", value: project.customerId ? "Customer linked" : "Add a customer", active: Boolean(project.customerId) },
            { label: "Scope", value: project.simpleScope ? "Short scope saved" : "Add a short scope", active: Boolean(project.simpleScope) },
            { label: "Site visit", value: hasIntake ? "Notes saved" : "Record site visit notes", active: hasIntake },
            { label: "Proposal draft", value: hasProposal ? "Draft created" : "Create a proposal draft", active: hasProposal },
            { label: "Contract", value: hasContract ? "Agreement in flight" : "Generate after acceptance", active: hasContract },
            { label: "Invoice", value: hasInvoice ? "Billing created" : "Invoice after signing", active: hasInvoice },
          ]}
        />
      </CardContent>
    </Card>
  );
}
