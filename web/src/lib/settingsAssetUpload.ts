// Pure validation helpers for uploadSettingsAssetAction (web/src/app/actions/settings.ts).
// Deliberately framework-free (no "server-only", no Next/Supabase imports) so this module
// can be unit tested directly with node:test, without a Next.js request context.

export const ALLOWED_SETTINGS_ASSET_KEYS = ["logoUrl", "darkLogoUrl", "iconUrl", "watermarkUrl"] as const;

export type SettingsAssetKey = (typeof ALLOWED_SETTINGS_ASSET_KEYS)[number];

const ALLOWED_SETTINGS_ASSET_KEY_SET: ReadonlySet<string> = new Set(ALLOWED_SETTINGS_ASSET_KEYS);

export function isAllowedSettingsAssetKey(key: string): key is SettingsAssetKey {
  return ALLOWED_SETTINGS_ASSET_KEY_SET.has(key);
}

export const MAX_SETTINGS_ASSET_UPLOAD_BYTES = 6 * 1024 * 1024;

export const ALLOWED_SETTINGS_ASSET_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/x-icon",
] as const;

const ALLOWED_SETTINGS_ASSET_CONTENT_TYPE_SET: ReadonlySet<string> = new Set(ALLOWED_SETTINGS_ASSET_CONTENT_TYPES);

export interface SettingsAssetUploadCandidate {
  size: number;
  type: string;
}

export interface ValidateSettingsAssetUploadParams {
  assetKey: string;
  file: SettingsAssetUploadCandidate;
}

// Returns an error message, or null when the upload may proceed.
//
// This no longer takes an isPublicBucket flag: the "project-files" bucket is
// private under the current architecture (see docs/modules/brand-studio.md
// and the PR #30 storage-redesign proposal), and every read/write goes
// through a server-only service_role Supabase client that bypasses Storage
// RLS entirely, so bucket visibility is not a per-upload validation concern.
export function validateSettingsAssetUpload({ assetKey, file }: ValidateSettingsAssetUploadParams): string | null {
  if (!assetKey) return "Missing asset field.";
  if (!isAllowedSettingsAssetKey(assetKey)) return "Unsupported asset field.";
  if (!ALLOWED_SETTINGS_ASSET_CONTENT_TYPE_SET.has(file.type)) {
    return "Brand assets must be PNG, JPEG, WebP, GIF, or ICO files.";
  }
  if (file.size > MAX_SETTINGS_ASSET_UPLOAD_BYTES) return "Each brand asset must be 6MB or smaller.";
  return null;
}

// A UUID-shaped orgId is required before it's ever interpolated into a
// storage path. orgId always comes from the authenticated session
// server-side (see uploadSettingsAssetAction), never from client input, but
// this is kept as an explicit defensive check rather than an implicit
// assumption -- if that ever changed, a malformed/crafted orgId would fail
// loudly here instead of silently producing an unexpected storage path.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSafeOrgId(orgId: string): boolean {
  return UUID_PATTERN.test(orgId);
}

// Server-generated object name for a new upload. Every upload -- including a
// replacement of an existing slot -- gets a fresh name; there is no
// "overwrite in place" path. The caller (uploadSettingsAssetAction) uploads
// the new object under this name, records it as the new current asset via
// the backend, and only then deletes whatever object the backend reports was
// previously current for that slot -- an upload/persist/delete-old sequence,
// not upload/overwrite. The original filename is intentionally never part of
// the object name (no user-controlled path segment at all): Supabase Storage
// keeps the real contentType on the object itself, and this also means there
// is no filename-derived input for a path-traversal or arbitrary-extension
// attempt to hide inside.
export function generateSettingsAssetObjectName(assetKey: SettingsAssetKey): string {
  return `${assetKey}-${crypto.randomUUID()}`;
}

// Full storage path for a given org/asset upload. Organized under
// "organizations/<organizationId>/brand-assets/" to read unambiguously as
// org-scoped storage, distinct from web/src/app/actions/projects.ts's
// project-document paths in the same bucket.
export function buildSettingsAssetStoragePath(orgId: string, assetKey: SettingsAssetKey, objectName: string): string {
  if (!isSafeOrgId(orgId)) {
    throw new Error("Invalid organization id.");
  }
  return `organizations/${orgId}/brand-assets/${objectName}`;
}

export function buildSettingsAssetStoragePrefix(orgId: string, assetKey: SettingsAssetKey): string {
  if (!isSafeOrgId(orgId)) {
    throw new Error("Invalid organization id.");
  }
  return `organizations/${orgId}/brand-assets/${assetKey}-`;
}

const GENERATED_SETTINGS_ASSET_OBJECT_PATTERN =
  /^(logoUrl|darkLogoUrl|iconUrl|watermarkUrl)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGeneratedSettingsAssetObjectName(assetKey: SettingsAssetKey, objectName: string): boolean {
  return objectName.startsWith(`${assetKey}-`) && GENERATED_SETTINGS_ASSET_OBJECT_PATTERN.test(objectName);
}

export function isGeneratedSettingsAssetStoragePath(
  orgId: string,
  assetKey: SettingsAssetKey,
  storagePath: string
): boolean {
  if (!isSafeOrgId(orgId) || !isAllowedSettingsAssetKey(assetKey)) return false;
  const prefix = `organizations/${orgId}/brand-assets/`;
  if (!storagePath.startsWith(prefix)) return false;
  return isGeneratedSettingsAssetObjectName(assetKey, storagePath.slice(prefix.length));
}

export const SETTINGS_ASSET_CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;

export interface SettingsAssetStorageEntry {
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SettingsAssetCleanupCandidate {
  assetKey: SettingsAssetKey;
  storagePath: string;
  updatedAt: string;
}

export function selectSettingsAssetCleanupCandidates({
  orgId,
  assetKey,
  entries,
  currentStoragePath,
  now = Date.now(),
  graceMs = SETTINGS_ASSET_CLEANUP_GRACE_MS,
}: {
  orgId: string;
  assetKey: SettingsAssetKey;
  entries: SettingsAssetStorageEntry[];
  currentStoragePath: string | null;
  now?: number;
  graceMs?: number;
}): { candidates: SettingsAssetCleanupCandidate[]; skipped: number } {
  if (!isSafeOrgId(orgId) || graceMs < 0) return { candidates: [], skipped: entries.length };
  const generatedPrefix = buildSettingsAssetStoragePrefix(orgId, assetKey);
  const prefix = generatedPrefix.slice(0, generatedPrefix.lastIndexOf("/")) + "/";
  const candidates: SettingsAssetCleanupCandidate[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const storagePath = `${prefix}${entry.name}`;
    const updatedAt = entry.updated_at ?? entry.created_at;
    const timestamp = updatedAt ? Date.parse(updatedAt) : Number.NaN;
    if (
      !isGeneratedSettingsAssetStoragePath(orgId, assetKey, storagePath) ||
      storagePath === currentStoragePath ||
      !updatedAt ||
      !Number.isFinite(timestamp) ||
      now - timestamp < graceMs
    ) {
      skipped += 1;
      continue;
    }
    candidates.push({ assetKey, storagePath, updatedAt });
  }

  return { candidates, skipped };
}
