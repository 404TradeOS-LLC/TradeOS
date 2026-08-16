import { Prisma, type BrandAsset, type BrandDocumentSettings, type BrandProfile } from "@prisma/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { prisma } from "../../db/client";
import { runInDatabaseTransaction } from "../../db/requestSession";
import {
  type BrandAssetDTO,
  type BrandDocumentSettingsDTO,
  type DerivedLogoVariantDTO,
  type BrandLinkDTO,
  type BrandProfileDTO,
  type BrandStudioPreviewDTO,
  type CreateBrandAssetInput,
  type TypographySpecimenDTO,
  type UpdateBrandDocumentSettingsInput,
  type UpdateBrandProfileInput,
} from "./types";

const DEFAULT_COLORS = {
  primary: "#111827",
  secondary: "#E5E7EB",
  accent: "#D97706",
} as const;

const DEFAULT_TYPOGRAPHY_STYLE = "Professional";
const DEFAULT_DOCUMENT_THEME = "signature-frame";
const DEFAULT_PROPOSAL_STYLE = "premium";
const DEFAULT_INVOICE_STYLE = "compact";
const DEFAULT_CONTRACT_STYLE = "formal";
const DEFAULT_COVER_MODE = "editorial";
const DEFAULT_HEADER_STYLE = "split";
const DEFAULT_FOOTER_STYLE = "trust-bar";

const TYPOGRAPHY_SPECIMENS: Record<string, TypographySpecimenDTO> = {
  Professional: {
    style: "Professional",
    label: "Professional",
    headingFontFamily: "\"IBM Plex Sans\", \"Inter\", \"Avenir Next\", sans-serif",
    bodyFontFamily: "\"Inter\", \"Avenir Next\", \"Segoe UI\", sans-serif",
    accentFontFamily: "\"IBM Plex Mono\", \"SFMono-Regular\", monospace",
    headingSample: "Structured proposals with precise commercial clarity.",
    bodySample: "Balanced, legible, and dependable across estimates, invoices, and print-heavy contractor workflows.",
  },
  Modern: {
    style: "Modern",
    label: "Modern",
    headingFontFamily: "\"Space Grotesk\", \"Helvetica Neue\", sans-serif",
    bodyFontFamily: "\"Manrope\", \"Inter\", sans-serif",
    accentFontFamily: "\"JetBrains Mono\", \"SFMono-Regular\", monospace",
    headingSample: "A crisp system for fast-moving design-build teams.",
    bodySample: "Clean geometry, contemporary rhythm, and strong digital-to-print continuity for forward-leaning brands.",
  },
  Luxury: {
    style: "Luxury",
    label: "Luxury",
    headingFontFamily: "\"Cormorant Garamond\", \"Baskerville\", serif",
    bodyFontFamily: "\"DM Sans\", \"Helvetica Neue\", sans-serif",
    accentFontFamily: "\"IBM Plex Mono\", monospace",
    headingSample: "Elevated presentation for premium residential work.",
    bodySample: "Refined contrast and editorial spacing tuned for high-trust proposals, closeout books, and concierge service brands.",
  },
  Industrial: {
    style: "Industrial",
    label: "Industrial",
    headingFontFamily: "\"Oswald\", \"Arial Narrow\", sans-serif",
    bodyFontFamily: "\"IBM Plex Sans\", \"Segoe UI\", sans-serif",
    accentFontFamily: "\"Roboto Mono\", monospace",
    headingSample: "Built for field execution, logistics, and heavy trade reporting.",
    bodySample: "Condensed authority with clear hierarchy for crews, superintendents, procurement packets, and maintenance plans.",
  },
  Traditional: {
    style: "Traditional",
    label: "Traditional",
    headingFontFamily: "\"Source Serif 4\", \"Georgia\", serif",
    bodyFontFamily: "\"Source Sans 3\", \"Segoe UI\", sans-serif",
    accentFontFamily: "\"IBM Plex Mono\", monospace",
    headingSample: "A familiar, trusted voice for established family contractors.",
    bodySample: "Classic document rhythm with readable long-form terms, warranty detail, and steady homeowner-facing presentation.",
  },
  Minimal: {
    style: "Minimal",
    label: "Minimal",
    headingFontFamily: "\"Manrope\", \"Helvetica Neue\", sans-serif",
    bodyFontFamily: "\"Inter\", \"Avenir Next\", sans-serif",
    accentFontFamily: "\"JetBrains Mono\", monospace",
    headingSample: "Quiet confidence with disciplined whitespace.",
    bodySample: "Reduced ornament, strong legibility, and understated polish for brands that want the work to speak first.",
  },
};

