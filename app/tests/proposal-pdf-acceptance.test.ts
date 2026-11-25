import { inflateSync } from "node:zlib";

jest.mock("../db/client", () => ({ prisma: {} }));
import { renderEstimateProposalPdf, renderProjectProposalPdf } from "../modules/proposal-generator/service";

// DES-10-F7: the drawn portal signature is recorded on the proposal row
// (signatureDataUrl + signerName + signedAt) but was never rendered
// anywhere — the staff page had no acceptance section and the PDF
// Acceptance block drew two blank lines. These tests pin the render
// contract: a valid recorded signature is drawn as an image with the
// signer name and date; anything else keeps the blank lines.

const brand = {
  companyName: "Canonical Builders", tagline: "", logoUrl: null,
  colors: { primary: "#202225", secondary: "#ffffff", accent: "#C98460" },
  typography: { style: "Professional", headingFontFamily: "Helvetica", bodyFontFamily: "Helvetica", accentFontFamily: "Helvetica" },
  websiteUrl: "", phone: "", email: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "",
  licenseNumber: "", insuranceSummary: "", bondingSummary: "", serviceAreas: [], certifications: [],
  showPoweredByTradeOS: false, showLicenseNumber: false, showInsuranceSummary: false,
};

// Real 8x8 PNG (same fixture as the logo branding test): valid PNG magic
// bytes, so it passes both isValidSignatureDataUrl and the PDF image
// byte validation.
const SIGNATURE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPYX2ONFTEMLQkAqeRdgcrsUtEAAAAASUVORK5CYII=";
const SIGNATURE_DATA_URL = `data:image/png;base64,${SIGNATURE_PNG_BASE64}`;
const SIGNED_AT = new Date("2026-11-25T02:38:00Z");

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

const estimate = {
  version: 1, totalPrice: 8500, createdAt: new Date("2026-11-24T12:00:00Z"),
  project: {
    name: "Deck Replacement", siteAddress: "4050 S State Road 63",
    customer: { name: "TEST Customer", email: "test-customer@example.invalid" },
    organization: { name: "Canonical Builders", phone: null, email: null, address: null },
  },
  lineItems: [{ description: "Deck replacement", quantity: 1, unitOfMeasure: "EA", lineCost: 8500 }],
};
const estimateArgs = {
  brand, showLineItemDetail: false, termsAndConditions: "Terms", finalPrice: 8500,
};
const acceptance = {
  signerName: "TEST Customer",
  signerEmail: "test-customer@example.invalid",
  signatureDataUrl: SIGNATURE_DATA_URL,
  signedAt: SIGNED_AT,
};

const projectProposal = {
  companyName: "Canonical Builders",
  scopeOfWork: "Deck replacement",
  assumptions: "Assumptions",
  exclusions: "Exclusions",
  timeline: "Two weeks",
  priceLow: null,
  priceHigh: null,
  finalPrice: 8500,
  paymentScheduleJson: [],
  termsAndConditions: "Terms",
  createdAt: new Date("2026-11-24T12:00:00Z"),
  signerName: null,
  signerEmail: null,
  signatureDataUrl: null,
  signedAt: null,
  project: {
    name: "Deck Replacement", siteAddress: "4050 S State Road 63",
    customer: { name: "TEST Customer", email: "test-customer@example.invalid" },
    organization: { name: "Canonical Builders", phone: null, email: null, address: null },
  },
};

describe("Proposal PDF acceptance block", () => {
  it("draws the recorded signature image with signer name and date (estimate-backed PDF)", async () => {
    const pdf = await renderEstimateProposalPdf(estimate, { ...estimateArgs, acceptance });
    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
    const text = pdfText(pdf);
    expect(text).toContain("TEST Customer");
    expect(text).toContain("2026-11-25");
  });

  it("keeps blank acceptance lines when no signature was recorded (estimate-backed PDF)", async () => {
    const pdf = await renderEstimateProposalPdf(estimate, estimateArgs);
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");
    expect(pdfText(pdf)).toContain("Accepted by");
  });

  it("falls back to name and date without an image when the stored signature bytes are not a valid image", async () => {
    const pdf = await renderEstimateProposalPdf(estimate, {
      ...estimateArgs,
      acceptance: { ...acceptance, signatureDataUrl: "data:image/png;base64,AAAA" },
    });
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");
    const text = pdfText(pdf);
    expect(text).toContain("TEST Customer");
    expect(text).toContain("2026-11-25");
  });

  it("draws the recorded signature image with signer name and date (project-draft PDF)", async () => {
    const pdf = await renderProjectProposalPdf({ ...projectProposal, ...acceptance }, brand, null);
    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
    const text = pdfText(pdf);
    expect(text).toContain("TEST Customer");
    expect(text).toContain("2026-11-25");
  });

  it("keeps blank acceptance lines when no signature was recorded (project-draft PDF)", async () => {
    const pdf = await renderProjectProposalPdf(projectProposal, brand, null);
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");
    expect(pdfText(pdf)).toContain("Accepted by");
  });
});
