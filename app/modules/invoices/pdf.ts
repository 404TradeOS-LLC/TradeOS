import PDFDocument from "pdfkit";
import type { DocumentFrameBrand } from "../documents/frame";

interface InvoiceForPdf {
  invoiceNumber: number;
  type: string;
  status: string;
  amount: number;
  dueDate: Date | null;
  createdAt: Date;
  percentComplete: number | null;
  project: { name: string; siteAddress: string | null; customer: { name: string; email: string | null } | null };
  lineItems: { description: string; quantity: number; unitOfMeasure: string; unitCost: number; lineCost: number }[];
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
    doc.fillColor("white").fontSize(20).text(brand.companyName, 66, 54, { width: 300 });
    if (brand.tagline) doc.fontSize(9).text(brand.tagline, 66, 80, { width: 300 });
    if (contact) doc.fontSize(8).text(contact, 66, 96, { width: doc.page.width - 132 });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor(brand.colors.accent).text(`Invoice #${invoice.invoiceNumber}`, 50, 132, { align: "left" });
    doc.fillColor(brand.colors.primary);
    doc.y = 158;
    doc.moveDown(1);

    doc.fontSize(10).text(`Project: ${invoice.project.name}`);
    if (invoice.project.siteAddress) doc.text(`Site Address: ${invoice.project.siteAddress}`);
    if (invoice.project.customer) {
      doc.text(`Customer: ${invoice.project.customer.name}`);
      if (invoice.project.customer.email) doc.text(`Email: ${invoice.project.customer.email}`);
    }
    doc.text(`Invoice Date: ${invoice.createdAt.toLocaleDateString()}`);
    if (invoice.dueDate) doc.text(`Due Date: ${invoice.dueDate.toLocaleDateString()}`);
    if (invoice.type === "progress" && invoice.percentComplete != null) {
      doc.text(`Progress Billing: ${Number(invoice.percentComplete).toFixed(1)}% complete`);
    }
    doc.moveDown(1);

    doc.fontSize(12).fillColor(brand.colors.accent).text("Line Items", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    for (const li of invoice.lineItems) {
      doc.text(`${li.description}  —  ${li.quantity} ${li.unitOfMeasure}  —  $${li.lineCost.toFixed(2)}`);
    }
    doc.moveDown(1.5);

    doc.fontSize(12).fillColor(brand.colors.accent).text("Amount Due", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(brand.colors.primary).text(`$${invoice.amount.toFixed(2)}`, { align: "right" });

    const trustSignals = [
      brand.showLicenseNumber !== false && brand.licenseNumber ? `License ${brand.licenseNumber}` : "",
      brand.showInsuranceSummary !== false && brand.insuranceSummary ? brand.insuranceSummary : "",
      brand.showInsuranceSummary !== false && brand.bondingSummary ? brand.bondingSummary : "",
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