export class BrandStudioService {
  async getProfile(orgId: string): Promise<BrandProfileDTO> {
    const organization = await this.getOrganizationOrThrow(orgId);
    const row = await prisma.brandProfile.findUnique({ where: { organizationId: orgId } });
    return toBrandProfileDTO(orgId, organization.name, row);
  }

  async updateProfile(orgId: string, input: UpdateBrandProfileInput): Promise<BrandProfileDTO> {
    const organization = await this.getOrganizationOrThrow(orgId);
    const normalized = normalizeProfileInput(input);

    const row = await runInDatabaseTransaction(prisma, async (transaction) => {
      await transaction.organization.update({
        where: { id: orgId },
        data: {
          name: normalized.companyDisplayName ?? organization.name,
          phone: normalized.phone,
          email: normalized.email,
          logoUrl: normalized.logoUrl,
          address: emptyAddressToNull([
            normalized.addressLine1,
            normalized.addressLine2,
            [normalized.city, normalized.state].filter(Boolean).join(", "),
            normalized.postalCode,
          ]),
        },
      });

      return transaction.brandProfile.upsert({
        where: { organizationId: orgId },
        update: normalized,
        create: {
          organizationId: orgId,
          ...normalized,
        },
      });
    });

    return toBrandProfileDTO(orgId, normalized.companyDisplayName ?? organization.name, row);
  }

  async listAssets(orgId: string): Promise<BrandAssetDTO[]> {
    const rows = await prisma.brandAsset.findMany({
      where: { organizationId: orgId },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(toBrandAssetDTO);
  }

  async createAsset(orgId: string, input: CreateBrandAssetInput): Promise<BrandAssetDTO> {
    await this.getOrganizationOrThrow(orgId);
    const normalized = normalizeBrandAssetInput(input);

    const row = await runInDatabaseTransaction(prisma, async (transaction) => {
      const profile = await ensureBrandProfile(transaction, orgId);
      return transaction.brandAsset.create({
        data: {
          organizationId: orgId,
          brandProfileId: profile.id,
          ...normalized,
        },
      });
    });

    return toBrandAssetDTO(row);
  }

  async deleteAsset(orgId: string, assetId: string): Promise<void> {
    const existing = await prisma.brandAsset.findFirst({ where: { id: assetId, organizationId: orgId } });
    if (!existing) throw new ApiError(404, `Brand asset ${assetId} not found`);
    await prisma.brandAsset.delete({ where: { id: assetId } });
  }

  async getDocumentSettings(orgId: string): Promise<BrandDocumentSettingsDTO> {
    const row = await prisma.brandDocumentSettings.findUnique({ where: { organizationId: orgId } });
    return toBrandDocumentSettingsDTO(orgId, row);
  }

  async updateDocumentSettings(orgId: string, input: UpdateBrandDocumentSettingsInput): Promise<BrandDocumentSettingsDTO> {
    await this.getOrganizationOrThrow(orgId);
    const normalized = normalizeDocumentSettingsInput(input);

    const row = await runInDatabaseTransaction(prisma, async (transaction) => {
      const profile = await ensureBrandProfile(transaction, orgId);
      return transaction.brandDocumentSettings.upsert({
        where: { organizationId: orgId },
        update: normalized,
        create: {
          organizationId: orgId,
          brandProfileId: profile.id,
          ...normalized,
        },
      });
    });

    return toBrandDocumentSettingsDTO(orgId, row);
  }

  async getPreview(orgId: string): Promise<BrandStudioPreviewDTO> {
    const [organization, profileRow, settingsRow, assets] = await Promise.all([
      this.getOrganizationOrThrow(orgId),
      prisma.brandProfile.findUnique({ where: { organizationId: orgId } }),
      prisma.brandDocumentSettings.findUnique({ where: { organizationId: orgId } }),
      prisma.brandAsset.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } }),
    ]);

    const profile = toBrandProfileDTO(orgId, organization.name, profileRow);
    const settings = toBrandDocumentSettingsDTO(orgId, settingsRow);

