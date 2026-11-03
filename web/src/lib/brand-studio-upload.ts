import type { BrandProfile } from "./brand-studio";
import type { SettingsAssetKey } from "./settingsAssetUpload";

// Reuse the existing private SettingsAssetUpload lifecycle. These four slots
// are the only asset keys accepted by the current server action and database.
export const brandStudioUploadSlots = [
  { assetKey: "logoUrl", profileField: "logoUrl", label: "Primary logo" },
  { assetKey: "darkLogoUrl", profileField: "logoDarkUrl", label: "Dark logo" },
  { assetKey: "iconUrl", profileField: "iconUrl", label: "Icon" },
  { assetKey: "watermarkUrl", profileField: "watermarkUrl", label: "Watermark" },
] as const satisfies ReadonlyArray<{
  assetKey: SettingsAssetKey;
  profileField: keyof BrandProfile;
  label: string;
}>;

export type BrandStudioUploadKey = (typeof brandStudioUploadSlots)[number]["assetKey"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOwnedBrandAssetUrl(url: string, orgId: string, assetKey: BrandStudioUploadKey): boolean {
  return UUID.test(orgId) && url === `/api/brand-assets/${orgId}/${assetKey}`;
}

function profileFieldForAssetKey(assetKey: BrandStudioUploadKey) {
  const slot = brandStudioUploadSlots.find((item) => item.assetKey === assetKey);
  if (!slot) throw new Error("Unsupported brand upload slot.");
  return slot.profileField;
}

// Use the *persisted* profile as the basis for the PUT, so uploading a logo
// never silently commits unrelated edits in other Brand Studio inputs.
export function applyBrandStudioUpload(
  profile: BrandProfile,
  assetKey: BrandStudioUploadKey,
  url: string,
): BrandProfile {
  if (!isOwnedBrandAssetUrl(url, profile.organizationId, assetKey)) {
    throw new Error("Upload returned an unexpected brand asset URL.");
  }
  return { ...profile, [profileFieldForAssetKey(assetKey)]: url };
}

export function clearBrandStudioUpload(profile: BrandProfile, assetKey: BrandStudioUploadKey): BrandProfile {
  return { ...profile, [profileFieldForAssetKey(assetKey)]: "" };
}
