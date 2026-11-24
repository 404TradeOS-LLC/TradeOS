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
  /** DEV-22(b): customer / service-address identity frozen at acceptance. Null on baselines recorded before the freeze. */
  acceptedCustomerId: string | null;
  acceptedServiceAddressId: string | null;
  acceptedServiceAddress: {
    id: string;
    label: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string | null;
  } | null;
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
  const addressRaw = data.serviceAddress;
  const acceptedServiceAddress =
    addressRaw && typeof addressRaw === "object" && !Array.isArray(addressRaw) &&
    stringOrNull((addressRaw as Record<string, unknown>).id) &&
    stringOrNull((addressRaw as Record<string, unknown>).addressLine1) &&
    stringOrNull((addressRaw as Record<string, unknown>).city) &&
    stringOrNull((addressRaw as Record<string, unknown>).state) &&
    stringOrNull((addressRaw as Record<string, unknown>).postalCode)
      ? {
          id: stringOrNull((addressRaw as Record<string, unknown>).id) as string,
          label: stringOrNull((addressRaw as Record<string, unknown>).label),
          addressLine1: stringOrNull((addressRaw as Record<string, unknown>).addressLine1) as string,
          addressLine2: stringOrNull((addressRaw as Record<string, unknown>).addressLine2),
          city: stringOrNull((addressRaw as Record<string, unknown>).city) as string,
          state: stringOrNull((addressRaw as Record<string, unknown>).state) as string,
          postalCode: stringOrNull((addressRaw as Record<string, unknown>).postalCode) as string,
          country: stringOrNull((addressRaw as Record<string, unknown>).country),
        }
      : null;
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
    acceptedCustomerId: stringOrNull(data.customerId),
    acceptedServiceAddressId: stringOrNull(data.serviceAddressId),
    acceptedServiceAddress,
  };
}
export function formatApprovedMoney(value: string | null): string {
  if (!value) return "Not finalized";
  const amount = Number(value);
  return Number.isSafeInteger(Math.round(amount * 100))
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
    : "Unavailable";
}
