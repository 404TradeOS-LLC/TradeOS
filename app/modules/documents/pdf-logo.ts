/**
 * PDFKit image boundary for bytes obtained through an authenticated tenant-owned
 * storage lookup. This module performs NO network requests and never interprets
 * a URL as a file path. Missing/unsafe images leave the existing text identity.
 */
import { inflateSync } from "node:zlib";

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

/**
 * Returns false and preserves the text-only PDF when decoding fails.
 * PNG bytes additionally prove their pixel stream decodes first
 * (isDecodablePngImage): PDFKit (png-js) inflates IDAT asynchronously and
 * throws inflate/filter errors inside the zlib callback — outside any
 * try/catch around doc.image and outside the document's error listener —
 * so a header-valid PNG with corrupt pixel data would hang or crash the
 * process instead of falling back to text. JPEGs need no pixel
 * pre-validation: PDFKit embeds their DCT data directly and any marker
 * error throws synchronously from doc.image, inside the try/catch below.
 */
export function drawValidatedPdfLogo(
  doc: { image: (source: Buffer, x: number, y: number, options: { fit: [number, number]; align: "center"; valign: "center" }) => unknown },
  image: Buffer | null | undefined,
  box: PdfLogoBox
): boolean {
  const bytes = validatePdfLogoBytes(image);
  if (!bytes || [box.x, box.y, box.width, box.height].some((n) => !Number.isFinite(n)) ||
      box.width <= 0 || box.height <= 0) return false;
  if (bytes[0] === 0x89 && !isDecodablePngImage(bytes)) return false;
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

// CRC-32 (ISO 3309, polynomial 0xEDB88320), computed over chunk type + data.
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function pngCrc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const PNG_CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const ADAM7_PASSES: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

/**
 * Proves a PNG's pixel stream fully decodes before PDFKit touches it.
 * PDFKit (png-js) inflates IDAT asynchronously and throws inflate/filter
 * errors inside the zlib callback — outside any try/catch around doc.image
 * and outside the document's error listener — so a header-valid PNG with
 * corrupt pixel data would hang or crash the process instead of falling
 * back to text. Returns false for anything that is not a structurally
 * sound, fully decodable PNG; callers fall back to text. Inflation is
 * bounded by the expected output size, so a zip-bomb stream fails closed.
 */
export function isDecodablePngImage(bytes: Buffer): boolean {
  try {
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.length < 8 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      return false;
    }
    let pos = 8;
    let ihdr: { width: number; height: number; bitDepth: number; colorType: number; interlace: number } | null = null;
    const idat: Buffer[] = [];
    let sawIend = false;
    let first = true;
    while (pos + 8 <= bytes.length) {
      const length = bytes.readUInt32BE(pos);
      const type = bytes.toString("ascii", pos + 4, pos + 8);
      if (length > bytes.length - pos - 12) return false;
      const data = bytes.subarray(pos + 8, pos + 8 + length);
      if (pngCrc32(bytes.subarray(pos + 4, pos + 8 + length)) !== bytes.readUInt32BE(pos + 8 + length)) return false;
      if (first && type !== "IHDR") return false;
      first = false;
      if (type === "IHDR") {
        if (length !== 13 || ihdr) return false;
        // Compression method and filter method must both be 0.
        if (data[10] !== 0 || data[11] !== 0) return false;
        ihdr = {
          width: bytes.readUInt32BE(pos + 8),
          height: bytes.readUInt32BE(pos + 12),
          bitDepth: data[8],
          colorType: data[9],
          interlace: data[12],
        };
        if (ihdr.width === 0 || ihdr.height === 0) return false;
      } else if (type === "IDAT") {
        idat.push(Buffer.from(data));
      } else if (type === "IEND") {
        sawIend = true;
        break;
      }
      pos += 12 + length;
    }
    if (!ihdr || !sawIend || idat.length === 0) return false;
    const channels = PNG_CHANNELS[ihdr.colorType];
    if (channels === undefined) return false;
    if (![1, 2, 4, 8, 16].includes(ihdr.bitDepth)) return false;
    if (ihdr.colorType === 3 && ihdr.bitDepth === 16) return false;
    if (
      (ihdr.colorType === 2 || ihdr.colorType === 4 || ihdr.colorType === 6) &&
      ihdr.bitDepth !== 8 &&
      ihdr.bitDepth !== 16
    ) {
      return false;
    }
    if (ihdr.interlace !== 0 && ihdr.interlace !== 1) return false;
    const header = ihdr;
    const rowBytes = (w: number) => Math.ceil((w * channels * header.bitDepth) / 8);
    const passes = header.interlace === 1 ? ADAM7_PASSES : [[0, 0, 1, 1] as const];
    let expected = 0;
    for (const [x0, y0, dx, dy] of passes) {
      const w = Math.max(0, Math.ceil((header.width - x0) / dx));
      const h = Math.max(0, Math.ceil((header.height - y0) / dy));
      if (w > 0 && h > 0) expected += h * (1 + rowBytes(w));
    }
    const pixels = inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
    if (pixels.length !== expected) return false;
    let offset = 0;
    for (const [x0, y0, dx, dy] of passes) {
      const w = Math.max(0, Math.ceil((header.width - x0) / dx));
      const h = Math.max(0, Math.ceil((header.height - y0) / dy));
      if (w === 0 || h === 0) continue;
      const stride = 1 + rowBytes(w);
      for (let row = 0; row < h; row++) {
        if (pixels[offset + row * stride] > 4) return false;
      }
      offset += h * stride;
    }
    return true;
  } catch {
    return false;
  }
}
