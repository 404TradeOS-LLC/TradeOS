const getProfileMock = jest.fn();
const getDocumentSettingsMock = jest.fn();
const getPreviewMock = jest.fn();
const mockPrisma = {
  organization: { findUnique: jest.fn() },
  organizationSettings: { findUnique: jest.fn() },
};

jest.mock("../modules/brand-studio/service", () => ({
  BrandStudioService: jest.fn().mockImplementation(() => ({
    getProfile: getProfileMock,
    getDocumentSettings: getDocumentSettingsMock,
    getPreview: getPreviewMock,
  })),
}));

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { getDocumentBrand } from "../modules/documents/branding";

describe("document branding resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    mockPrisma.organizationSettings.findUnique.mockResolvedValue(null);
  });

  it("uses authenticated canonical Brand Studio values and document visibility settings", async () => {
    getProfileMock.mockResolvedValue({
      companyDisplayName: "Canonical Builders",
      tagline: "Built to last",
      logoUrl: "https://cdn.example.com/logo.svg",
      logoDarkUrl: "",
      logoLightUrl: "",
      primaryColor: "#123456",
      secondaryColor: "#abcdef",
      accentColor: "#fedcba",
      websiteUrl: "https://canonical.example.com",
      phone: "317-555-0100",
      email: "hello@canonical.example.com",
      addressLine1: "1 Main Street",
      addressLine2: "Suite 2",
      city: "Terre Haute",
      state: "IN",
      postalCode: "47802",
      licenseNumber: "LIC-1",
      insuranceSummary: "Insured",
      bondingSummary: "Bonded",
    });
    getDocumentSettingsMock.mockResolvedValue({ showPoweredByTradeOS: true, showLicenseNumber: false, showInsuranceSummary: true });
    getPreviewMock.mockResolvedValue({
      resolvedLogoUrls: { logoUrl: "https://cdn.example.com/logo.svg" },
      validatedColors: { primary: "#123456", secondary: "#abcdef", accent: "#fedcba" },
      typography: {
        style: "Professional",
        headingFontFamily: "sans-serif",
        bodyFontFamily: "sans-serif",
        accentFontFamily: "monospace",
      },
    });

    await expect(getDocumentBrand("org-1", "Caller supplied name")).resolves.toMatchObject({
      companyName: "Canonical Builders",
      colors: { primary: "#123456", accent: "#fedcba" },
      logoUrl: "https://cdn.example.com/logo.svg",
      showPoweredByTradeOS: true,
      showLicenseNumber: false,
      showInsuranceSummary: true,
    });
    expect(getProfileMock).toHaveBeenCalledWith("org-1");
    expect(getDocumentSettingsMock).toHaveBeenCalledWith("org-1");
    expect(getPreviewMock).toHaveBeenCalledWith("org-1");
  });

  it("falls back deterministically when no organization context is available", async () => {
    await expect(getDocumentBrand(undefined, "Preview Company")).resolves.toMatchObject({
      companyName: "Preview Company",
      colors: { primary: "#0f172a", accent: "#c2410c" },
      logoUrl: null,
      showPoweredByTradeOS: false,
    });
    expect(getProfileMock).not.toHaveBeenCalled();
    expect(getDocumentSettingsMock).not.toHaveBeenCalled();
    expect(getPreviewMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe stored color values in favor of the safe palette", async () => {
    getProfileMock.mockResolvedValue({
      companyDisplayName: "Safe Company",
      tagline: "",
      logoUrl: "",
      logoDarkUrl: "",
      logoLightUrl: "",
      primaryColor: "url(javascript:alert(1))",
      secondaryColor: "not-a-color",
      accentColor: "#123456",
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
    });
    getDocumentSettingsMock.mockResolvedValue({ showPoweredByTradeOS: false, showLicenseNumber: true, showInsuranceSummary: true });
    getPreviewMock.mockResolvedValue({
      resolvedLogoUrls: { logoUrl: "javascript:alert(1)" },
      validatedColors: { primary: "url(javascript:alert(1))", secondary: "not-a-color", accent: "#123456" },
      typography: {
        style: "Professional",
        headingFontFamily: "sans-serif",
        bodyFontFamily: "sans-serif",
        accentFontFamily: "monospace",
      },
    });

    await expect(getDocumentBrand("org-1")).resolves.toMatchObject({
      colors: { primary: "#0f172a", secondary: "#f8fafc", accent: "#123456" },
      logoUrl: null,
    });
  });

  it("preserves legacy organization contact fallbacks when canonical fields are empty", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      name: "Legacy Builders",
      phone: "317-555-0199",
      email: "legacy@example.com",
      address: "9 Old Mill Road",
      logoUrl: "",
    });
    mockPrisma.organizationSettings.findUnique.mockResolvedValue({
      settingsJson: { phone: "317-555-0101", website: "https://legacy.example.com", address: "10 Settings Lane" },
    });
    getProfileMock.mockResolvedValue({
      companyDisplayName: "Legacy Builders",
      tagline: "",
      logoUrl: "",
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
    });
    getDocumentSettingsMock.mockResolvedValue({ showPoweredByTradeOS: false, showLicenseNumber: true, showInsuranceSummary: true });
    getPreviewMock.mockResolvedValue({
      resolvedLogoUrls: { logoUrl: null },
      validatedColors: { primary: "#123456", secondary: "#abcdef", accent: "#fedcba" },
      typography: { style: "Professional", headingFontFamily: "sans-serif", bodyFontFamily: "sans-serif", accentFontFamily: "monospace" },
    });

    await expect(getDocumentBrand("org-1")).resolves.toMatchObject({
      companyName: "Legacy Builders",
      websiteUrl: "https://legacy.example.com",
      phone: "317-555-0101",
      email: "legacy@example.com",
      addressLine1: "10 Settings Lane",
    });
  });
});
