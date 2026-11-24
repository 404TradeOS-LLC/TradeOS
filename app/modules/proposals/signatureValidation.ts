/**
 * DES-10-F7: a drawn portal signature must be an actual image, not a bare
 * `data:image/` prefix. `data:image/` with an empty or undecodable payload
 * previously passed the service, controller, and trigger checks and could
 * record an acceptance (and award the project) with no signature evidence.
 *
 * The pad produces `data:image/png;base64,...`, so only base64-encoded
 * raster images are accepted. The payload must decode to at least one
 * byte AND start with the magic bytes of the declared type, so
 * `data:image/png;base64,AA==` (one zero byte) and base64-encoded
 * "not an image" are rejected. The same rule is enforced at the HTTP
 * boundary (zod refine), in the service, and in the migration trigger —
 * the database is the last line, so it carries the same check
 * (`public.is_valid_signature_image`, migration
 * 20261124185609_add_signature_image_magic_bytes).
 */
const SIGNATURE_DATA_URL_PATTERN =
  /^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

// Magic bytes (file signatures) for the accepted raster types. WebP is
// RIFF....WEBP: the RIFF prefix is checked here and the WEBP chunk type
// at offset 8 is checked separately below.
const SIGNATURE_MAGIC: Record<string, readonly number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpeg: [0xff, 0xd8, 0xff],
  jpg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38], // "GIF8"
  webp: [0x52, 0x49, 0x46, 0x46], // "RIFF"
};

export function isValidSignatureDataUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = SIGNATURE_DATA_URL_PATTERN.exec(value);
  if (!match) return false;
  // Buffer.from is lenient about padding, so a one-character payload (not
  // a valid base64 quantum) decodes to zero bytes and is rejected here.
  const bytes = Buffer.from(match[2], "base64");
  const magic = SIGNATURE_MAGIC[match[1]];
  if (!magic || bytes.length < magic.length) return false;
  if (!magic.every((byte, index) => bytes[index] === byte)) return false;
  if (match[1] === "webp") {
    // The WEBP chunk type sits at offset 8 (after the 4-byte file size).
    return (
      bytes.length >= 12 &&
      bytes[8] === 0x57 && // W
      bytes[9] === 0x45 && // E
      bytes[10] === 0x42 && // B
      bytes[11] === 0x50 // P
    );
  }
  return true;
}