    const resolvedLogoUrls = {
      logoUrl: profile.logoUrl || findAssetUrl(assets, ["logo", "primary-logo"]),
      logoDarkUrl: profile.logoDarkUrl || findAssetUrl(assets, ["logo-dark", "dark-logo"]),
      logoLightUrl: profile.logoLightUrl || findAssetUrl(assets, ["logo-light", "light-logo"]),
      iconUrl: profile.iconUrl || findAssetUrl(assets, ["icon", "favicon"]),
      watermarkUrl: profile.watermarkUrl || findAssetUrl(assets, ["watermark"]),
      coverImageUrl: profile.coverImageUrl || findAssetUrl(assets, ["cover", "cover-image"]),
    };
    const derivedLogoVariants = buildDerivedLogoVariants(profile, assets, resolvedLogoUrls);
    const typography = getTypographySpecimen(profile.typographyStyle);

    const visibleTrustSignals = [
      settings.showLicenseNumber && profile.licenseNumber
        ? { id: "license", label: "License", value: profile.licenseNumber }
        : null,
      settings.showInsuranceSummary && profile.insuranceSummary
        ? { id: "insurance", label: "Insurance", value: profile.insuranceSummary }
        : null,
      profile.bondingSummary ? { id: "bonding", label: "Bonding", value: profile.bondingSummary } : null,
      profile.certifications.length
        ? { id: "certifications", label: "Certifications", value: profile.certifications.join(" • ") }
        : null,
      settings.showSocialLinks && profile.socialLinks.length
        ? { id: "social", label: "Social", value: profile.socialLinks.map((item) => item.label).join(" • ") }
        : null,
      settings.showGoogleRating && profile.reviewLinks.length
        ? { id: "reviews", label: "Reviews", value: profile.reviewLinks.map((item) => item.label).join(" • ") }
        : null,
      profile.financingLinks.length
        ? { id: "financing", label: "Financing", value: profile.financingLinks.map((item) => item.label).join(" • ") }
        : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    const missingSetupItems = [
      !profile.companyDisplayName ? "Add your company display name" : null,
      !resolvedLogoUrls.logoUrl ? "Add a primary logo" : null,
      !profile.primaryColor ? "Choose a primary brand color" : null,
      !profile.websiteUrl ? "Add your website URL" : null,
      !profile.phone ? "Add a customer-facing phone number" : null,
      !profile.email ? "Add a customer-facing email" : null,
      !profile.addressLine1 ? "Add your business address" : null,
      !profile.licenseNumber ? "Add your license number" : null,
      !profile.insuranceSummary ? "Add your insurance summary" : null,
      !profile.serviceAreas.length ? "Define your service areas" : null,
      !profile.emailSignature ? "Add your email signature" : null,
      !profile.coverImageUrl ? "Add a cover image for branded documents" : null,
    ].filter((item): item is string => Boolean(item));

    const completionChecklist = [
      Boolean(profile.companyDisplayName),
      Boolean(profile.tagline),
      Boolean(resolvedLogoUrls.logoUrl),
      Boolean(profile.logoDarkUrl || resolvedLogoUrls.logoDarkUrl),
      Boolean(profile.iconUrl || resolvedLogoUrls.iconUrl),
      Boolean(profile.primaryColor),
      Boolean(profile.secondaryColor),
      Boolean(profile.accentColor),
      Boolean(profile.websiteUrl),
      Boolean(profile.phone),
      Boolean(profile.email),
      Boolean(profile.addressLine1),
      Boolean(profile.licenseNumber),
      Boolean(profile.insuranceSummary),
      Boolean(profile.serviceAreas.length),
      Boolean(profile.certifications.length),
      Boolean(profile.emailSignature),
      Boolean(profile.defaultDocumentTheme),
      Boolean(profile.proposalStyle),
      Boolean(profile.invoiceStyle),
      Boolean(profile.contractStyle),
      Boolean(settings.defaultCoverMode),
      Boolean(settings.defaultHeaderStyle),
      Boolean(settings.defaultFooterStyle),
    ];

    return {
      companyDisplayName: profile.companyDisplayName || organization.name,
      tagline: profile.tagline,
      validatedColors: {
        primary: normalizeHexColor(profile.primaryColor) ?? DEFAULT_COLORS.primary,
        secondary: normalizeHexColor(profile.secondaryColor) ?? DEFAULT_COLORS.secondary,
        accent: normalizeHexColor(profile.accentColor) ?? DEFAULT_COLORS.accent,
      },
      resolvedLogoUrls,
      derivedLogoVariants,
      typography,
      documentTheme: {
        typographyStyle: typography.style,
        defaultDocumentTheme: profile.defaultDocumentTheme || DEFAULT_DOCUMENT_THEME,
        proposalStyle: profile.proposalStyle || DEFAULT_PROPOSAL_STYLE,
        invoiceStyle: profile.invoiceStyle || DEFAULT_INVOICE_STYLE,
        contractStyle: profile.contractStyle || DEFAULT_CONTRACT_STYLE,
        coverMode: settings.defaultCoverMode,
        headerStyle: settings.defaultHeaderStyle,
        footerStyle: settings.defaultFooterStyle,
        showPoweredByTradeOS: settings.showPoweredByTradeOS,
      },
      visibleTrustSignals,
      missingSetupItems,
      completionPercentage: Math.round((completionChecklist.filter(Boolean).length / completionChecklist.length) * 100),
    };
  }

