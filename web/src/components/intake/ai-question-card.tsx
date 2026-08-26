import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AIQuestionCardProps {
  question: string;
  index?: number;
  className?: string;
}

export function AIQuestionCard({ question, index, className }: AIQuestionCardProps) {
  return (
    <Card className={cn("border-border/70 bg-background/80", className)}>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Question {typeof index === "number" ? index : ""}
        </div>
        <p className="mt-2 text-sm text-foreground">{question}</p>
      </CardContent>
    </Card>
  );
}
