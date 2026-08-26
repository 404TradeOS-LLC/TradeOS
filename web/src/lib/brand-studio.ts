export interface BrandLink {
  label: string;
  url: string;
}

export interface BrandAsset {
  id: string;
  organizationId: string;
  brandProfileId: string;
  type: string;
  label: string | null;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface BrandProfile {
  id: string | null;
  organizationId: string;
  companyDisplayName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  logoDarkUrl: string;
  logoLightUrl: string;
  iconUrl: string;
  watermarkUrl: string;
  coverImageUrl: string;
  typographyStyle: string;
  defaultDocumentTheme: string;
  proposalStyle: string;
  invoiceStyle: string;
  contractStyle: string;
  emailSignature: string;
  websiteUrl: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  licenseNumber: string;
  insuranceSummary: string;
  bondingSummary: string;
  yearsInBusiness: number | null;
  serviceAreas: string[];
  certifications: string[];
  socialLinks: BrandLink[];
  reviewLinks: BrandLink[];
  financingLinks: BrandLink[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TypographySpecimen {
  style: string;
  label: string;
  headingFontFamily: string;
  bodyFontFamily: string;
  accentFontFamily: string;
  headingSample: string;
  bodySample: string;
}

export interface DerivedLogoVariant {
  kind: string;
  url: string | null;
  source: "explicit" | "asset" | "derived" | "missing";
  derivedFrom: string | null;
}

export interface BrandDocumentSettings {
  id: string | null;
  organizationId: string;
  brandProfileId: string | null;
  showPoweredByTradeOS: boolean;
  showLicenseNumber: boolean;
  showInsuranceSummary: boolean;
  showGoogleRating: boolean;
  showSocialLinks: boolean;
  defaultCoverMode: string;
  defaultHeaderStyle: string;
  defaultFooterStyle: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BrandStudioPreview {
  companyDisplayName: string;
  tagline: string;
  validatedColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  resolvedLogoUrls: {
    logoUrl: string | null;
    logoDarkUrl: string | null;
    logoLightUrl: string | null;
    iconUrl: string | null;
    watermarkUrl: string | null;
    coverImageUrl: string | null;
  };
  derivedLogoVariants: DerivedLogoVariant[];
  typography: TypographySpecimen;
  documentTheme: {
    typographyStyle: string;
    defaultDocumentTheme: string;
    proposalStyle: string;
    invoiceStyle: string;
    contractStyle: string;
    coverMode: string;
    headerStyle: string;
    footerStyle: string;
    showPoweredByTradeOS: boolean;
  };
  visibleTrustSignals: Array<{
    id: string;
    label: string;
    value: string;
  }>;
  missingSetupItems: string[];
  completionPercentage: number;
}

export interface BrandAssetDraft {
  type: string;
  label: string;
  url: string;
  mimeType: string;
  sizeBytes: string;
  width: string;
  height: string;
}

export interface BrandStudioSettingsBundle {
  profile: BrandProfile;
  assets: BrandAsset[];
  documentSettings: BrandDocumentSettings;
  preview: BrandStudioPreview;
}

const DEFAULT_COLORS = {
  primary: "#111827",
  secondary: "#E5E7EB",
  accent: "#D97706",
} as const;

export const defaultBrandProfile: BrandProfile = {
  id: null,
  organizationId: "",
  companyDisplayName: "",
  tagline: "",
  primaryColor: "",
  secondaryColor: "",
  accentColor: "",
  logoUrl: "",
  logoDarkUrl: "",
  logoLightUrl: "",
  iconUrl: "",
  watermarkUrl: "",
  coverImageUrl: "",
  typographyStyle: "Professional",
  defaultDocumentTheme: "signature-frame",
  proposalStyle: "premium",
  invoiceStyle: "compact",
  contractStyle: "formal",
  emailSignature: "",
  websiteUrl: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  licenseNumber: "",
  insuranceSummary: "",
  bondingSummary: "",
  yearsInBusiness: null,
  serviceAreas: [],
  certifications: [],
  socialLinks: [],
  reviewLinks: [],
  financingLinks: [],
  createdAt: null,
  updatedAt: null,
};

export const defaultBrandDocumentSettings: BrandDocumentSettings = {
  id: null,
  organizationId: "",
  brandProfileId: null,
  showPoweredByTradeOS: false,
  showLicenseNumber: true,
  showInsuranceSummary: true,
  showGoogleRating: false,
  showSocialLinks: true,
  defaultCoverMode: "editorial",
  defaultHeaderStyle: "split",
  defaultFooterStyle: "trust-bar",
  createdAt: null,
  updatedAt: null,
};

export const defaultBrandAssetDraft: BrandAssetDraft = {
  type: "logo",
  label: "",
  url: "",
  mimeType: "",
  sizeBytes: "",
  width: "",
  height: "",
};

export const typographySpecimens: TypographySpecimen[] = [
  {
    style: "Professional",
    label: "Professional",
    headingFontFamily: '"IBM Plex Sans", "Inter", "Avenir Next", sans-serif',
    bodyFontFamily: '"Inter", "Avenir Next", "Segoe UI", sans-serif',
    accentFontFamily: '"IBM Plex Mono", monospace',
    headingSample: "Structured proposals with precise commercial clarity.",
    bodySample: "Balanced, legible, and dependable across estimates, invoices, and print-heavy contractor workflows.",
  },
  {
    style: "Modern",
    label: "Modern",
    headingFontFamily: '"Space Grotesk", "Helvetica Neue", sans-serif',
    bodyFontFamily: '"Manrope", "Inter", sans-serif',
    accentFontFamily: '"JetBrains Mono", monospace',
    headingSample: "A crisp system for fast-moving design-build teams.",
    bodySample: "Clean geometry, contemporary rhythm, and strong digital-to-print continuity for forward-leaning brands.",
  },
  {
    style: "Luxury",
    label: "Luxury",
    headingFontFamily: '"Cormorant Garamond", "Baskerville", serif',
    bodyFontFamily: '"DM Sans", "Helvetica Neue", sans-serif',
    accentFontFamily: '"IBM Plex Mono", monospace',
    headingSample: "Elevated presentation for premium residential work.",
    bodySample: "Refined contrast and editorial spacing tuned for high-trust proposals and concierge-facing closeout packets.",
  },
  {
    style: "Industrial",
    label: "Industrial",
    headingFontFamily: '"Oswald", "Arial Narrow", sans-serif',
    bodyFontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
    accentFontFamily: '"Roboto Mono", monospace',
    headingSample: "Built for field execution, logistics, and heavy trade reporting.",
    bodySample: "Condensed authority with clear hierarchy for crews, superintendents, procurement packets, and maintenance plans.",
  },
  {
    style: "Traditional",
    label: "Traditional",
    headingFontFamily: '"Source Serif 4", "Georgia", serif',
    bodyFontFamily: '"Source Sans 3", "Segoe UI", sans-serif',
    accentFontFamily: '"IBM Plex Mono", monospace',
    headingSample: "A familiar, trusted voice for established family contractors.",
    bodySample: "Classic document rhythm with readable long-form terms, warranty detail, and steady homeowner-facing presentation.",
  },
  {
    style: "Minimal",
    label: "Minimal",
    headingFontFamily: '"Manrope", "Helvetica Neue", sans-serif',
    bodyFontFamily: '"Inter", "Avenir Next", sans-serif',
    accentFontFamily: '"JetBrains Mono", monospace',
    headingSample: "Quiet confidence with disciplined whitespace.",
    bodySample: "Reduced ornament, strong legibility, and understated polish for brands that want the work to speak first.",
  },
];

export function buildLocalBrandPreview(
  profile: BrandProfile,
  settings: BrandDocumentSettings,
  assets: BrandAsset[]
): BrandStudioPreview {
  const resolvedLogoUrls = {
    logoUrl: profile.logoUrl || findAssetUrl(assets, ["logo", "primary-logo"]),
    logoDarkUrl: profile.logoDarkUrl || findAssetUrl(assets, ["logo-dark", "dark-logo"]),
    logoLightUrl: profile.logoLightUrl || findAssetUrl(assets, ["logo-light", "light-logo"]),
    iconUrl: profile.iconUrl || findAssetUrl(assets, ["icon", "favicon"]),
    watermarkUrl: profile.watermarkUrl || findAssetUrl(assets, ["watermark"]),
    coverImageUrl: profile.coverImageUrl || findAssetUrl(assets, ["cover", "cover-image"]),
  };
  const typography = getTypographySpecimen(profile.typographyStyle);
  const derivedLogoVariants = buildDerivedLogoVariants(profile, assets, resolvedLogoUrls);

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

  const completionChecks = [
    Boolean(profile.companyDisplayName),
    Boolean(profile.tagline),
    Boolean(resolvedLogoUrls.logoUrl),
    Boolean(resolvedLogoUrls.logoDarkUrl),
    Boolean(resolvedLogoUrls.iconUrl),
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
    companyDisplayName: profile.companyDisplayName || "Your Company",
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
      defaultDocumentTheme: profile.defaultDocumentTheme || "signature-frame",
      proposalStyle: profile.proposalStyle || "premium",
      invoiceStyle: profile.invoiceStyle || "compact",
      contractStyle: profile.contractStyle || "formal",
      coverMode: settings.defaultCoverMode || "editorial",
      headerStyle: settings.defaultHeaderStyle || "split",
      footerStyle: settings.defaultFooterStyle || "trust-bar",
      showPoweredByTradeOS: settings.showPoweredByTradeOS,
    },
    visibleTrustSignals: [
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
    ].filter((item): item is NonNullable<BrandStudioPreview["visibleTrustSignals"][number]> => Boolean(item)),
    missingSetupItems,
    completionPercentage: Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100),
  };
}

export function normalizeHexColor(value: string) {
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

function findAssetUrl(assets: BrandAsset[], types: string[]) {
  const normalizedTypes = types.map((type) => type.toLowerCase());
  const match = assets.find((asset) => normalizedTypes.includes(asset.type.toLowerCase()));
  return match?.url ?? null;
}

export function getTypographySpecimen(style: string) {
  return typographySpecimens.find((item) => item.style === style) ?? typographySpecimens[0];
}

function buildDerivedLogoVariants(profile: BrandProfile, assets: BrandAsset[], resolvedLogoUrls: BrandStudioPreview["resolvedLogoUrls"]) {
  const iconAssetUrl = findAssetUrl(assets, ["icon", "favicon"]);
  const monoAssetUrl = findAssetUrl(assets, ["logo-mono", "mono", "monochrome"]);
  const printSafeAssetUrl = findAssetUrl(assets, ["logo-print", "print-safe", "print"]);

  return [
    buildVariant("primary", resolvedLogoUrls.logoUrl, resolvedLogoUrls.logoUrl ? sourceForResolvedLogo(profile.logoUrl, resolvedLogoUrls.logoUrl) : "missing"),
    buildVariant("dark", resolvedLogoUrls.logoDarkUrl, resolvedLogoUrls.logoDarkUrl ? sourceForResolvedLogo(profile.logoDarkUrl, resolvedLogoUrls.logoDarkUrl) : "missing"),
    buildVariant("light", resolvedLogoUrls.logoLightUrl, resolvedLogoUrls.logoLightUrl ? sourceForResolvedLogo(profile.logoLightUrl, resolvedLogoUrls.logoLightUrl) : "missing"),
    buildVariant("icon", profile.iconUrl || iconAssetUrl || deriveVariantUrl(resolvedLogoUrls.logoUrl, "icon"), profile.iconUrl ? "explicit" : iconAssetUrl ? "asset" : resolvedLogoUrls.logoUrl ? "derived" : "missing", resolvedLogoUrls.logoUrl),
    buildVariant("favicon", iconAssetUrl || profile.iconUrl || deriveVariantUrl(resolvedLogoUrls.logoUrl, "favicon"), iconAssetUrl ? "asset" : profile.iconUrl ? "explicit" : resolvedLogoUrls.logoUrl ? "derived" : "missing", resolvedLogoUrls.logoUrl),
    buildVariant("monochrome", monoAssetUrl || deriveVariantUrl(resolvedLogoUrls.logoDarkUrl || resolvedLogoUrls.logoUrl, "mono"), monoAssetUrl ? "asset" : resolvedLogoUrls.logoDarkUrl || resolvedLogoUrls.logoUrl ? "derived" : "missing", resolvedLogoUrls.logoDarkUrl || resolvedLogoUrls.logoUrl),
    buildVariant("print-safe", printSafeAssetUrl || deriveVariantUrl(resolvedLogoUrls.logoLightUrl || resolvedLogoUrls.logoUrl, "print"), printSafeAssetUrl ? "asset" : resolvedLogoUrls.logoLightUrl || resolvedLogoUrls.logoUrl ? "derived" : "missing", resolvedLogoUrls.logoLightUrl || resolvedLogoUrls.logoUrl),
  ];
}

function buildVariant(kind: string, url: string | null, source: DerivedLogoVariant["source"], derivedFrom: string | null = null): DerivedLogoVariant {
  return { kind, url, source, derivedFrom: source === "derived" ? derivedFrom : null };
}

function sourceForResolvedLogo(explicitUrl: string, resolvedUrl: string): DerivedLogoVariant["source"] {
  return explicitUrl && explicitUrl === resolvedUrl ? "explicit" : "asset";
}

function deriveVariantUrl(url: string | null, variant: "icon" | "favicon" | "mono" | "print") {
  if (!url) return null;
  if (url.startsWith("/")) return appendVariantSuffix(url, variant);
  try {
    const parsed = new URL(url);
    parsed.pathname = appendVariantSuffix(parsed.pathname, variant);
    return parsed.toString();
  } catch {
    return null;
  }
}

function appendVariantSuffix(pathname: string, variant: string) {
  const match = /(\.[a-z0-9]+)$/i.exec(pathname);
  if (!match) return `${pathname}-${variant}`;
  const extension = match[1];
  return `${pathname.slice(0, -extension.length)}-${variant}${extension}`;
}
