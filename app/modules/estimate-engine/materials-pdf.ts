import PDFDocument from "pdfkit";
import type { EstimateShoppingList } from "./materials-list";

const materialQuantityFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

export interface EstimateMaterialsPdfInput extends EstimateShoppingList {
  projectName: string;
  siteAddress: string | null;
  customerName: string | null;
  estimateVersion: number;
}

/** Renders only the projected material fields. No estimate cost or sell values enter this function. */
export function renderEstimateMaterialsPdf(input: EstimateMaterialsPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.roundedRect(48, 42, doc.page.width - 96, 72, 9).fill("#202328");
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(20)
      .text("Materials shopping list", 63, 58, { width: doc.page.width - 126 });
    doc.fillColor("#39424B").font("Helvetica").fontSize(10);
    doc.y = 131;
    doc.text(`Project: ${input.projectName}`);
    if (input.siteAddress) doc.text(`Location: ${input.siteAddress}`);
    if (input.customerName) doc.text(`For: ${input.customerName}`);
    doc.text(`Estimate version: ${input.estimateVersion}`);
    doc.moveDown(0.7);
    doc.fillColor("#56616B").fontSize(9).text(
      "Items below are taken from saved material lines. Confirm sizes and quantities before purchasing."
    );
    doc.moveDown(1.2);

    let previousSection: string | null = null;
    for (const item of input.items) {
      const quantityLabel = `${materialQuantityFormatter.format(item.quantity)} ${item.unitOfMeasure}`;
      if (previousSection !== item.section) {
        ensureRoom(doc, 48);
        doc.fillColor("#B46D38").font("Helvetica-Bold").fontSize(11).text(item.section);
        doc.moveDown(0.5);
        previousSection = item.section;
      }

      doc.font("Helvetica").fontSize(10);
      const rowHeight = Math.max(
        doc.heightOfString(item.description, { width: 305 }),
        doc.heightOfString(quantityLabel, { width: 112 })
      ) + 15;
      ensureRoom(doc, rowHeight + 8);
      const y = doc.y;
      doc.lineWidth(0.9).strokeColor("#88939A").rect(52, y + 2, 10, 10).stroke();
      doc.fillColor("#222B34").font("Helvetica").fontSize(10)
        .text(item.description, 72, y, { width: 305 });
      doc.font("Helvetica-Bold").text(
        quantityLabel,
        400, y, { width: 160, align: "right" }
      );
      doc.y = y + rowHeight;
    }

    if (input.unexpandedAssemblyCount > 0) {
      ensureRoom(doc, 65);
      doc.moveDown(1);
      doc.fillColor("#77532F").font("Helvetica-Bold").fontSize(10)
        .text("Assembly materials need separate review");
      doc.fillColor("#39424B").font("Helvetica").fontSize(9)
        .text(`${input.unexpandedAssemblyCount} assembly line(s) were not expanded into purchasable material quantities.`);
    }

    ensureRoom(doc, 65);
    doc.moveDown(1);
    doc.fillColor("#56616B").font("Helvetica").fontSize(9)
      .text("This checklist is for purchasing preparation. It is not a supplier quote or a purchase authorization.");
    doc.end();
  });
}

function ensureRoom(doc: PDFKit.PDFDocument, height: number): void {
  if (doc.y + height > doc.page.height - 56) doc.addPage();
}
