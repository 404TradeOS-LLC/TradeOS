import PDFDocument from "pdfkit";
import type { DocumentFrameBrand } from "../documents/frame";
import { formatDocumentCurrency, formatDocumentDate, formatDocumentNumber } from "../documents/format";

const DOCUMENT_INK = "#0f172a";

interface InvoiceForPdf {
  invoiceNumber: number;
  type: string;
  status: string;
  amount: number;
  subtotal: number;
  taxPct: number;
  taxAmount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate: Date | null;
  createdAt: Date;
  percentComplete: number | null;
  project: { name: string; siteAddress: string | null; customer: { name: string; email: string | null } | null };
  lineItems: { description: string; quantity: number; unitOfMeasure: string; unitPrice: number; lineTotal: number }[];
}

export function renderInvoicePdf(invoice: InvoiceForPdf, opts: { brand: DocumentFrameBrand }): Promise<Buffer> {
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
    doc.fontSize(14).fillColor(brand.colors.accent).text(`Invoice #${invoice.invoiceNumber}`, 50, 132, { align: "left" });
    doc.fillColor(DOCUMENT_INK);
    doc.y = 158;
    doc.moveDown(1);

    doc.fontSize(10).text(`Project: ${invoice.project.name}`);
    if (invoice.project.siteAddress) doc.text(`Site Address: ${invoice.project.siteAddress}`);
    if (invoice.project.customer) {
      doc.text(`Customer: ${invoice.project.customer.name}`);
      if (invoice.project.customer.email) doc.text(`Email: ${invoice.project.customer.email}`);
    }
    doc.text(`Invoice Date: ${formatDocumentDate(invoice.createdAt)}`);
    if (invoice.dueDate) doc.text(`Due Date: ${formatDocumentDate(invoice.dueDate)}`);
    if (invoice.type === "progress" && invoice.percentComplete != null) {
      doc.text(`Progress Billing: ${formatDocumentNumber(invoice.percentComplete)}% complete`);
    }
    doc.moveDown(1);

    doc.fontSize(12).fillColor(brand.colors.accent).text("Line Items", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(DOCUMENT_INK);
    if (invoice.lineItems.length === 0) {
      doc.text("No line items recorded.");
    } else {
      for (const li of invoice.lineItems) {
        doc.text(`${li.description}  —  ${formatDocumentNumber(li.quantity)} ${li.unitOfMeasure}  —  ${formatDocumentCurrency(li.lineTotal)}`);
      }
    }
    doc.moveDown(1.5);

    doc.fontSize(12).fillColor(brand.colors.accent).text("Invoice summary", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(DOCUMENT_INK);
    doc.text(`Subtotal  ${formatDocumentCurrency(invoice.subtotal)}`, { align: "right" });
    if (invoice.taxAmount > 0) {
      const taxLabel = invoice.taxPct > 0 ? `Tax (${formatDocumentNumber(invoice.taxPct)}%)` : "Tax";
      doc.text(`${taxLabel}  ${formatDocumentCurrency(invoice.taxAmount)}`, { align: "right" });
    }
    doc.fontSize(11).text(`Total  ${formatDocumentCurrency(invoice.amount)}`, { align: "right" });
    if (invoice.paidAmount > 0) doc.fontSize(10).text(`Payments applied  ${formatDocumentCurrency(invoice.paidAmount)}`, { align: "right" });
    doc.fontSize(12).text(`Balance due  ${formatDocumentCurrency(invoice.balanceDue)}`, { align: "right" });

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
