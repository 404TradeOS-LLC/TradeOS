import PDFDocument from "pdfkit";
import type { DocumentFrameBrand } from "../documents/frame";
import { formatDocumentDate } from "../documents/format";

const DOCUMENT_INK = "#0f172a";

interface ContractForPdf {
  status: string;
  termsText: string;
  signerName: string | null;
  signedAt: Date | null;
  createdAt: Date;
  project: { name: string; siteAddress: string | null; customer: { name: string } | null };
}

export function renderContractPdf(contract: ContractForPdf, opts: { brand: DocumentFrameBrand }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const brand = opts.brand;
    const contact = [brand.phone, brand.email, brand.websiteUrl].filter(Boolean).join("   •   ");
    doc.save();
    doc.roundedRect(50, 38, doc.page.width - 100, 74, 14).fill(brand.colors.primary);
    doc.restore();
    const headerForeground = getHeaderForeground(brand.colors.primary);
    doc.fillColor(headerForeground).fontSize(20).text(brand.companyName, 66, 54, { width: 300 });
    if (brand.tagline) doc.fontSize(9).text(brand.tagline, 66, 80, { width: 300 });
    if (contact) doc.fontSize(8).text(contact, 66, 96, { width: doc.page.width - 132 });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor(brand.colors.accent).text("Contract", 50, 132, { align: "left" });
    doc.fillColor(DOCUMENT_INK);
    doc.y = 158;
    doc.moveDown(1);

    doc.fontSize(10).fillColor(DOCUMENT_INK).text(`Project: ${contract.project.name}`);
    if (contract.project.siteAddress) doc.text(`Site Address: ${contract.project.siteAddress}`);
    if (contract.project.customer) doc.text(`Customer: ${contract.project.customer.name}`);
    doc.text(`Contract Date: ${formatDocumentDate(contract.createdAt)}`);
    doc.moveDown(1);

    doc.fontSize(12).fillColor(brand.colors.accent).text("Terms", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(DOCUMENT_INK).text(contract.termsText?.trim() || "Terms unavailable.");
    doc.moveDown(1.5);

    doc.fontSize(12).fillColor(brand.colors.accent).text("Signature", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(DOCUMENT_INK);
    if (contract.status === "signed" && contract.signerName && contract.signedAt) {
      doc.text(`Signed by: ${contract.signerName}`);
      doc.text(`Signed on: ${formatDocumentDate(contract.signedAt)}`);
    } else {
      doc.text("Signature: ____________________________");
      doc.text("Date: ____________________________");
    }

    const trustSignals = [
      brand.showLicenseNumber !== false && brand.licenseNumber ? `License ${brand.licenseNumber}` : "",
      brand.showInsuranceSummary !== false && brand.insuranceSummary ? brand.insuranceSummary : "",
      brand.bondingSummary,
    ].filter(Boolean);
    if (trustSignals.length || brand.showPoweredByTradeOS) {
      doc.moveDown(2);
      doc.fontSize(8).fillColor("#475569").text(
        [...trustSignals, brand.showPoweredByTradeOS ? "Powered by TradeOS" : ""].filter(Boolean).join("   •   "),
        { align: "center" }
      );
    }

    doc.end();
  });
}

function getHeaderForeground(color: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return "white";
  const red = Number.parseInt(match[1].slice(0, 2), 16);
  const green = Number.parseInt(match[1].slice(2, 4), 16);
  const blue = Number.parseInt(match[1].slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 >= 150 ? DOCUMENT_INK : "white";
}
