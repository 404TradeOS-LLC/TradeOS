// Pure money helpers for job expenses. Amounts are integer cents end to
// end; the only conversion is the jobsite form's dollar input to cents,
// rounded once to the nearest cent so $19.99 can never become 1998 cents.

export function formatCentsUsd(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}

export function dollarsToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

export const JOB_EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  labor: "Labor",
  material: "Materials",
  equipment: "Equipment",
  disposal: "Disposal",
  subcontractor: "Subcontractor",
  other: "Other",
};

export function expenseCategoryLabel(category: string): string {
  return JOB_EXPENSE_CATEGORY_LABELS[category] ?? category;
}
