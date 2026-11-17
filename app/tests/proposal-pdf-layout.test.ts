import { inflateSync } from "node:zlib";

jest.mock("../db/client", () => ({ prisma: {} }));
import { renderEstimateProposalPdf } from "../modules/proposal-generator/service";

function runs(pdf: Buffer): Array<{ text: string; x: number; y: number }> {
  const result: Array<{ text: string; x: number; y: number }> = [];
  for (const stream of pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let decoded: string;
    try { decoded = inflateSync(Buffer.from(stream[1], "latin1")).toString("latin1"); } catch { continue; }
    for (const block of decoded.matchAll(/BT\n([\s\S]*?)ET/g)) {
      const position = block[1].match(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/);
      if (!position) continue;
      // Preserve odd PDF hex strings too: <d> is padded to D0 by PDF readers.
      const text = Array.from(block[1].matchAll(/<([0-9a-f]+)>/gi), (hex) =>
        Buffer.from(hex[1].padEnd(Math.ceil(hex[1].length / 2) * 2, "0"), "hex").toString("latin1")
      ).join("");
      result.push({ text, x: Number(position[1]), y: Number(position[2]) });
    }
  }
  return result;
}

const brand = {
  companyName: "Canonical Builders", tagline: "", logoUrl: null,
  colors: { primary: "#202225", secondary: "#ffffff", accent: "#C98460" },
  typography: { style: "Professional", headingFontFamily: "Helvetica", bodyFontFamily: "Helvetica", accentFontFamily: "Helvetica" },
  websiteUrl: "", phone: "", email: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "",
  licenseNumber: "", insuranceSummary: "", bondingSummary: "", serviceAreas: [], certifications: [],
  showPoweredByTradeOS: false, showLicenseNumber: false, showInsuranceSummary: false,
};
const fixture = {
  version: 1, totalPrice: 7105.07, createdAt: new Date("2026-11-13T12:00:00Z"),
  project: {
    name: "RC Evidence Remodel local-beta_pdf-1794597604-768", siteAddress: "100 Evidence Way",
    customer: { name: "Acme Test Customer local-beta_pdf-1794597604-768", email: "rc-evidence-local-beta_pdf-1794597604-768@example.invalid" },
    organization: { name: "Canonical Builders", phone: null, email: null, address: null },
  },
  lineItems: [{ description: "Cabinet prep", quantity: 1, unitOfMeasure: "job", lineCost: 7105.07 }],
};
const options = { brand, showLineItemDetail: false, termsAndConditions: "Terms", finalPrice: 7105.07 };

describe("Proposal PDF saved-input layout", () => {
  it("places email/address below wrapped names and the price below all metadata", async () => {
    const text = runs(await renderEstimateProposalPdf(fixture, options));
    const customerEnd = text.find((run) => run.x < 300 && run.text === "beta_pdf-1794597604-768")!;
    const emailStart = text.find((run) => run.text === "rc-evidence-local-")!;
    const projectEnd = text.find((run) => run.x > 300 && run.text === "beta_pdf-1794597604-768")!;
    const address = text.find((run) => run.text === "100 Evidence Way")!;
    expect(customerEnd).toBeDefined();
    expect(emailStart).toBeDefined();
    expect(projectEnd).toBeDefined();
    expect(address).toBeDefined();
    // PDF y decreases down the page. Each 11pt line must finish before
    // the next field begins, including the wrapped name's final line.
    expect(customerEnd.y - emailStart.y).toBeGreaterThan(11);
    expect(projectEnd.y - address.y).toBeGreaterThan(11);
    const emailBottom = Math.min(...text.filter((run) => run.text.includes("@example.invalid")).map((run) => run.y));
    const investment = text.find((run) => run.text === "INVESTMENT")!;
    expect(investment).toBeDefined();
    expect(emailBottom - investment.y).toBeGreaterThan(25);
    expect(text.map((run) => run.text).join("\n")).toContain("$7,105.07");
  });

  it.each(["\r\n", "\r", "\u2028", "\u2029"])("renders saved %j breaks without control glyphs", async (separator) => {
    const render = async (lineBreak: string) => runs(await renderEstimateProposalPdf(fixture, {
      ...options,
      scopeOfWork: ["First paragraph.", "", "Second paragraph."].join(lineBreak),
      assumptions: ["First assumption.", "Second assumption."].join(lineBreak),
      exclusions: ["First exclusion.", "Second exclusion."].join(lineBreak),
    })).map((run) => run.text);
    expect(await render(separator)).toEqual(await render("\n"));
  });
});
