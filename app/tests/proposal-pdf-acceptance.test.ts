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
  // Deliberately distinct from the customer name ("TEST Customer") so the
  // signed-PDF assertions prove the Acceptance block renders the signer,
  // not the customer card.
  signerName: "TEST Signer",
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
    expect(text).toContain("TEST Signer");
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
    expect(text).toContain("TEST Signer");
    expect(text).toContain("2026-11-25");
  });

  it("draws a valid alpha-channel signature (the pad produces RGBA/grayscale-alpha PNGs)", async () => {
    // The signature pad canvas emits PNGs with an alpha channel. PDFKit
    // takes the async pixel-decode path for those (splitAlphaChannel), not
    // the direct-embed path used for opaque RGB PNGs, so the render must
    // complete with the image embedded. This is a real 2x2 RGBA PNG
    // (color type 6), built with correct chunk CRCs and a valid zlib stream.
    const alphaPng = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwHwyBNBgAAEnICff5q7YNAAAAAElFTkSuQmCC";
    const pdf = await renderEstimateProposalPdf(estimate, {
      ...estimateArgs,
      acceptance: { ...acceptance, signatureDataUrl: `data:image/png;base64,${alphaPng}` },
    });
    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
    const text = pdfText(pdf);
    expect(text).toContain("TEST Signer");
    expect(text).toContain("2026-11-25");
  });

  it("falls back to name and date without an image when the stored signature has corrupt pixel data", async () => {
    // Corrupt the IDAT payload (same length, invalid zlib stream) of the
    // 2x2 RGBA PNG above: the PNG headers stay valid, so both the storage
    // magic-bytes check and the PDF image byte validation pass. The alpha
    // channel forces PDFKit down its async pixel-decode path, where an
    // inflate error is thrown inside the zlib callback, outside any
    // try/catch around doc.image — so only a pixel-stream pre-validation
    // can fall back safely.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwHwyBNBgAAEnICff5q7YNAAAAAElFTkSuQmCC",
      "base64",
    );
    const corrupt = Buffer.from(png);
    corrupt.fill(0xff, 41, 41 + 18);
    const pdf = await renderEstimateProposalPdf(estimate, {
      ...estimateArgs,
      acceptance: { ...acceptance, signatureDataUrl: `data:image/png;base64,${corrupt.toString("base64")}` },
    });
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");
    const text = pdfText(pdf);
    expect(text).toContain("TEST Signer");
    expect(text).toContain("2026-11-25");
  });

  it("grows the signed block for a long signer name instead of overlapping the following content", async () => {
    const longName =
      "Alexander Bartholomew Christopher Davidson Montgomery Fitzpatrick Richardson Williamson Harrington Beauregard Worthington the Third of Terre Haute Indiana";
    const pdf = await renderEstimateProposalPdf(estimate, {
      ...estimateArgs,
      brand: { ...brand, showPoweredByTradeOS: true },
      acceptance: { ...acceptance, signerName: longName },
    });
    const text = pdfText(pdf).replace(/\s+/g, " ");
    expect(text).toContain(longName);
    expect(text).toContain("Powered by TradeOS");
  });

  it("draws the recorded signature image with signer name and date (project-draft PDF)", async () => {
    const pdf = await renderProjectProposalPdf({ ...projectProposal, ...acceptance }, brand, null);
    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
    const text = pdfText(pdf);
    expect(text).toContain("TEST Signer");
    expect(text).toContain("2026-11-25");
  });

  it("keeps blank acceptance lines when no signature was recorded (project-draft PDF)", async () => {
    const pdf = await renderProjectProposalPdf(projectProposal, brand, null);
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image");
    expect(pdfText(pdf)).toContain("Accepted by");
  });
});