  private async getOrganizationOrThrow(orgId: string) {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });
    if (!organization) throw new ApiError(404, `Organization ${orgId} not found`);
    return organization;
  }
}

async function ensureBrandProfile(transaction: Prisma.TransactionClient, orgId: string) {
  return transaction.brandProfile.upsert({
    where: { organizationId: orgId },
    update: {},
    create: { organizationId: orgId },
  });
}

function normalizeProfileInput(input: UpdateBrandProfileInput) {
  return {
    companyDisplayName: normalizeOptionalString(input.companyDisplayName, 160),
    tagline: normalizeOptionalString(input.tagline, 160),
    primaryColor: normalizeOptionalColor(input.primaryColor, "primaryColor"),
    secondaryColor: normalizeOptionalColor(input.secondaryColor, "secondaryColor"),
    accentColor: normalizeOptionalColor(input.accentColor, "accentColor"),
    logoUrl: normalizeOptionalUrl(input.logoUrl, "logoUrl"),
    logoDarkUrl: normalizeOptionalUrl(input.logoDarkUrl, "logoDarkUrl"),
    logoLightUrl: normalizeOptionalUrl(input.logoLightUrl, "logoLightUrl"),
    iconUrl: normalizeOptionalUrl(input.iconUrl, "iconUrl"),
    watermarkUrl: normalizeOptionalUrl(input.watermarkUrl, "watermarkUrl"),
    coverImageUrl: normalizeOptionalUrl(input.coverImageUrl, "coverImageUrl"),
    typographyStyle: normalizeOptionalTypographyStyle(input.typographyStyle),
    defaultDocumentTheme: normalizeOptionalString(input.defaultDocumentTheme, 120),
    proposalStyle: normalizeOptionalString(input.proposalStyle, 120),
    invoiceStyle: normalizeOptionalString(input.invoiceStyle, 120),
    contractStyle: normalizeOptionalString(input.contractStyle, 120),
    emailSignature: normalizeOptionalString(input.emailSignature, 2000),
    websiteUrl: normalizeOptionalUrl(input.websiteUrl, "websiteUrl"),
    phone: normalizeOptionalString(input.phone, 64),
    email: normalizeOptionalEmail(input.email),
    addressLine1: normalizeOptionalString(input.addressLine1, 200),
    addressLine2: normalizeOptionalString(input.addressLine2, 200),
    city: normalizeOptionalString(input.city, 120),
    state: normalizeOptionalString(input.state, 120),
    postalCode: normalizeOptionalString(input.postalCode, 32),
    licenseNumber: normalizeOptionalString(input.licenseNumber, 160),
    insuranceSummary: normalizeOptionalString(input.insuranceSummary, 500),
    bondingSummary: normalizeOptionalString(input.bondingSummary, 500),
    yearsInBusiness: normalizeNullableInteger(input.yearsInBusiness, "yearsInBusiness"),
    serviceAreasJson: toJsonValue(normalizeStringArray(input.serviceAreas, "serviceAreas")),
    certificationsJson: toJsonValue(normalizeStringArray(input.certifications, "certifications")),
    socialLinksJson: toJsonValue(normalizeLinkArray(input.socialLinks, "socialLinks")),
    reviewLinksJson: toJsonValue(normalizeLinkArray(input.reviewLinks, "reviewLinks")),
    financingLinksJson: toJsonValue(normalizeLinkArray(input.financingLinks, "financingLinks")),
  };
}

