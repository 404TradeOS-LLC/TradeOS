import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defaultBrandProfile } from "./brand-studio.ts";
import {
  applyBrandStudioUpload,
  clearBrandStudioUpload,
  isOwnedBrandAssetUrl,
  brandStudioUploadSlots,
} from "./brand-studio-upload.ts";

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const profile = { ...defaultBrandProfile, organizationId: ORG_ID, companyDisplayName: "Example Contractor", logoUrl: "https://example.com/old.png" };
const uploadedUrl = (key: string, org = ORG_ID) => `/api/brand-assets/${org}/${key}`;

test("Brand Studio provides file uploads for exactly the four supported private Settings slots", () => {
  assert.deepEqual(brandStudioUploadSlots.map((item) => item.assetKey), ["logoUrl", "darkLogoUrl", "iconUrl", "watermarkUrl"]);
  assert.deepEqual(brandStudioUploadSlots.map((item) => item.profileField), ["logoUrl", "logoDarkUrl", "iconUrl", "watermarkUrl"]);
});

test("uploading a dark logo updates the canonical BrandProfile field without losing unrelated data", () => {
  const next = applyBrandStudioUpload(profile, "darkLogoUrl", uploadedUrl("darkLogoUrl"));
  assert.equal(next.logoDarkUrl, uploadedUrl("darkLogoUrl"));
  assert.equal(next.logoUrl, "https://example.com/old.png");
  assert.equal(next.companyDisplayName, "Example Contractor");
  assert.equal(profile.logoDarkUrl, "");
});

test("file upload accepts only the current organization's exact app-owned proxy", () => {
  assert.equal(isOwnedBrandAssetUrl(uploadedUrl("logoUrl"), ORG_ID, "logoUrl"), true);
  assert.equal(isOwnedBrandAssetUrl(uploadedUrl("logoUrl", "22222222-2222-2222-2222-222222222222"), ORG_ID, "logoUrl"), false);
  assert.equal(isOwnedBrandAssetUrl(uploadedUrl("iconUrl"), ORG_ID, "logoUrl"), false);
  assert.equal(isOwnedBrandAssetUrl("https://example.com/logo.png", ORG_ID, "logoUrl"), false);
  assert.equal(isOwnedBrandAssetUrl("javascript:alert(1)", ORG_ID, "logoUrl"), false);
  assert.throws(() => applyBrandStudioUpload(profile, "logoUrl", "https://example.com/logo.png"));
});

test("removing a saved upload clears only the matching canonical BrandProfile field", () => {
  const withDark = applyBrandStudioUpload(profile, "darkLogoUrl", uploadedUrl("darkLogoUrl"));
  const cleared = clearBrandStudioUpload(withDark, "darkLogoUrl");
  assert.equal(cleared.logoDarkUrl, "");
  assert.equal(cleared.logoUrl, profile.logoUrl);
});

test("Brand Studio exposes real file controls, uses the existing protected action, and previews an uploaded image", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.join(here, "../components/brand-studio/brand-studio-console.tsx"), "utf8");
  assert.match(source, /uploadSettingsAssetAction/);
  assert.match(source, /removeSettingsAssetAction/);
  assert.match(source, /type="file"/);
  assert.match(source, /validateSettingsAssetUpload/);
  assert.match(source, /alt=\{\`\$\{slot\.label\} preview\`\}/);
  assert.match(source, /Use image URL/);
});

test("Brand Studio file uploads fit the hosted Server Action request budget", () => {
  const config = fs.readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /bodySizeLimit:\s*["']4.25mb["']/);
  const helper = fs.readFileSync(new URL("./settingsAssetUpload.ts", import.meta.url), "utf8");
  assert.match(helper, /MAX_SETTINGS_ASSET_UPLOAD_BYTES = 4 \* 1024 \* 1024/);
});
