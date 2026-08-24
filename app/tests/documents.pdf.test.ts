import { inflateSync } from "node:zlib";
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
    const text = extractPdfText(pdf);
    expect(text).toContain("Canonical Builders");
    expect(text).toContain("317-555-0100");
    expect(text).toContain("Invoice #7");
    expect(text).toContain("License LIC-1");
    expect(text).toContain("Insured");
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
    const text = extractPdfText(pdf);
    expect(text).toContain("Canonical Builders");
    expect(text).toContain("Signed by: Customer");
    expect(text).toContain("Signed on:");
  });

  it("uses deterministic UTC dates and explicit empty-data fallbacks", async () => {
    const pdf = await renderInvoicePdf(
      {
        invoiceNumber: 8,
        type: "full",
        status: "draft",
        amount: Number.NaN,
        dueDate: new Date("invalid"),
        createdAt: new Date("2026-08-24T23:30:00-05:00"),
        percentComplete: null,
        project: { name: "Empty Project", siteAddress: null, customer: null },
        lineItems: [],
      },
      { brand }
    );

    const text = extractPdfText(pdf);
    expect(text).toContain("Invoice Date: 2026-08-25");
    expect(text).toContain("Due Date: Date unavailable");
    expect(text).toContain("No line items recorded.");
    expect(text).toContain("Amount unavailable");
    expect(text).not.toContain("NaN");
  });

  it("keeps long and special-character contract content renderable", async () => {
    const terms = `Terms & conditions <approved> ${"Long paragraph with special characters — homeowner’s scope. ".repeat(180)}END_MARKER`;
    const pdf = await renderContractPdf(
      {
        status: "pending_signature",
        termsText: terms,
        signerName: null,
        signedAt: null,
        createdAt: new Date("2026-08-24T00:00:00.000Z"),
        project: { name: "O'Brien & Sons <Main St>", siteAddress: null, customer: null },
      },
      { brand }
    );

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
    const text = extractPdfText(pdf);
    expect(text).toContain("O'Brien & Sons");
    expect(text).toContain("Terms & conditions");
    expect(text).toContain("END_MARKER");
    expect(text).toContain("Signature:");
  });
});

function extractPdfText(pdf: Buffer): string {
  const text: string[] = [];
  const streamMarker = Buffer.from("stream");
  const endMarker = Buffer.from("endstream");
  let offset = 0;

  while (true) {
    const streamStart = pdf.indexOf(streamMarker, offset);
    if (streamStart < 0) break;
    const contentStart = pdf.indexOf(0x0a, streamStart) + 1;
    const streamEnd = pdf.indexOf(endMarker, contentStart);
    if (contentStart <= 0 || streamEnd < 0) break;
    const raw = pdf.subarray(contentStart, streamEnd).subarray(0, -1);
    try {
      const decoded = inflateSync(raw).toString("latin1");
      const tjText = Array.from(decoded.matchAll(/\[([^\]]*)\]\s*TJ/g), (match) =>
        Array.from(match[1].matchAll(/<([0-9a-f]+)>/gi), (hex) => Buffer.from(hex[1], "hex").toString("latin1")).join("")
      );
      text.push(decoded, ...tjText);
    } catch {
      text.push(raw.toString("latin1"));
    }
    offset = streamEnd + endMarker.length;
  }

  return text.join("\n");
}