function normalizeBrandAssetInput(input: CreateBrandAssetInput) {
  return {
    type: requireString(input.type, "type", 80).toLowerCase(),
    label: normalizeOptionalString(input.label, 160),
    url: normalizeRequiredUrl(input.url, "url"),
    mimeType: normalizeOptionalString(input.mimeType, 120),
    sizeBytes: normalizeNullableInteger(input.sizeBytes, "sizeBytes"),
    width: normalizeNullableInteger(input.width, "width"),
    height: normalizeNullableInteger(input.height, "height"),
  };
}

function normalizeDocumentSettingsInput(input: UpdateBrandDocumentSettingsInput) {
  return {
    showPoweredByTradeOS: Boolean(input.showPoweredByTradeOS),
    showLicenseNumber: input.showLicenseNumber ?? true,
    showInsuranceSummary: input.showInsuranceSummary ?? true,
    showGoogleRating: Boolean(input.showGoogleRating),
    showSocialLinks: input.showSocialLinks ?? true,
    defaultCoverMode: normalizeOptionalString(input.defaultCoverMode, 80) ?? DEFAULT_COVER_MODE,
    defaultHeaderStyle: normalizeOptionalString(input.defaultHeaderStyle, 80) ?? DEFAULT_HEADER_STYLE,
    defaultFooterStyle: normalizeOptionalString(input.defaultFooterStyle, 80) ?? DEFAULT_FOOTER_STYLE,
  };
}

function toBrandProfileDTO(orgId: string, organizationName: string, row: BrandProfile | null): BrandProfileDTO {
  return {
    id: row?.id ?? null,
    organizationId: orgId,
    companyDisplayName: row?.companyDisplayName ?? organizationName,
    tagline: row?.tagline ?? "",
    primaryColor: row?.primaryColor ?? "",
    secondaryColor: row?.secondaryColor ?? "",
    accentColor: row?.accentColor ?? "",
    logoUrl: row?.logoUrl ?? "",
    logoDarkUrl: row?.logoDarkUrl ?? "",
    logoLightUrl: row?.logoLightUrl ?? "",
    iconUrl: row?.iconUrl ?? "",
    watermarkUrl: row?.watermarkUrl ?? "",
    coverImageUrl: row?.coverImageUrl ?? "",
    typographyStyle: row?.typographyStyle ?? DEFAULT_TYPOGRAPHY_STYLE,
    defaultDocumentTheme: row?.defaultDocumentTheme ?? DEFAULT_DOCUMENT_THEME,
    proposalStyle: row?.proposalStyle ?? DEFAULT_PROPOSAL_STYLE,
    invoiceStyle: row?.invoiceStyle ?? DEFAULT_INVOICE_STYLE,
    contractStyle: row?.contractStyle ?? DEFAULT_CONTRACT_STYLE,
    emailSignature: row?.emailSignature ?? "",
    websiteUrl: row?.websiteUrl ?? "",
    phone: row?.phone ?? "",
    email: row?.email ?? "",
    addressLine1: row?.addressLine1 ?? "",
    addressLine2: row?.addressLine2 ?? "",
    city: row?.city ?? "",
    state: row?.state ?? "",
    postalCode: row?.postalCode ?? "",
    licenseNumber: row?.licenseNumber ?? "",
    insuranceSummary: row?.insuranceSummary ?? "",
    bondingSummary: row?.bondingSummary ?? "",
    yearsInBusiness: row?.yearsInBusiness ?? null,
    serviceAreas: parseStringArray(row?.serviceAreasJson),
    certifications: parseStringArray(row?.certificationsJson),
    socialLinks: parseLinkArray(row?.socialLinksJson),
    reviewLinks: parseLinkArray(row?.reviewLinksJson),
    financingLinks: parseLinkArray(row?.financingLinksJson),
    createdAt: row?.createdAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

function toBrandDocumentSettingsDTO(orgId: string, row: BrandDocumentSettings | null): BrandDocumentSettingsDTO {
  return {
    id: row?.id ?? null,
    organizationId: orgId,
    brandProfileId: row?.brandProfileId ?? null,
    showPoweredByTradeOS: row?.showPoweredByTradeOS ?? false,
    showLicenseNumber: row?.showLicenseNumber ?? true,
    showInsuranceSummary: row?.showInsuranceSummary ?? true,
    showGoogleRating: row?.showGoogleRating ?? false,
    showSocialLinks: row?.showSocialLinks ?? true,
    defaultCoverMode: row?.defaultCoverMode ?? DEFAULT_COVER_MODE,
    defaultHeaderStyle: row?.defaultHeaderStyle ?? DEFAULT_HEADER_STYLE,
    defaultFooterStyle: row?.defaultFooterStyle ?? DEFAULT_FOOTER_STYLE,
    createdAt: row?.createdAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

function toBrandAssetDTO(row: BrandAsset): BrandAssetDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    brandProfileId: row.brandProfileId,
    type: row.type,
    label: row.label,
    url: row.url,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt,
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function parseLinkArray(value: unknown): BrandLinkDTO[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const url = typeof record.url === "string" ? record.url.trim() : "";
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((entry): entry is BrandLinkDTO => Boolean(entry));
}

function normalizeStringArray(input: string[] | undefined, fieldName: string): string[] {
  if (!input) return [];
  return input
    .map((entry) => requireString(entry, fieldName, 160))
    .filter((entry, index, array) => array.indexOf(entry) === index);
}

function normalizeLinkArray(input: BrandLinkDTO[] | undefined, fieldName: string): BrandLinkDTO[] {
  if (!input) return [];
  return input.map((entry, index) => ({
    label: requireString(entry.label, `${fieldName}[${index}].label`, 120),
    url: normalizeRequiredUrl(entry.url, `${fieldName}[${index}].url`),
  }));
}

function normalizeOptionalString(value: string | undefined, maxLength: number): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new ApiError(400, `${maxLength} character limit exceeded`);
  return trimmed;
}

function requireString(value: string | undefined, fieldName: string, maxLength: number): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new ApiError(400, `${fieldName} is required`);
  if (trimmed.length > maxLength) throw new ApiError(400, `${fieldName} exceeds ${maxLength} characters`);
  return trimmed;
}

function normalizeOptionalEmail(value: string | undefined): string | null {
  const normalized = normalizeOptionalString(value, 240);
  if (!normalized) return null;
  const email = normalized.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "email must be valid");
  return email;
}

function normalizeOptionalColor(value: string | undefined, fieldName: string): string | null {
  if (value === undefined) return null;
  const normalized = normalizeHexColor(value);
  if (!normalized) throw new ApiError(400, `${fieldName} must be a valid hex color`);
  return normalized;
}

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (!match) return null;
  const hex = match[1].toUpperCase();
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  return `#${hex}`;
}

