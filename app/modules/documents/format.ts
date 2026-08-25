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

function toFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}
