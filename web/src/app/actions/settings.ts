"use server";

import { clearSettingsAssetUpload, getOrganizationSettings, recordSettingsAssetUpload, type SettingsAssetKey } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildSettingsAssetStoragePath,
  generateSettingsAssetObjectName,
  isAllowedSettingsAssetKey,
  validateSettingsAssetUpload,
} from "@/lib/settingsAssetUpload";
import { hasAnyPermission } from "@/domain";

const SETTINGS_ASSET_BUCKET = "project-files";

export interface UploadSettingsAssetResult {
  url?: string;
  error?: string;
}

// Brand asset fields (logo/dark logo/icon/watermark) previously staged an
// ephemeral `URL.createObjectURL()` blob straight into the settings draft,
// which is only valid for the current tab/session and silently produced a
// dead image URL after PATCH /settings persisted it and the page reloaded.
//
// This uploads to the "project-files" bucket via a server-only service_role
// Supabase client (see @/lib/supabase/admin) -- never the anon/publishable
// key -- so Storage-layer access does not depend on Storage RLS policies at
// all. Authorization is enforced entirely here, server-side, before any
// Storage call is made: a valid session, active org membership (via
// getOrganizationSettings), and the admin-equivalent role check below.
//
// Replacement is upload-new-then-delete-old, not overwrite-in-place: a fresh,
// server-generated object name is used for every upload (including
// replacing an existing asset), the new metadata is persisted via the
// backend's settings_asset_uploads record first, and only after that
// succeeds is the previous object (if any) deleted. This means a crash or
// failure between "new object uploaded" and "old object deleted" leaves an
// orphaned old object, never a missing/broken current asset -- the active
// asset is never in an invalid state.
export async function uploadSettingsAssetAction(formData: FormData): Promise<UploadSettingsAssetResult> {
  const token = await getSessionToken();
  if (!token) return { error: "Not authenticated." };

  const file = formData.get("file");
  const assetKey = String(formData.get("assetKey") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Select a file to upload." };
  }

  const validationError = validateSettingsAssetUpload({
    assetKey,
    file: { size: file.size, type: file.type },
  });
  if (validationError) return { error: validationError };

  // validateSettingsAssetUpload already checked this via
  // isAllowedSettingsAssetKey internally; re-checking here narrows the type
  // for the calls below rather than casting.
  if (!isAllowedSettingsAssetKey(assetKey)) {
    return { error: "Unsupported asset field." };
  }
  const typedAssetKey = assetKey as SettingsAssetKey;

  try {
    // orgId and currentRole come from the authenticated session's own
    // organization membership (an HTTP call to the trusted backend, verified
    // by bearer JWT + forced RLS on that side) -- never from client-supplied
    // form data, so a crafted request cannot target another organization.
    const { orgId, currentRole } = await getOrganizationSettings(token);

    // Persisting a branding asset URL happens through PATCH /api/v1/settings,
    // which the backend gates with requireOrgAdmin — team.manage /
    // company.manage / settings.manage. Mirror the same permission set here
    // instead of inventing a new authorization mechanism, since this action
    // also performs a privileged write (to Storage, then to the backend's
    // asset-metadata endpoint) that ordinary org members should not be able
    // to trigger.
    if (!hasAnyPermission(currentRole, ["team.manage", "company.manage", "settings.manage"])) {
      return { error: "Admin access required." };
    }

    const objectName = generateSettingsAssetObjectName(typedAssetKey);
    const storagePath = buildSettingsAssetStoragePath(orgId, typedAssetKey, objectName);
    const contentType = file.type || "application/octet-stream";

    const supabase = createSupabaseAdminClient();
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from(SETTINGS_ASSET_BUCKET).upload(storagePath, fileBuffer, {
      contentType,
      upsert: false, // every upload gets a fresh path; a collision would mean a bug, not a legitimate overwrite
    });

    if (uploadError) {
      // Don't surface Supabase's raw error text to the client — it can
      // include bucket/path internals. Log server-side for diagnosis and
      // return a generic message instead.
      console.error("uploadSettingsAssetAction: Supabase Storage upload failed", uploadError);
      return { error: "Upload failed. Please try again." };
    }

    let previousStoragePath: string | null = null;
    try {
      const result = await recordSettingsAssetUpload(token, {
        assetKey: typedAssetKey,
        storageBucket: SETTINGS_ASSET_BUCKET,
        storagePath,
        contentType,
        sizeBytes: file.size,
      });
      previousStoragePath = result.previous?.storagePath ?? null;
    } catch (err) {
      // The new object is uploaded but not yet recorded as current -- it is
      // an orphan, not a corrupted active asset (the previous metadata row,
      // if any, is untouched). Clean up the orphan best-effort and report
      // failure; do not delete anything the metadata service doesn't confirm
      // is superseded.
      console.error("uploadSettingsAssetAction: failed to persist asset metadata", err);
      await supabase.storage
        .from(SETTINGS_ASSET_BUCKET)
        .remove([storagePath])
        .catch((cleanupErr) => console.error("uploadSettingsAssetAction: orphan cleanup also failed", cleanupErr));
      return { error: "Upload failed. Please try again." };
    }

    if (previousStoragePath && previousStoragePath !== storagePath) {
      const { error: removeError } = await supabase.storage.from(SETTINGS_ASSET_BUCKET).remove([previousStoragePath]);
      if (removeError) {
        // The new asset is already the recorded current one -- this is a
        // reportable orphan-cleanup failure, not a failed upload. Never fail
        // the request for this; the user's upload succeeded.
        console.error("uploadSettingsAssetAction: failed to delete superseded object", previousStoragePath, removeError);
      }
    }

    // The returned value is a stable, app-owned proxy path
    // (web/src/app/api/brand-assets/[orgId]/[assetKey]/route.ts), never a
    // raw Supabase URL -- the bucket is private, so there is no public URL to
    // return, and the proxy route is what actually authenticates the read
    // and streams bytes via the service_role client.
    return { url: `/api/brand-assets/${orgId}/${typedAssetKey}` };
  } catch (err) {
    console.error("uploadSettingsAssetAction: unexpected error", err);
    return { error: "Upload failed. Please try again." };
  }
}

