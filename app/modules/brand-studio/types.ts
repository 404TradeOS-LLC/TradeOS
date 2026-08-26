export interface BrandLinkDTO {
  label: string;
  url: string;
}

export interface BrandAssetDTO {
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
  createdAt: Date;
}

export interface BrandProfileDTO {
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
  socialLinks: BrandLinkDTO[];
  reviewLinks: BrandLinkDTO[];
  financingLinks: BrandLinkDTO[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface TypographySpecimenDTO {
  style: string;
  label: string;
  headingFontFamily: string;
  bodyFontFamily: string;
  accentFontFamily: string;
  headingSample: string;
  bodySample: string;
}

export interface DerivedLogoVariantDTO {
  kind: string;
  url: string | null;
  source: "explicit" | "asset" | "derived" | "missing";
  derivedFrom: string | null;
}

export interface BrandDocumentSettingsDTO {
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
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface BrandStudioPreviewDTO {
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
  derivedLogoVariants: DerivedLogoVariantDTO[];
  typography: TypographySpecimenDTO;
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

export interface UpdateBrandProfileInput {
  companyDisplayName?: string;
  tagline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  logoLightUrl?: string;
  iconUrl?: string;
  watermarkUrl?: string;
  coverImageUrl?: string;
  defaultDocumentTheme?: string;
  typographyStyle?: string;
  proposalStyle?: string;
  invoiceStyle?: string;
  contractStyle?: string;
  emailSignature?: string;
  websiteUrl?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  licenseNumber?: string;
  insuranceSummary?: string;
  bondingSummary?: string;
  yearsInBusiness?: number | null;
  serviceAreas?: string[];
  certifications?: string[];
  socialLinks?: BrandLinkDTO[];
  reviewLinks?: BrandLinkDTO[];
  financingLinks?: BrandLinkDTO[];
}

export interface CreateBrandAssetInput {
  type: string;
  label?: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface UpdateBrandDocumentSettingsInput {
  showPoweredByTradeOS?: boolean;
  showLicenseNumber?: boolean;
  showInsuranceSummary?: boolean;
  showGoogleRating?: boolean;
  showSocialLinks?: boolean;
  defaultCoverMode?: string;
  defaultHeaderStyle?: string;
  defaultFooterStyle?: string;
}
