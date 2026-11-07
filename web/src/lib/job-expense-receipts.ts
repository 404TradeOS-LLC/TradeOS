export const MAX_EXPENSE_RECEIPT_BYTES = 4 * 1024 * 1024;
export const EXPENSE_RECEIPT_BUCKET = "project-files";

export type ExpenseReceiptMime = "image/png" | "image/jpeg" | "application/pdf";

const EXTENSION: Record<ExpenseReceiptMime, string> = {
  "image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf",
};
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function isExpenseReceiptMime(value: string): value is ExpenseReceiptMime {
  return Object.hasOwn(EXTENSION, value);
}

export function validateExpenseReceiptBytes(
  fileName: string, contentType: string, bytes: Uint8Array,
): { fileName: string; contentType: ExpenseReceiptMime; sizeBytes: number } {
  if (!isExpenseReceiptMime(contentType)) throw new Error("Receipt must be JPEG, PNG, or PDF.");
  if (bytes.length < 5 || bytes.length > MAX_EXPENSE_RECEIPT_BYTES) {
    throw new Error("Receipt must be a nonempty file no larger than 4 MB.");
  }
  const name = fileName.trim().replace(/[\\/\r\n]/g, "-").slice(0, 200);
  if (!name) throw new Error("Receipt must have a filename.");
  const extension = name.split(".").pop()?.toLowerCase();
  const allowedExtensions: Record<ExpenseReceiptMime, string[]> = {
    "image/png": ["png"], "image/jpeg": ["jpg", "jpeg"], "application/pdf": ["pdf"],
  };
  if (!allowedExtensions[contentType].includes(extension ?? "")) {
    throw new Error("Receipt extension does not match its content type.");
  }
  const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const pdf = [37, 80, 68, 70, 45].every((v, i) => bytes[i] === v);
  if (!(contentType === "image/png" && png) &&
      !(contentType === "image/jpeg" && jpeg) &&
      !(contentType === "application/pdf" && pdf)) {
    throw new Error("Receipt content does not match the supplied file format.");
  }
  return { fileName: name, contentType, sizeBytes: bytes.length };
}

export function buildExpenseReceiptPath(
  orgId: string, jobId: string, expenseId: string,
  contentType: ExpenseReceiptMime, objectId: string,
): string {
  if (![orgId, jobId, expenseId, objectId].every((id) => UUID.test(id))) {
    throw new Error("Receipt identifiers must be UUIDs.");
  }
  return `job-expenses/${orgId}/${jobId}/${expenseId}/receipt-${objectId}.${EXTENSION[contentType]}`;
}

export function isExpenseReceiptPath(
  orgId: string, jobId: string, expenseId: string,
  contentType: string, storagePath: string,
): boolean {
  if (!isExpenseReceiptMime(contentType)) return false;
  const prefix = `job-expenses/${orgId}/${jobId}/${expenseId}/receipt-`;
  if (!storagePath.startsWith(prefix)) return false;
  const objectId = storagePath.slice(prefix.length).replace(new RegExp(`\\.${EXTENSION[contentType]}$`, "i"), "");
  return storagePath === `${prefix}${objectId}.${EXTENSION[contentType]}` && UUID.test(objectId);
}
