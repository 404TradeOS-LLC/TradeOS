import { BrandStudioService } from "../brand-studio/service";
import { prisma } from "../../db/client";
import type { DocumentFrameBrand } from "./frame";

const DEFAULT_BRAND = {
  primary: "#0f172a",
  secondary: "#f8fafc",
  accent: "#c2410c",
  typography: {
    style: "Professional",
    headingFontFamily: "\"IBM Plex Sans\", \"Inter\", \"Avenir Next\", sans-serif",
    bodyFontFamily: "\"Inter\", \"Avenir Next\", \"Segoe UI\", sans-serif",
    accentFontFamily: "\"IBM Plex Mono\", \"SFMono-Regular\", monospace",
  },
} as const;

/**
 * Resolve document branding from the authenticated organization context.
 * A caller-provided company name is only a fallback when authenticated
 * organization context is absent; it never overrides persisted organization
 * brand data when an orgId is present.
 */
export async function getDocumentBrand(orgId?: string, fallbackCompanyName = "Your Company Name"): Promise<DocumentFrameBrand> {
  if (!orgId) return fromFallback(fallbackCompanyName);

  const service = new BrandStudioService();
  const [profile, settings, preview, organization, legacySettings] = await Promise.all([
    service.getProfile(orgId),
    service.getDocumentSettings(orgId),
    service.getPreview(orgId),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, phone: true, email: true, address: true, logoUrl: true } }),
    prisma.organizationSettings.findUnique({ where: { orgId }, select: { settingsJson: true } }),
  ]);
  const legacy = asStringRecord(legacySettings?.settingsJson);

  return {
    companyName: firstNonEmpty(profile.companyDisplayName, legacy.companyName, organization?.name, fallbackCompanyName) || "Your Company Name",
    tagline: profile.tagline,
    logoUrl: safeAssetUrl(preview.resolvedLogoUrls.logoUrl || legacy.logoUrl || organization?.logoUrl || null),
    colors: {
      primary: safeHex(preview.validatedColors.primary, DEFAULT_BRAND.primary),
      secondary: safeHex(preview.validatedColors.secondary, DEFAULT_BRAND.secondary),
      accent: safeHex(preview.validatedColors.accent, DEFAULT_BRAND.accent),
    },
    typography: preview.typography,
    websiteUrl: firstNonEmpty(profile.websiteUrl, legacy.website),
    phone: firstNonEmpty(profile.phone, legacy.phone, organization?.phone),
    email: firstNonEmpty(profile.email, organization?.email),
    addressLine1: firstNonEmpty(profile.addressLine1, legacy.address, organization?.address),
    addressLine2: safeText(profile.addressLine2),
    city: safeText(profile.city),
    state: safeText(profile.state),
    postalCode: safeText(profile.postalCode),
    licenseNumber: safeText(profile.licenseNumber),
    insuranceSummary: safeText(profile.insuranceSummary),
    bondingSummary: safeText(profile.bondingSummary),
    serviceAreas: profile.serviceAreas,
    certifications: profile.certifications,
    showPoweredByTradeOS: settings.showPoweredByTradeOS,
    showLicenseNumber: settings.showLicenseNumber,
    showInsuranceSummary: settings.showInsuranceSummary,
  };
}

function fromFallback(companyName: string): DocumentFrameBrand {
  return {
    companyName: companyName || "Your Company Name",
    tagline: "",
    logoUrl: null,
    colors: { primary: DEFAULT_BRAND.primary, secondary: DEFAULT_BRAND.secondary, accent: DEFAULT_BRAND.accent },
    typography: DEFAULT_BRAND.typography,
    websiteUrl: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    serviceAreas: [],
    certifications: [],
    licenseNumber: "",
    insuranceSummary: "",
    bondingSummary: "",
    showPoweredByTradeOS: false,
    showLicenseNumber: true,
    showInsuranceSummary: true,
  };
}

function safeHex(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function safeAssetUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function safeText(value: string): string {
  return value.trim();
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  return values.map((value) => (typeof value === "string" ? value.trim() : "")).find(Boolean) ?? "";
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}
