import { prisma } from "../../db/client";
import { validatePdfLogoBytes } from "./pdf-logo";

/**
 * Reads only the active private asset for the authenticated organization's
 * current `logoUrl` slot. The orgId must come from the verified request context,
 * never a user-supplied URL or an untrusted PDF request parameter.
 *
 * No secrets, arbitrary URLs, or storage object paths are returned to callers.
 * If storage is not configured or anything is missing/invalid, the PDF falls
 * back to the contractor's company name.
 */
const MAX_LOGO_BYTES = 1024 * 1024;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_PATTERN = new RegExp(`^${UUID}$`, "i");

export async function loadOrganizationPdfLogo(orgId?: string): Promise<Buffer | null> {
  if (!orgId || !UUID_PATTERN.test(orgId)) return null;
  const base = process.env.SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !secret) return null;

  let origin: URL;
  try {
    origin = new URL(base);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.search ||
        origin.hash || origin.pathname !== "/" || !origin.hostname.endsWith(".supabase.co")) return null;
  } catch { return null; }

  try {
    const row = await prisma.settingsAssetUpload.findUnique({
      where: { orgId_assetKey: { orgId, assetKey: "logoUrl" } },
      select: { orgId: true, assetKey: true, storageBucket: true, storagePath: true, contentType: true, sizeBytes: true },
    });
    if (!row || row.orgId !== orgId || row.assetKey !== "logoUrl" || row.storageBucket !== "project-files" ||
        row.sizeBytes < 24 || row.sizeBytes > MAX_LOGO_BYTES) return null;

    const pathPattern = new RegExp(`^organizations/${orgId}/brand-assets/logoUrl-${UUID}$`, "i");
    if (!pathPattern.test(row.storagePath) || !["image/png", "image/jpeg"].includes(row.contentType)) return null;

    const resource = new URL(`/storage/v1/object/authenticated/project-files/${row.storagePath}`, origin);
    const response = await fetch(resource, {
      headers: { Authorization: `Bearer ${secret}`, apikey: secret },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok || !response.body) return null;
    const responseType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (responseType !== row.contentType) return null;
    const length = response.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_LOGO_BYTES)) return null;

    const reader = response.body.getReader();
    const parts: Buffer[] = [];
    let count = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        count += result.value.byteLength;
        if (count > MAX_LOGO_BYTES) {
          await reader.cancel().catch(() => undefined);
          return null;
        }
        parts.push(Buffer.from(result.value));
      }
    } finally { reader.releaseLock(); }

    const bytes = Buffer.concat(parts);
    if (row.contentType === "image/png" && !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return null;
    if (row.contentType === "image/jpeg" && !(bytes[0] === 255 && bytes[1] === 216)) return null;
    return validatePdfLogoBytes(bytes);
  } catch {
    // Never include secret, path, response body or tenant details in error logs.
    return null;
  }
}
