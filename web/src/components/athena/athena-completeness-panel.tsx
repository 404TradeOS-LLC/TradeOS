import { Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AthenaTraceCompleteness } from "@/lib/api";
import { formatAthenaPercent } from "@/lib/athena-overview-model";

/**
 * Turns AthenaTraceCompleteness's three parallel arrays (expected/observed/
 * missing span types) into a single legible checklist instead of raw JSON
 * arrays, per the task spec.
 */
export function AthenaCompletenessPanel({ completeness }: { completeness: AthenaTraceCompleteness }) {
  const observed = new Set(completeness.observedSpanTypes);

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Trace completeness</CardTitle>
        <CardDescription>
          {formatAthenaPercent(completeness.score)} of this trace&apos;s expected telemetry spans were actually recorded.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2">
          {completeness.expectedSpanTypes.map((spanType) => {
            const isObserved = observed.has(spanType);
            return (
              <li
                key={spanType}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm"
              >
                {isObserved ? (
                  <Check aria-hidden="true" className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <X aria-hidden="true" className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span className={isObserved ? "text-foreground" : "text-muted-foreground"}>{spanType}</span>
                {!isObserved ? <span className="ml-auto text-xs text-muted-foreground">missing</span> : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
