export interface ImportRow {
  [key: string]: unknown;
}

export const MAX_BATCH_ROWS = 100;
export const MAX_BATCH_BYTES = 80 * 1024;

function encodedBatchBytes(rows: ImportRow[]): number {
  return new TextEncoder().encode(JSON.stringify({ rows })).byteLength;
}

export function buildCompositeImportBatches(rows: ImportRow[]): ImportRow[][] {
  const batches: ImportRow[][] = [];
  let current: ImportRow[] = [];

  for (const row of rows) {
    const singleRowBytes = encodedBatchBytes([row]);
    if (singleRowBytes > MAX_BATCH_BYTES) {
      throw new Error(
        `An import row is too large to send safely (${singleRowBytes.toLocaleString()} bytes; maximum ${MAX_BATCH_BYTES.toLocaleString()} bytes).`
      );
    }

    const candidate = [...current, row];
    const candidateBytes = encodedBatchBytes(candidate);

    if (current.length > 0 && (candidate.length > MAX_BATCH_ROWS || candidateBytes > MAX_BATCH_BYTES)) {
      batches.push(current);
      current = [row];
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) batches.push(current);
  return batches;
}
