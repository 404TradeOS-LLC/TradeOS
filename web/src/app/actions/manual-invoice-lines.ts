// Pure manual-invoice line transformation for createInvoiceAction.
//
// This module deliberately has no Next.js or app imports: Server Actions
// cannot be imported by the node --test harness, so the parsing, validation,
// and progress-scaling logic lives here, where manual-invoice-lines.test.ts
// executes it directly against real FormData. createInvoiceAction stays
// thin: it delegates to parseManualLineItems, scales, and posts the result.

export type ManualInvoiceLine = {
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  lineTotal?: number;
};

export const MANUAL_LINE_VALIDATION_ERROR =
  "Enter a description, a quantity greater than zero, and a unit price of zero or more for each line item.";
export const MANUAL_LINE_REQUIRED_ERROR = "Add at least one line item for a manual invoice.";

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Parses the indexed manual line fields (lineDescription{i},
// lineQuantity{i}, lineUnitPrice{i}) from a manual-invoice submission.
// Rows carry no billable information when both description and unit price
// are blank, so they are skipped even though the form pre-fills a fresh
// row's quantity with "1" (EMPTY_LINE): an untouched row must not fail the
// whole submission. A row with a price but no description still fails
// validation below, as does a row with a description but a blank price —
// a blank price must not convert via Number("") to 0 and slip through as a
// silent zero-priced line. An explicit "0" stays allowed: "0" is truthy, so
// only a genuinely blank price is rejected.
export function parseManualLineItems(formData: FormData): { lines: ManualInvoiceLine[] } | { error: string } {
  const lineCount = Number(String(formData.get("lineCount") ?? "0"));
  if (!Number.isFinite(lineCount) || lineCount > 100) return { error: MANUAL_LINE_REQUIRED_ERROR };
  const lines: ManualInvoiceLine[] = [];
  for (let index = 0; index < lineCount; index += 1) {
    const description = String(formData.get(`lineDescription${index}`) ?? "").trim();
    const quantityRaw = String(formData.get(`lineQuantity${index}`) ?? "").trim();
    const unitPriceRaw = String(formData.get(`lineUnitPrice${index}`) ?? "").trim();
    if (!description && !unitPriceRaw) continue;
    const quantity = Number(quantityRaw);
    const unitPrice = Number(unitPriceRaw);
    if (
      !description ||
      !unitPriceRaw ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      return { error: MANUAL_LINE_VALIDATION_ERROR };
    }
    lines.push({ description, quantity, unitOfMeasure: "each", unitPrice });
  }
  if (lines.length === 0) return { error: MANUAL_LINE_REQUIRED_ERROR };
  return { lines };
}

// Mirrors the estimate path in app/modules/invoices/service.ts
// (resolveLineItems): a progress invoice scales quantities by
// percentComplete/100 and scales the total with them. Manual lines get the
// same treatment so a progress invoice never persists full-priced lines
// marked partially complete. Line totals are rounded to cents with the
// rounding residual carried on the largest line, so the lines sum exactly
// to the invoice total. Full invoices and invalid percentages pass through
// untouched (the backend remains the backstop for percent validation).
export function scaleManualLinesForProgress(
  lines: ManualInvoiceLine[],
  type: string,
  percentComplete: string,
): ManualInvoiceLine[] {
  if (type !== "progress") return lines;
  const scale = Number(percentComplete) / 100;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) return lines;
  const scaled = lines.map((line) => {
    const quantity = line.quantity * scale;
    return { ...line, quantity, lineTotal: roundCurrency(quantity * line.unitPrice) };
  });
  const amount = roundCurrency(scaled.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const roundedTotal = roundCurrency(scaled.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0));
  const residual = roundCurrency(amount - roundedTotal);
  if (residual !== 0) {
    let largestIndex = 0;
    scaled.forEach((line, index) => {
      if ((line.lineTotal ?? 0) > (scaled[largestIndex].lineTotal ?? 0)) largestIndex = index;
    });
    scaled[largestIndex] = {
      ...scaled[largestIndex],
      lineTotal: roundCurrency((scaled[largestIndex].lineTotal ?? 0) + residual),
    };
  }
  return scaled;
}
