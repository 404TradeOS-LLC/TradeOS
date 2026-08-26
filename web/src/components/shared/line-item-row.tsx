import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LineItemRowProps {
  description: string;
  meta?: string;
  amount: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Row for a priced line item (estimate/invoice line items). Description and meta truncate
 * rather than push the amount/action off the edge of the card on narrow viewports.
 */
export function LineItemRow({ description, meta, amount, action, className }: LineItemRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-md border p-3 text-sm", className)}>
      <div className="min-w-0">
        <div className="truncate font-medium">{description}</div>
        {meta ? <div className="truncate text-muted-foreground">{meta}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-medium">{amount}</span>
        {action}
      </div>
    </div>
  );
}
