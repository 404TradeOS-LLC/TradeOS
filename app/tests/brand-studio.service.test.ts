const mockTransaction = {
  organization: {
    update: jest.fn(),
  },
  brandProfile: {
    upsert: jest.fn(),
  },
  brandAsset: {
    create: jest.fn(),
  },
  brandDocumentSettings: {
    upsert: jest.fn(),
  },
};

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
  },
  brandProfile: {
    findUnique: jest.fn(),
  },
  brandAsset: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  brandDocumentSettings: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { BrandStudioService } from "../modules/brand-studio/service";

describe("BrandStudioService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockTransaction) => Promise<unknown>) => callback(mockTransaction));
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "org-1", name: "Acme Roofing" });
  });

  it("updates the profile, normalizes data, and syncs the organization shell fields", async () => {
    mockTransaction.brandProfile.upsert.mockResolvedValue({
      id: "brand-1",
      organizationId: "org-1",
      companyDisplayName: "Acme Exteriors",
      tagline: "Storm-ready crews",
      primaryColor: "#112233",
      secondaryColor: "#FFFFFF",
      accentColor: "#AABBCC",
      logoUrl: "https://cdn.example.com/logo.png",
      logoDarkUrl: null,
      logoLightUrl: null,
      iconUrl: null,
      watermarkUrl: null,
      coverImageUrl: null,
      typographyStyle: "Professional",
      defaultDocumentTheme: "signature-frame",
      proposalStyle: "premium",
      invoiceStyle: "compact",
      contractStyle: "formal",
      emailSignature: "Acme Exteriors",
      websiteUrl: "https://acme.example.com/",
      phone: "317-555-0100",
      email: "sales@acme.example.com",
      addressLine1: "123 Main St",
      addressLine2: "Suite 500",
      city: "Indianapolis",
      state: "IN",
      postalCode: "46204",
      licenseNumber: "LIC-44",
      insuranceSummary: "2M aggregate",
      bondingSummary: "Available",
      yearsInBusiness: 12,
      serviceAreasJson: ["Indianapolis", "Carmel"],
      certificationsJson: ["Owens Corning Platinum"],
      socialLinksJson: [{ label: "Instagram", url: "https://instagram.com/acme" }],
      reviewLinksJson: [],
      financingLinksJson: [],
      createdAt: new Date("2026-07-03T17:00:00.000Z"),
      updatedAt: new Date("2026-07-03T17:05:00.000Z"),
    });

    const service = new BrandStudioService();
    const profile = await service.updateProfile("org-1", {
      companyDisplayName: "Acme Exteriors",
      tagline: "Storm-ready crews",
      primaryColor: "#123",
      secondaryColor: "#ffffff",
      accentColor: "#aabbcc",
      logoUrl: "https://cdn.example.com/logo.png",
      websiteUrl: "https://acme.example.com",
      phone: "317-555-0100",
      email: "Sales@Acme.Example.com",
      addressLine1: "123 Main St",
      addressLine2: "Suite 500",
      city: "Indianapolis",
      state: "IN",
      postalCode: "46204",
      licenseNumber: "LIC-44",
      insuranceSummary: "2M aggregate",
      bondingSummary: "Available",
      yearsInBusiness: 12,
      serviceAreas: ["Indianapolis", "Carmel", "Indianapolis"],
      certifications: ["Owens Corning Platinum"],
      socialLinks: [{ label: "Instagram", url: "https://instagram.com/acme" }],
      reviewLinks: [],
      financingLinks: [],
      emailSignature: "Acme Exteriors",
      defaultDocumentTheme: "signature-frame",
      proposalStyle: "premium",
      invoiceStyle: "compact",
      contractStyle: "formal",
      typographyStyle: "Professional",
    });

    expect(mockTransaction.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining({
        name: "Acme Exteriors",
        phone: "317-555-0100",
        email: "sales@acme.example.com",
        logoUrl: "https://cdn.example.com/logo.png",
        address: "123 Main St\nSuite 500\nIndianapolis, IN\n46204",
      }),
    });
    expect(mockTransaction.brandProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          primaryColor: "#112233",
          secondaryColor: "#FFFFFF",
          accentColor: "#AABBCC",
          serviceAreasJson: ["Indianapolis", "Carmel"],
        }),
      })
    );
    expect(profile.socialLinks[0].url).toBe("https://instagram.com/acme");
    expect(profile.companyDisplayName).toBe("Acme Exteriors");
  });

  it("creates org-scoped brand assets using the current organization's profile", async () => {
    mockTransaction.brandProfile.upsert.mockResolvedValue({ id: "brand-1" });
    mockTransaction.brandAsset.create.mockResolvedValue({
      id: "asset-1",
      organizationId: "org-1",
      brandProfileId: "brand-1",
      type: "logo",
      label: "Primary logo",
      url: "https://cdn.example.com/logo.svg",
      mimeType: "image/svg+xml",
      sizeBytes: 2000,
      width: 320,
      height: 120,
      createdAt: new Date("2026-07-03T17:10:00.000Z"),
    });

    const service = new BrandStudioService();
    const asset = await service.createAsset("org-1", {
      type: "Logo",
      label: "Primary logo",
      url: "https://cdn.example.com/logo.svg",
      mimeType: "image/svg+xml",
      sizeBytes: 2000,
      width: 320,
      height: 120,
    });

    expect(mockTransaction.brandAsset.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        brandProfileId: "brand-1",
        type: "logo",
        label: "Primary logo",
        url: "https://cdn.example.com/logo.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 2000,
        width: 320,
        height: 120,
      },
    });
    expect(asset.brandProfileId).toBe("brand-1");
  });

  it("builds a normalized preview with fallback theme values and missing-item detection", async () => {
    mockPrisma.brandProfile.findUnique.mockResolvedValue({
      id: "brand-1",
      organizationId: "org-1",
      companyDisplayName: "Acme Exteriors",
      tagline: "Storm-ready crews",
      primaryColor: "#123456",
      secondaryColor: null,
      accentColor: "#D97706",
      logoUrl: "",
      logoDarkUrl: null,
      logoLightUrl: null,
      iconUrl: null,
      watermarkUrl: null,
      coverImageUrl: null,
      typographyStyle: "Modern",
      defaultDocumentTheme: "signature-frame",
      proposalStyle: "premium",
      invoiceStyle: "compact",
      contractStyle: "formal",
      emailSignature: "",
      websiteUrl: "",
      phone: "317-555-0100",
      email: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      licenseNumber: "LIC-44",
      insuranceSummary: "2M aggregate",
      bondingSummary: null,
      yearsInBusiness: 12,
      serviceAreasJson: ["Indianapolis"],
      certificationsJson: ["GAF Master Elite"],
      socialLinksJson: [{ label: "Instagram", url: "https://instagram.com/acme" }],
      reviewLinksJson: [{ label: "Google", url: "https://google.com/maps" }],
      financingLinksJson: [],
      createdAt: new Date("2026-07-03T17:00:00.000Z"),
      updatedAt: new Date("2026-07-03T17:05:00.000Z"),
    });
    mockPrisma.brandDocumentSettings.findUnique.mockResolvedValue({
      id: "doc-1",
      organizationId: "org-1",
      brandProfileId: "brand-1",
      showPoweredByTradeOS: false,
      showLicenseNumber: true,
      showInsuranceSummary: true,
      showGoogleRating: true,
      showSocialLinks: true,
      defaultCoverMode: null,
      defaultHeaderStyle: null,
      defaultFooterStyle: null,
      createdAt: new Date("2026-07-03T17:00:00.000Z"),
      updatedAt: new Date("2026-07-03T17:05:00.000Z"),
    });
    mockPrisma.brandAsset.findMany.mockResolvedValue([
      {
        id: "asset-1",
        organizationId: "org-1",
        brandProfileId: "brand-1",
        type: "logo",
        label: "Primary logo",
        url: "https://cdn.example.com/logo.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 2000,
        width: 320,
        height: 120,
        createdAt: new Date("2026-07-03T17:10:00.000Z"),
      },
    ]);

    const service = new BrandStudioService();
    const preview = await service.getPreview("org-1");

    expect(preview.validatedColors.primary).toBe("#123456");
    expect(preview.validatedColors.secondary).toBe("#E5E7EB");
    expect(preview.resolvedLogoUrls.logoUrl).toBe("https://cdn.example.com/logo.svg");
    expect(preview.derivedLogoVariants.find((item) => item.kind === "favicon")?.source).toBe("derived");
    expect(preview.typography.style).toBe("Modern");
    expect(preview.documentTheme.coverMode).toBe("editorial");
    expect(preview.visibleTrustSignals.map((item) => item.id)).toEqual(
      expect.arrayContaining(["license", "insurance", "certifications", "social", "reviews"])
    );
    expect(preview.missingSetupItems).toEqual(
      expect.arrayContaining(["Add your website URL", "Add a customer-facing email", "Add your business address"])
    );
    expect(preview.completionPercentage).toBeGreaterThan(0);
  });
});
