import "server-only";

import { getOrganizationSettings, getSettingsAssetUpload } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_SETTINGS_ASSET_KEYS,
  buildSettingsAssetStoragePrefix,
  isSafeOrgId,
  SETTINGS_ASSET_CLEANUP_GRACE_MS,
  selectSettingsAssetCleanupCandidates,
  type SettingsAssetCleanupCandidate,
} from "@/lib/settingsAssetUpload";
import { hasAnyPermission } from "@/domain";

export const SETTINGS_ASSET_BUCKET = "project-files";
export { SETTINGS_ASSET_CLEANUP_GRACE_MS };
export type { SettingsAssetCleanupCandidate };

export interface ReconcileSettingsAssetsResult {
  dryRun: boolean;
  candidates: SettingsAssetCleanupCandidate[];
  deleted: string[];
  failures: string[];
  skipped: number;
}

export async function reconcileSettingsAssetsAction({
  dryRun = true,
}: {
  dryRun?: boolean;
} = {}): Promise<ReconcileSettingsAssetsResult | { error: string }> {
  const token = await getSessionToken();
  if (!token) return { error: "Not authenticated." };

  try {
    const { orgId, currentRole } = await getOrganizationSettings(token);
    if (!hasAnyPermission(currentRole, ["team.manage", "company.manage", "settings.manage"])) {
      return { error: "Admin access required." };
    }
    if (!isSafeOrgId(orgId)) return { error: "Invalid organization id." };

    const supabase = createSupabaseAdminClient();
    const candidates: SettingsAssetCleanupCandidate[] = [];
    const deleted: string[] = [];
    const failures: string[] = [];
    let skipped = 0;

    for (const assetKey of ALLOWED_SETTINGS_ASSET_KEYS) {
      const current = await getSettingsAssetUpload(token, assetKey);
      const prefix = buildSettingsAssetStoragePrefix(orgId, assetKey).replace(/[^/]+$/, "");
      const keyCandidates: SettingsAssetCleanupCandidate[] = [];
      let listingComplete = true;
      let offset = 0;

      while (true) {
        const { data, error } = await supabase.storage.from(SETTINGS_ASSET_BUCKET).list(prefix, {
          limit: 100,
          offset,
          sortBy: { column: "updated_at", order: "asc" },
        });
        if (error) {
          failures.push(`${assetKey}:list`);
          listingComplete = false;
          break;
        }

        const selection = selectSettingsAssetCleanupCandidates({
          orgId,
          assetKey,
          entries: data ?? [],
          currentStoragePath: current?.storagePath ?? null,
        });
        keyCandidates.push(...selection.candidates);
        skipped += selection.skipped;

        if (!data || data.length < 100) break;
        offset += data.length;
      }

      if (listingComplete) candidates.push(...keyCandidates);
    }

    if (!dryRun) {
      for (const candidate of candidates) {
        const { error } = await supabase.storage.from(SETTINGS_ASSET_BUCKET).remove([candidate.storagePath]);
        if (error) failures.push(candidate.storagePath);
        else deleted.push(candidate.storagePath);
      }
    }

    return { dryRun, candidates, deleted, failures, skipped };
  } catch (error) {
    console.error("reconcileSettingsAssetsAction: unexpected error", error);
    return { error: "Asset cleanup failed." };
  }
}
