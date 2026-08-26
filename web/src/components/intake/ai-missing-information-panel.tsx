import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AIQuestionCard } from "./ai-question-card";

interface AIMissingInformationPanelProps {
  items: string[];
}

export function AIMissingInformationPanel({ items }: AIMissingInformationPanelProps) {
  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>Missing information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <EmptyState title="Nothing critical missing." description="The latest intake pass is complete enough to prepare reviewed estimate suggestions." />
        ) : (
          items.map((item, index) => <AIQuestionCard key={item} question={item} index={index + 1} />)
        )}
      </CardContent>
    </Card>
  );
}
