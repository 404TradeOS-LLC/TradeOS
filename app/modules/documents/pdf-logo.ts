/**
 * PDFKit image boundary for bytes obtained through an authenticated tenant-owned
 * storage lookup. This module performs NO network requests and never interprets
 * a URL as a file path. Missing/unsafe images leave the existing text identity.
 */
const MAX_PDF_LOGO_BYTES = 1024 * 1024;
const MAX_LOGO_EDGE = 2048;
const MAX_LOGO_PIXELS = 2_000_000;

export interface PdfLogoBox { x: number; y: number; width: number; height: number }

export function validatePdfLogoBytes(bytes: Buffer | null | undefined): Buffer | null {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 || bytes.length > MAX_PDF_LOGO_BYTES) return null;
  let width = 0;
  let height = 0;

  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.toString("ascii", 12, 16) === "IHDR" &&
    bytes.readUInt32BE(8) === 13
  ) {
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // JPEG: follow length-prefixed markers, not untrusted file extensions.
    let index = 2;
    while (index + 4 < bytes.length) {
      if (bytes[index++] !== 0xff) return null;
      while (index < bytes.length && bytes[index] === 0xff) index++;
      if (index >= bytes.length) return null;
      const marker = bytes[index++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker >= 0xd0 && marker <= 0xd7) continue;
      if (index + 2 > bytes.length) return null;
      const length = bytes.readUInt16BE(index);
      if (length < 2 || index + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
        if (length < 7) return null;
        height = bytes.readUInt16BE(index + 3);
        width = bytes.readUInt16BE(index + 5);
        break;
      }
      index += length;
    }
  } else return null;

  return width > 0 && height > 0 && width <= MAX_LOGO_EDGE && height <= MAX_LOGO_EDGE &&
    width * height <= MAX_LOGO_PIXELS ? bytes : null;
}

/** Returns false and preserves the text-only PDF when decoding fails. */
export function drawValidatedPdfLogo(
  doc: PDFKit.PDFDocument,
  image: Buffer | null | undefined,
  box: PdfLogoBox
): boolean {
  const bytes = validatePdfLogoBytes(image);
  if (!bytes || [box.x, box.y, box.width, box.height].some((n) => !Number.isFinite(n)) ||
      box.width <= 0 || box.height <= 0) return false;
  try {
    doc.image(bytes, box.x, box.y, {
      fit: [box.width, box.height],
      align: "center",
      valign: "center",
    });
    return true;
  } catch {
    // Unsupported formats/corrupt streams cannot break contract or invoice downloads.
    return false;
  }
}