function normalizeOptionalUrl(value: string | undefined, fieldName: string): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return validateSafeUrl(trimmed, fieldName);
}

function normalizeOptionalTypographyStyle(value: string | undefined): string | null {
  if (value === undefined) return null;
  const normalized = normalizeOptionalString(value, 64);
  if (!normalized) return null;
  if (!(normalized in TYPOGRAPHY_SPECIMENS)) {
    throw new ApiError(400, `typographyStyle must be one of ${Object.keys(TYPOGRAPHY_SPECIMENS).join(", ")}`);
  }
  return normalized;
}

function normalizeRequiredUrl(value: string | undefined, fieldName: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new ApiError(400, `${fieldName} is required`);
  return validateSafeUrl(trimmed, fieldName);
}

function validateSafeUrl(value: string, fieldName: string): string {
  if (value.startsWith("/")) return value;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
    return parsed.toString();
  } catch {
    throw new ApiError(400, `${fieldName} must be a safe http, https, or root-relative URL`);
  }
}

function normalizeNullableInteger(value: number | null | undefined, fieldName: string): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 0) throw new ApiError(400, `${fieldName} must be a non-negative integer`);
  return value;
}

function toJsonValue<T>(value: T): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function findAssetUrl(assets: BrandAsset[], types: string[]): string | null {
  const normalized = types.map((type) => type.toLowerCase());
  const match = assets.find((asset) => normalized.includes(asset.type.toLowerCase()));
  return match?.url ?? null;
}

function getTypographySpecimen(style: string | undefined | null): TypographySpecimenDTO {
  return TYPOGRAPHY_SPECIMENS[style ?? ""] ?? TYPOGRAPHY_SPECIMENS[DEFAULT_TYPOGRAPHY_STYLE];
}

