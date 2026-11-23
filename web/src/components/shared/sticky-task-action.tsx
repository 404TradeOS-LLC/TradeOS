import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StickyTaskActionProps {
  /** Label of the single dominant action (Figma StickyTaskAction Button label). */
  label: string;
  /** Disables the action (e.g. nothing valid to save yet). */
  disabled?: boolean;
  /** Button type. Use "submit" when the action submits the enclosing form. */
  type?: "button" | "submit";
  /** Click handler for non-submit actions. */
  onClick?: () => void;
  /** Optional supporting guidance rendered below the action (Figma hint variant: Shown). */
  hint?: ReactNode;
  /** Extra classes merged onto the sticky shell (e.g. container bleed). */
  className?: string;
}

/**
 * StickyTaskAction — the canonical Figma component (master file
 * xImUa9CYUjx3Cb3zTrkfnY, node 268:93) as a shared code component.
 *
 * One dominant mobile action above the Control Dock with safe-area clearance
 * (`.stitch/DESIGN.md` §10–11): the shell sticks to
 * `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]` — the 4.5rem dock height
 * plus the device safe area — and renders one full-width primary Button
 * (`min-h-11`, the 44px touch target) with an optional supporting hint below
 * it. At `md` and above there is no Control Dock, so the shell goes static
 * and unstyled and the button shrinks to its natural width.
 *
 * Use only when one bottom action materially advances the current mobile
 * task (Save Expense, Approve Change, Record Payment, Use in Estimate,
 * continue to next estimate stage). If the content already contains a strong
 * primary CTA, do not add a second one merely because mobile has room.
 *
 * Convergence notes vs Figma: the Figma frame is a fixed 358px wide with a
 * 36px button and an 8px centered hint; production is fluid-width, keeps the
 * 44px minimum touch target, and uses the existing `text-xs` muted hint
 * style. The Athena workspace composer is intentionally not migrated here —
 * it is a multi-element composer, not a single dominant action, and PR #1029
 * owns that file; see the follow-up in the PR body.
 */
export function StickyTaskAction({
  label,
  disabled = false,
  type = "button",
  onClick,
  hint,
  className,
}: StickyTaskActionProps) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 border-t border-border/70 bg-card/95 pt-4 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:pt-0 md:backdrop-blur-none",
        className,
      )}
    >
      <Button type={type} disabled={disabled} onClick={onClick} className="min-h-11 w-full md:w-auto">
        {label}
      </Button>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