export interface RemoveSettingsAssetResult {
  ok?: true;
  error?: string;
}

// Explicit "Remove" action: deletes the metadata record and the underlying
// storage object. Unlike staging an empty string into the draft and waiting
// for "Save changes" (the previous behavior), this takes effect immediately
// -- the asset stops resolving via the proxy route right away -- since it
// now involves a real storage delete, not just clearing a display string.
export async function removeSettingsAssetAction(assetKey: string): Promise<RemoveSettingsAssetResult> {
  const token = await getSessionToken();
  if (!token) return { error: "Not authenticated." };

  if (!isAllowedSettingsAssetKey(assetKey)) {
    return { error: "Unsupported asset field." };
  }
  const typedAssetKey = assetKey as SettingsAssetKey;

  try {
    const { currentRole } = await getOrganizationSettings(token);
    if (!hasAnyPermission(currentRole, ["team.manage", "company.manage", "settings.manage"])) {
      return { error: "Admin access required." };
    }

    const { cleared } = await clearSettingsAssetUpload(token, typedAssetKey);
    if (!cleared) return { ok: true }; // nothing was set; already in the desired state

    const supabase = createSupabaseAdminClient();
    const { error: removeError } = await supabase.storage.from(SETTINGS_ASSET_BUCKET).remove([cleared.storagePath]);
    if (removeError) {
      // The metadata record is already gone (the asset is correctly "removed"
      // from the app's point of view); this is an orphan-cleanup failure,
      // not a failed removal.
      console.error("removeSettingsAssetAction: failed to delete storage object", cleared.storagePath, removeError);
    }

    return { ok: true };
  } catch (err) {
    console.error("removeSettingsAssetAction: unexpected error", err);
    return { error: "Remove failed. Please try again." };
  }
}
