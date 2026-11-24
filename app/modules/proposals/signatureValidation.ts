/**
 * DES-10-F7: a drawn portal signature must be an actual image, not a bare
 * `data:image/` prefix. `data:image/` with an empty or undecodable payload
 * previously passed the service, controller, and trigger checks and could
 * record an acceptance (and award the project) with no signature evidence.
 *
 * The pad produces `data:image/png;base64,...`, so only base64-encoded
 * raster images are accepted, and the payload must decode to at least one
 * byte. The same rule is enforced at the HTTP boundary (zod refine), in
 * the service, and in the migration trigger — the database is the last
 * line, so it carries the same regex.
 */
const SIGNATURE_DATA_URL_PATTERN =
  /^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

export function isValidSignatureDataUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = SIGNATURE_DATA_URL_PATTERN.exec(value);
  if (!match) return false;
  // Buffer.from is lenient about padding, so a one-character payload (not
  // a valid base64 quantum) decodes to zero bytes and is rejected here.
  return Buffer.from(match[2], "base64").length > 0;
}
