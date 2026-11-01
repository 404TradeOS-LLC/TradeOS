import { inflateSync } from "node:zlib";

const mockPrisma = { estimate: { findFirst: jest.fn() } };
const mockGetDocumentBrand = jest.fn();

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/documents/branding", () => ({ getDocumentBrand: mockGetDocumentBrand }));

import { ProposalGeneratorService, renderEstimateProposalPdf } from "../modules/proposal-generator/service";

const brand = {
  companyName: "Canonical Builders",
  tagline: "Built to last",
  logoUrl: null,
  colors: { primary: "#202225", secondary: "#ffffff", accent: "#C98460" },
  typography: { style: "Professional", headingFontFamily: "Helvetica", bodyFontFamily: "Helvetica", accentFontFamily: "Helvetica" },
  websiteUrl: "", phone: "", email: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "",
  licenseNumber: "", insuranceSummary: "", bondingSummary: "", serviceAreas: [], certifications: [],
  showPoweredByTradeOS: false, showLicenseNumber: false, showInsuranceSummary: false,
};

function pdfText(pdf: Buffer): string {
  const chunks: string[] = [];
  let start = 0;
  while ((start = pdf.indexOf("stream", start)) !== -1) {
    const dataStart = pdf.indexOf(0x0a, start) + 1;
    const end = pdf.indexOf("endstream", dataStart);
    if (dataStart <= 0 || end < 0) break;
    const data = pdf.subarray(dataStart, end).subarray(0, -1);
    try {
      const decoded = inflateSync(data).toString("latin1");
      for (const m of decoded.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
        chunks.push(Array.from(m[1].matchAll(/<([0-9a-f]+)>/gi), (hex) => Buffer.from(hex[1], "hex").toString("latin1")).join(""));
      }
    } catch {}
    start = end + 9;
  }
  return chunks.join("\n");
}

describe("Trusted proposal logo bytes", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPYX2ONFTEMLQkAqeRdgcrsUtEAAAAASUVORK5CYII=", "base64");
  const estimate = {
    version: 1, totalPrice: 3000, createdAt: new Date("2026-10-01T12:00:00Z"),
    project: { name: "Kitchen", siteAddress: null, customer: { name: "Client", email: null }, organization: { name: "Canonical Builders", phone: null, email: null, address: null } },
    lineItems: [{ description: "Cabinet prep", quantity: 1, unitOfMeasure: "job", lineCost: 3000 }],
  };
  const args = {
    brand, showLineItemDetail: false, termsAndConditions: "Terms", finalPrice: 3000,
  };

  it("embeds bounded image bytes in the contractor-branded PDF", async () => {
    const pdf = await renderEstimateProposalPdf(estimate, { ...args, logoImage: png });
    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
    expect(pdfText(pdf)).toContain("Canonical Builders");
  });

  it("omits invalid image bytes and preserves the fallback company name", async () => {
    const pdf = await renderEstimateProposalPdf(estimate, { ...args, logoImage: Buffer.from("http://evil.example.com") });
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");
    expect(pdfText(pdf)).toContain("Canonical Builders");
  });
});
