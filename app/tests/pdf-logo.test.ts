import PDFDocument from "pdfkit";
import { drawValidatedPdfLogo, validatePdfLogoBytes } from "../modules/documents/pdf-logo";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPYX2ONFTEMLQkAqeRdgcrsUtEAAAAASUVORK5CYII=", "base64");

describe("trusted PDF logo image bytes", () => {
  it("accepts a small valid PNG and rejects arbitrary URLs or SVG payloads", () => {
    expect(validatePdfLogoBytes(png)).not.toBeNull();
    expect(validatePdfLogoBytes(Buffer.from("http://127.0.0.1/private"))).toBeNull();
    expect(validatePdfLogoBytes(Buffer.from("<svg onload='alert(1)'/>"))).toBeNull();
  });
  it("rejects excessive sizes and misleading PNG dimensions", () => {
    expect(validatePdfLogoBytes(Buffer.alloc(1024 * 1024 + 1))).toBeNull();
    const huge = Buffer.from(png);
    huge.writeUInt32BE(10000, 16);
    expect(validatePdfLogoBytes(huge)).toBeNull();
    expect(validatePdfLogoBytes(Buffer.alloc(0))).toBeNull();
  });
  it("safely draws a trusted PNG into a PDF, but ignores malformed bytes", async () => {
    const generate = (image: Buffer) => new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument(); const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      drawValidatedPdfLogo(doc, image, { x: 24, y: 24, width: 64, height: 64 });
      doc.text("Contractor");
      doc.end();
    });
    const embedded = await generate(png);
    const absent = await generate(Buffer.from("not an image"));
    expect(embedded.toString("latin1")).toContain("/Subtype /Image");
    expect(absent.toString("latin1")).not.toContain("/Subtype /Image");
  });
});
