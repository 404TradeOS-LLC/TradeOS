/** Read-only, validated presentation of a snapshot stored at approval handoff.
 * Null/malformed values stay unknown; they are never re-priced from Costbook.
 */
export interface ApprovedJobBaseline {
  proposalId: string;
  estimateId: string | null;
  scopeOfWork: string | null;
  assumptions: string | null;
  exclusions: string | null;
  timeline: string | null;
  finalPrice: string | null;
  priceLow: string | null;
  priceHigh: string | null;
  termsAndConditions: string | null;
  paymentMilestones: Array<{ label: string; amountPercent: number }>;
}
function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function priceOrNull(value: unknown): string | null {
  const s = stringOrNull(value);
  return s && /^\d+(?:\.\d{1,2})?$/.test(s) ? s : null;
}
export function readApprovedJobBaseline(value: unknown): ApprovedJobBaseline | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || !stringOrNull(data.proposalId)) return null;
  const milestones = Array.isArray(data.paymentScheduleJson)
    ? data.paymentScheduleJson.flatMap((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const entry = item as Record<string, unknown>;
      const label = stringOrNull(entry.label);
      const amount = entry.amountPercent;
      return label && typeof amount === "number" && Number.isFinite(amount) && amount > 0 && amount <= 100
        ? [{ label, amountPercent: amount }]
        : [];
    })
    : [];
  return {
    proposalId: data.proposalId as string,
    estimateId: stringOrNull(data.estimateId),
    scopeOfWork: stringOrNull(data.scopeOfWork),
    assumptions: stringOrNull(data.assumptions),
    exclusions: stringOrNull(data.exclusions),
    timeline: stringOrNull(data.timeline),
    finalPrice: priceOrNull(data.finalPrice),
    priceLow: priceOrNull(data.priceLow),
    priceHigh: priceOrNull(data.priceHigh),
    termsAndConditions: stringOrNull(data.termsAndConditions),
    paymentMilestones: milestones,
  };
}
export function formatApprovedMoney(value: string | null): string {
  if (!value) return "Not finalized";
  const amount = Number(value);
  return Number.isSafeInteger(Math.round(amount * 100))
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
    : "Unavailable";
}