function buildDerivedLogoVariants(
  profile: BrandProfileDTO,
  assets: BrandAsset[],
  resolvedLogoUrls: BrandStudioPreviewDTO["resolvedLogoUrls"]
): DerivedLogoVariantDTO[] {
  const iconAssetUrl = findAssetUrl(assets, ["icon", "favicon"]);
  const monoAssetUrl = findAssetUrl(assets, ["logo-mono", "mono", "monochrome"]);
  const printSafeAssetUrl = findAssetUrl(assets, ["logo-print", "print-safe", "print"]);

  return [
    buildLogoVariant("primary", resolvedLogoUrls.logoUrl, resolvedLogoUrls.logoUrl ? sourceForResolvedLogo(profile.logoUrl, resolvedLogoUrls.logoUrl) : "missing"),
    buildLogoVariant("dark", resolvedLogoUrls.logoDarkUrl, resolvedLogoUrls.logoDarkUrl ? sourceForResolvedLogo(profile.logoDarkUrl, resolvedLogoUrls.logoDarkUrl) : "missing"),
    buildLogoVariant("light", resolvedLogoUrls.logoLightUrl, resolvedLogoUrls.logoLightUrl ? sourceForResolvedLogo(profile.logoLightUrl, resolvedLogoUrls.logoLightUrl) : "missing"),
    buildLogoVariant("icon", profile.iconUrl || iconAssetUrl || deriveVariantUrl(resolvedLogoUrls.logoUrl, "icon"), profile.iconUrl ? "explicit" : iconAssetUrl ? "asset" : resolvedLogoUrls.logoUrl ? "derived" : "missing", resolvedLogoUrls.logoUrl),
    buildLogoVariant("favicon", iconAssetUrl || profile.iconUrl || deriveVariantUrl(resolvedLogoUrls.logoUrl, "favicon"), iconAssetUrl ? "asset" : profile.iconUrl ? "explicit" : resolvedLogoUrls.logoUrl ? "derived" : "missing", resolvedLogoUrls.logoUrl),
    buildLogoVariant("monochrome", monoAssetUrl || deriveVariantUrl(resolvedLogoUrls.logoDarkUrl || resolvedLogoUrls.logoUrl, "mono"), monoAssetUrl ? "asset" : resolvedLogoUrls.logoDarkUrl || resolvedLogoUrls.logoUrl ? "derived" : "missing", resolvedLogoUrls.logoDarkUrl || resolvedLogoUrls.logoUrl),
    buildLogoVariant("print-safe", printSafeAssetUrl || deriveVariantUrl(resolvedLogoUrls.logoLightUrl || resolvedLogoUrls.logoUrl, "print"), printSafeAssetUrl ? "asset" : resolvedLogoUrls.logoLightUrl || resolvedLogoUrls.logoUrl ? "derived" : "missing", resolvedLogoUrls.logoLightUrl || resolvedLogoUrls.logoUrl),
  ];
}

function buildLogoVariant(
  kind: string,
  url: string | null,
  source: DerivedLogoVariantDTO["source"],
  derivedFrom: string | null = null
): DerivedLogoVariantDTO {
  return { kind, url, source, derivedFrom: source === "derived" ? derivedFrom : null };
}

function sourceForResolvedLogo(explicitUrl: string, resolvedUrl: string): DerivedLogoVariantDTO["source"] {
  return explicitUrl && explicitUrl === resolvedUrl ? "explicit" : "asset";
}

function deriveVariantUrl(url: string | null, variant: "icon" | "favicon" | "mono" | "print"): string | null {
  if (!url) return null;
  if (url.startsWith("/")) {
    return appendVariantSuffix(url, variant);
  }
  try {
    const parsed = new URL(url);
    parsed.pathname = appendVariantSuffix(parsed.pathname, variant);
    return parsed.toString();
  } catch {
    return null;
  }
}

function appendVariantSuffix(pathname: string, variant: string): string {
  const queryless = pathname;
  const match = /(\.[a-z0-9]+)$/i.exec(queryless);
  if (!match) return `${queryless}-${variant}`;
  const extension = match[1];
  return `${queryless.slice(0, -extension.length)}-${variant}${extension}`;
}

function emptyAddressToNull(parts: Array<string | null>): string | null {
  const joined = parts.filter(Boolean).join("\n").trim();
  return joined || null;
}
