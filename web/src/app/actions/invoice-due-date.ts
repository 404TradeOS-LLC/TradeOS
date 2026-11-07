export const INVALID_INVOICE_DUE_DATE = "Enter a valid due date (MM/DD/YYYY or YYYY-MM-DD).";

/**
 * Allow plain keyboard entry in the invoice form, but always send the
 * canonical YYYY-MM-DD date to the API. No timezone conversions.
 */
export function parseInvoiceDueDate(input: string): { date: string | null } | { error: string } {
  const value = input.trim();
  if (!value) return { date: null };

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!us && !iso) return { error: INVALID_INVOICE_DUE_DATE };

  const year = Number(us ? us[3] : iso![1]);
  const month = Number(us ? us[1] : iso![2]);
  const day = Number(us ? us[2] : iso![3]);
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return { error: INVALID_INVOICE_DUE_DATE };
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    return { error: INVALID_INVOICE_DUE_DATE };
  }
  return { date: [year.toString().padStart(4, "0"), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-") };
}
