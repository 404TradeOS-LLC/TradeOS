import { renderContractPdf } from "../modules/contracts/pdf";
import { renderInvoicePdf } from "../modules/invoices/pdf";
import type { DocumentFrameBrand } from "../modules/documents/frame";

const brand: DocumentFrameBrand = {
  companyName: "Canonical Builders",
  tagline: "Built to last",
  logoUrl: "https://cdn.example.com/logo.svg",
  colors: { primary: "#123456", secondary: "#f8fafc", accent: "#fedcba" },
  typography: {
    style: "Professional",
    headingFontFamily: "Helvetica-Bold",
    bodyFontFamily: "Helvetica",
    accentFontFamily: "Helvetica-Bold",
  },
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
  serviceAreas: [],
  certifications: [],
  showPoweredByTradeOS: true,
  showLicenseNumber: true,
  showInsuranceSummary: true,
};

describe("branded PDF renderers", () => {
  it("returns a valid branded invoice PDF without changing invoice semantics", async () => {
    const pdf = await renderInvoicePdf(
      {
        invoiceNumber: 7,
        type: "full",
        status: "sent",
        amount: 1250,
        dueDate: new Date("2026-09-01T00:00:00.000Z"),
        createdAt: new Date("2026-08-24T00:00:00.000Z"),
        percentComplete: null,
        project: { name: "Main Street", siteAddress: "1 Main St", customer: { name: "Customer", email: "customer@example.com" } },
        lineItems: [{ description: "Labor", quantity: 1, unitOfMeasure: "job", unitCost: 1250, lineCost: 1250 }],
      },
      { brand }
    );

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("returns a valid branded contract PDF without changing signature semantics", async () => {
    const pdf = await renderContractPdf(
      {
        status: "signed",
        termsText: "Existing contract terms.",
        signerName: "Customer",
        signedAt: new Date("2026-08-24T00:00:00.000Z"),
        createdAt: new Date("2026-08-23T00:00:00.000Z"),
        project: { name: "Main Street", siteAddress: "1 Main St", customer: { name: "Customer" } },
      },
      { brand }
    );

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });
});
