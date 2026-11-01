export function formatDocumentDate(value: Date | null | undefined): string {
  if (!value || Number.isNaN(value.getTime())) return "Date unavailable";
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDocumentCurrency(value: unknown): string {
  const amount = toFiniteNumber(value);
  return amount === null
    ? "Amount unavailable"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}

export function formatDocumentNumber(value: unknown): string {
  const number = toFiniteNumber(value);
  return number === null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number);
}

export function formatDocumentStatus(value: string | null | undefined): string {
  const status = value?.trim().replaceAll("_", " ");
  return status ? status.replace(/\b\w/g, (character) => character.toUpperCase()) : "Status unavailable";
}

/**
 * Sanitize a user-supplied download filename for a Content-Disposition header.
 * Node rejects non-Latin-1 characters in header values (ERR_INVALID_CHAR), so
 * a project name containing an em-dash, curly quote, or emoji would make a
 * PDF download throw after rendering and surface as a 500. Replace every
 * character outside printable ASCII with "-" so the header is always valid.
 * Whitespace collapsing and casing stay with the filename builders.
 */
export function sanitizeDownloadFilename(filename: string): string {
  return filename.replace(/[^\x20-\x7E]/g, "-");
}

function toFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}
