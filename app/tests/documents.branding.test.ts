const getProfileMock = jest.fn();
const getDocumentSettingsMock = jest.fn();
const getPreviewMock = jest.fn();

jest.mock("../modules/brand-studio/service", () => ({
  BrandStudioService: jest.fn().mockImplementation(() => ({
    getProfile: getProfileMock,
    getDocumentSettings: getDocumentSettingsMock,
    getPreview: getPreviewMock,
  })),
}));

import { getDocumentBrand } from "../modules/documents/branding";

describe("document branding resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    });
  });
});
