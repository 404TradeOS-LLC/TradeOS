import { renderChangeOrderFrameHtml, renderEstimateFrameHtml, renderMaintenanceGuideFrameHtml, renderWarrantyFrameHtml } from "../modules/documents/templates";

const brand = {
  companyName: "Acme Exteriors",
  tagline: "Storm-ready crews",
  logoUrl: "https://cdn.example.com/logo.svg",
  colors: {
    primary: "#123456",
    secondary: "#F5F5F4",
    accent: "#D97706",
  },
  typography: {
    style: "Professional",
    headingFontFamily: '"IBM Plex Sans", sans-serif',
    bodyFontFamily: '"Inter", sans-serif',
    accentFontFamily: '"IBM Plex Mono", monospace',
  },
  websiteUrl: "https://acme.example.com",
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
  serviceAreas: ["Indianapolis"],
  certifications: ["GAF Master Elite"],
  showPoweredByTradeOS: false,
};

describe("document frame templates", () => {
  it("renders estimate html with frame shell and line items", () => {
    const html = renderEstimateFrameHtml({
      brand,
      estimate: {
        version: 3,
        createdAt: new Date("2026-07-03T18:00:00.000Z"),
        projectName: "Oak Street Roof Replacement",
        projectAddress: "44 Oak St, Carmel, IN",
        customerName: "Jordan Rivers",
        customerEmail: "jordan@example.com",
        subtotalCost: 12000,
        totalPrice: 16800,
        lineItems: [{ description: "Roof tear-off", quantity: 24, unitOfMeasure: "SQ", unitCost: 310, lineCost: 7440 }],
      },
    });

    expect(html).toContain("Estimate v3");
    expect(html).toContain("Roof tear-off");
    expect(html).toContain("frame-page");
    expect(html).toContain("Acme Exteriors");
  });

  it("renders change order html with amount and scope summary", () => {
    const html = renderChangeOrderFrameHtml({
      brand,
      changeOrder: {
        coNumber: 2,
        createdAt: new Date("2026-07-03T18:00:00.000Z"),
        status: "approved",
        description: "Add chimney flashing rebuild.",
        amount: 1450,
        scheduleImpactDays: 2,
        projectName: "Oak Street Roof Replacement",
        projectAddress: "44 Oak St, Carmel, IN",
        customerName: "Jordan Rivers",
        customerEmail: "jordan@example.com",
        lineItems: [{ description: "Flashing rebuild", quantity: 1, unitCost: 1450, lineCost: 1450 }],
      },
    });

    expect(html).toContain("Change Order #2");
    expect(html).toContain("Add chimney flashing rebuild.");
    expect(html).toContain("$1,450.00");
  });

  it("renders warranty and maintenance guides as print-ready html", () => {
    const warrantyHtml = renderWarrantyFrameHtml({
      brand,
      warranty: {
        projectName: "Oak Street Roof Replacement",
        projectAddress: "44 Oak St, Carmel, IN",
        customerName: "Jordan Rivers",
        customerEmail: "jordan@example.com",
        effectiveDate: new Date("2026-07-03T18:00:00.000Z"),
        workmanshipCoverage: "Five-year workmanship support on installation labor.",
        manufacturerCoverage: "Manufacturer-backed shingle system warranty per registered package.",
        exclusions: ["Storm damage", "Unapproved third-party penetrations"],
        supportProcess: "Email photos and a description of the issue to schedule an inspection.",
        requiredDocuments: ["Final invoice", "Closeout photos"],
      },
    });
    const maintenanceHtml = renderMaintenanceGuideFrameHtml({
      brand,
      guide: {
        projectName: "Oak Street Roof Replacement",
        projectAddress: "44 Oak St, Carmel, IN",
        customerName: "Jordan Rivers",
        customerEmail: "jordan@example.com",
        generatedAt: new Date("2026-07-03T18:00:00.000Z"),
        systemLabel: "Roof Maintenance Guide",
        seasonalChecklist: ["Clear debris from valleys"],
        annualChecklist: ["Book annual inspection"],
        warningSigns: ["Granule loss near downspouts"],
        recommendedPartners: ["Acme service team"],
      },
    });

    expect(warrantyHtml).toContain("Warranty Coverage Guide");
    expect(warrantyHtml).toContain("Five-year workmanship support");
    expect(maintenanceHtml).toContain("Roof Maintenance Guide");
    expect(maintenanceHtml).toContain("Clear debris from valleys");
  });

  it("fails closed for unsafe frame colors, fonts, and logo URLs", () => {
    const html = renderEstimateFrameHtml({
      brand: {
        ...brand,
        logoUrl: "javascript:alert(1)",
        colors: { primary: "url(javascript:alert(1))", secondary: "#F5F5F4", accent: "#D97706" },
        typography: {
          ...brand.typography,
          headingFontFamily: "}; background:url(javascript:alert(1)); /*",
        },
      },
      estimate: {
        version: 1,
        createdAt: new Date("2026-07-03T18:00:00.000Z"),
        projectName: "Safe Output",
        projectAddress: "1 Main St",
        customerName: "Customer",
        customerEmail: "customer@example.com",
        subtotalCost: 100,
        totalPrice: 100,
        lineItems: [],
      },
    });

    expect(html).not.toContain("javascript:");
    expect(html).toContain("--frame-primary: #0f172a;");
    expect(html).toContain("--frame-heading-font: Arial, sans-serif;");
  });

  it("honors document trust-signal visibility settings", () => {
    const html = renderEstimateFrameHtml({
      brand: { ...brand, showLicenseNumber: false, showInsuranceSummary: false },
      estimate: {
        version: 1,
        createdAt: new Date("2026-07-03T18:00:00.000Z"),
        projectName: "Visibility Test",
        projectAddress: "1 Main St",
        customerName: "Customer",
        customerEmail: "customer@example.com",
        subtotalCost: 100,
        totalPrice: 100,
        lineItems: [],
      },
    });

    expect(html).not.toContain("LIC-44");
    expect(html).not.toContain("2M aggregate");
    expect(html).toContain("Available");
  });

  it("uses deterministic UTC dates and safe numeric fallbacks", () => {
    const html = renderEstimateFrameHtml({
      brand,
      estimate: {
        version: 1,
        createdAt: new Date("2026-08-24T23:30:00-05:00"),
        projectName: "Safe Output",
        projectAddress: "",
        customerName: "Customer",
        customerEmail: "",
        subtotalCost: Number.NaN,
        totalPrice: Number.POSITIVE_INFINITY,
        lineItems: [{ description: "Work", quantity: Number.NaN, unitOfMeasure: "job", unitCost: Number.NaN, lineCost: Number.NaN }],
      },
    });

    expect(html).toContain("2026-08-25");
    expect(html).toContain("Amount unavailable");
    expect(html).toContain("—");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });

  it("renders an explicit empty-table state", () => {
    const html = renderEstimateFrameHtml({
      brand,
      estimate: {
        version: 1,
        createdAt: new Date("2026-08-24T00:00:00.000Z"),
        projectName: "Empty Estimate",
        projectAddress: "1 Main St",
        customerName: "Customer",
        customerEmail: "customer@example.com",
        subtotalCost: 0,
        totalPrice: 0,
        lineItems: [],
      },
    });

    expect(html).toContain("No line items recorded.");
  });
});
