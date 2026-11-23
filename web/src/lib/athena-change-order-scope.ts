// Pure presentation logic for the Change Order row in the job-scoped Athena
// context rail (DES-4, Option A, canonical Figma frame 289:2). Deliberately
// self-contained with zero imports, like web/src/lib/athena-job-access.ts:
// a `node --test` unit test imports this module directly, and relative
// imports break under plain Node's TS runner.
//
// The rail shows the project's latest change order — the highest CO number,
// matching the backend's coNumber-ascending list
// (app/modules/change-orders/service.ts listByProject) — as
// "CO-4 · Draft · +$1,850", the frame's wording with the product's own
// unpadded CO label (web/src/components/projects/project-workspace.tsx
// renders `CO-{coNumber}`). No row renders when the project has no change
// orders, or when every entry is unusable — the rail never invents a price
// (.stitch/DESIGN.md §13).

export interface AthenaChangeOrderScopeInput {
  coNumber: number;
  status: string;
  amount: number;
}

export interface AthenaChangeOrderScopeRow {
  label: "Change order";
  detail: string;
}

// Mirrors the domain status labels for the three change-order statuses
// (app/domain/contracts.ts changeOrderStatuses: draft / approved / rejected).
const CHANGE_ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  rejected: "Rejected",
};

function formatChangeOrderStatus(status: string): string {
  const known = CHANGE_ORDER_STATUS_LABELS[status];
  if (known) return known;
  // Same fallback as the domain getStatusLabel: underscores become spaces.
  const words = status.replaceAll("_", " ");
  return words.length > 0 ? words[0].toUpperCase() + words.slice(1) : status;
}

// Same whole-dollar USD formatting as formatCurrency
// (web/src/lib/document-workflow.ts). The frame shows a signed delta, so a
// non-negative amount carries an explicit "+" — Intl already renders
// negatives as "-$…".
function formatChangeOrderAmount(amount: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
  return amount >= 0 ? `+${formatted}` : formatted;
}

/**
 * Describes the latest change order for the context rail, or null when
 * there is nothing to show. "Latest" is the highest CO number, not input
 * order, so the result does not depend on how the list was sorted.
 */
export function describeLatestChangeOrder(
  changeOrders: readonly AthenaChangeOrderScopeInput[] | null | undefined
): AthenaChangeOrderScopeRow | null {
  if (!changeOrders || changeOrders.length === 0) return null;
  let latest: AthenaChangeOrderScopeInput | null = null;
  for (const changeOrder of changeOrders) {
    if (!Number.isFinite(changeOrder.coNumber) || !Number.isFinite(changeOrder.amount)) continue;
    if (latest === null || changeOrder.coNumber > latest.coNumber) latest = changeOrder;
  }
  if (latest === null) return null;
  return {
    label: "Change order",
    detail: `CO-${latest.coNumber} · ${formatChangeOrderStatus(latest.status)} · ${formatChangeOrderAmount(latest.amount)}`,
  };
}
