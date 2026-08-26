import type { Metadata } from "next";
import { BrandStudioConsole } from "@/components/brand-studio/brand-studio-console";
import type { BrandStudioSettingsBundle } from "@/lib/brand-studio";
import {
  getBrandStudioAssets,
  getBrandStudioDocumentSettings,
  getBrandStudioPreview,
  getBrandStudioProfile,
} from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Brand Studio | TradeOS",
  description: "Manage the white-label identity that TradeOS uses across proposals, contracts, invoices, reports, and client-facing experiences.",
};

export default async function BrandStudioPage() {
  const token = await getSessionToken();
  if (!token) return null;

  const [profile, assets, documentSettings, preview] = await Promise.all([
    getBrandStudioProfile(token),
    getBrandStudioAssets(token),
    getBrandStudioDocumentSettings(token),
    getBrandStudioPreview(token),
  ]);

  const initialSettings: BrandStudioSettingsBundle = {
    profile,
    assets,
    documentSettings,
    preview,
  };

  return <BrandStudioConsole initialSettings={initialSettings} />;
}
